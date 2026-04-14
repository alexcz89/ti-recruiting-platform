// app/api/profile/education/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const EducationSchema = z.object({
  id: z.string().optional(),
  level: z.enum(["NONE", "PRIMARY", "SECONDARY", "HIGH_SCHOOL", "TECHNICAL", "BACHELOR", "MASTER", "DOCTORATE", "OTHER"]).nullable().optional(),
  institution: z.string().min(1, "Institución requerida"),
  program: z.string().optional().nullable(),
  startDate: z.string().regex(MONTH_RE).optional().nullable().or(z.literal("")),
  endDate: z.string().regex(MONTH_RE).optional().nullable().or(z.literal("")),
  sortIndex: z.number().int().default(0),
});

const toDate = (ym?: string | null): Date | null => {
  if (!ym || ym === "") return null;
  return new Date(`${ym}-01T00:00:00.000Z`);
};

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
    const education = z.array(EducationSchema).parse(body.education ?? []);

    const educationRank: Record<string, number> = {
      NONE: 0, PRIMARY: 1, SECONDARY: 2, HIGH_SCHOOL: 3,
      TECHNICAL: 4, BACHELOR: 5, MASTER: 6, DOCTORATE: 7, OTHER: 2,
    };
    let bestLevel: string | null = null;
    let bestScore = -1;
    for (const ed of education) {
      if (!ed.level) continue;
      const score = educationRank[ed.level] ?? -1;
      if (score > bestScore) { bestScore = score; bestLevel = ed.level; }
    }

    await prisma.$transaction(async (tx) => {
      const keepIds = education.map((e) => e.id).filter(Boolean) as string[];
      if (keepIds.length > 0) {
        await tx.education.deleteMany({
          where: { userId: me.id, id: { notIn: keepIds } },
        });
      } else {
        await tx.education.deleteMany({ where: { userId: me.id } });
      }

      for (const [i, ed] of education.entries()) {
        const startDate = toDate(ed.startDate);
        const endDate = toDate(ed.endDate);
        const status: "ONGOING" | "COMPLETED" = endDate ? "COMPLETED" : "ONGOING";
        const data = {
          userId: me.id,
          level: (ed.level as any) ?? null,
          status,
          institution: ed.institution,
          program: ed.program ?? null,
          startDate,
          endDate,
          sortIndex: ed.sortIndex ?? i,
        };
        if (ed.id) {
          await tx.education.upsert({
            where: { id: ed.id },
            update: data,
            create: { ...data },
          });
        } else {
          await tx.education.create({ data });
        }
      }

      if (bestLevel) {
        await tx.user.update({
          where: { id: me.id },
          data: { highestEducationLevel: bestLevel as any },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    console.error("[PATCH /api/profile/education]", e);
    return NextResponse.json({ error: "Error al guardar escolaridad" }, { status: 500 });
  }
}