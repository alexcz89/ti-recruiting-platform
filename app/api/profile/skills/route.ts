// app/api/profile/skills/route.ts
// Maneja tanto CandidateSkill (skills con nivel) como certifications
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

const SkillSchema = z.object({
  termId: z.string().min(1),
  label:  z.string().min(1),
  level:  z.number().int().min(1).max(5),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!me) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (me.role !== "CANDIDATE") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();

    // ── Caso 1: skills con nivel (desde ProfileSummaryClient) ──
    if (Array.isArray(body.skills)) {
      const skills = z.array(SkillSchema).parse(body.skills);

      if (skills.length > 0) {
        const ids = skills.map((s) => s.termId);
        const found = await prisma.taxonomyTerm.findMany({
          where: { id: { in: ids }, kind: "SKILL" },
          select: { id: true },
        });
        const foundIds = new Set(found.map((t) => t.id));
        const invalid = ids.find((id) => !foundIds.has(id));
        if (invalid) {
          return NextResponse.json({ error: `Skill inválido: ${invalid}` }, { status: 400 });
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.candidateSkill.deleteMany({ where: { userId: me.id } });
        if (skills.length > 0) {
          await tx.candidateSkill.createMany({
            data: skills.map((s) => ({
              userId: me.id,
              termId: s.termId,
              level:  s.level as any,
            })),
          });
        }
      });

      return NextResponse.json({ ok: true });
    }

    // ── Caso 2: certifications (compatibilidad con uso anterior) ──
    if (Array.isArray(body.certifications)) {
      const certifications = body.certifications
        .filter((v: unknown): v is string => typeof v === "string")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const updated = await prisma.user.update({
        where: { id: me.id },
        data: { certifications },
        select: { id: true, email: true, certifications: true },
      });

      return NextResponse.json({ ok: true, user: updated });
    }

    return NextResponse.json({ ok: true, user: null });

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("[PATCH /api/profile/skills] error", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}