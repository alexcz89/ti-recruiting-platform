// app/api/profile/languages/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

const ALLOWED_LEVELS = ["NATIVE", "PROFESSIONAL", "CONVERSATIONAL", "BASIC"] as const;

const LanguageSchema = z.object({
  termId: z.string().min(1),
  label: z.string().min(1),
  level: z.enum(ALLOWED_LEVELS),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (!me) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (me.role !== "CANDIDATE") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const languages = z.array(LanguageSchema).parse(body.languages ?? []);

    // Validate all termIds exist in DB
    if (languages.length > 0) {
      const ids = languages.map((l) => l.termId);
      const found = await prisma.taxonomyTerm.findMany({
        where: { id: { in: ids }, kind: "LANGUAGE" },
        select: { id: true },
      });
      const foundIds = new Set(found.map((t) => t.id));
      const invalid = ids.find((id) => !foundIds.has(id));
      if (invalid) return NextResponse.json({ error: `Idioma inválido: ${invalid}` }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.candidateLanguage.deleteMany({ where: { userId: me.id } });
      if (languages.length > 0) {
        await tx.candidateLanguage.createMany({
          data: languages.map((l) => ({
            userId: me.id,
            termId: l.termId,
            level: l.level,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    console.error("[PATCH /api/profile/languages]", e);
    return NextResponse.json({ error: "Error al guardar idiomas" }, { status: 500 });
  }
}