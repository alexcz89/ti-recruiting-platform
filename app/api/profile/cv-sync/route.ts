// app/api/profile/cv-sync/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { z } from "zod";

const BodySchema = z.object({
  experiences: z
    .array(
      z.object({
        role: z.string().optional().nullable(),
        company: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(), // "YYYY-MM"
        endDate: z.string().optional().nullable(),   // "YYYY-MM"
        isCurrent: z.boolean().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string().optional().nullable(),
        program: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(), // "YYYY-MM"
        endDate: z.string().optional().nullable(),   // "YYYY-MM"
      })
    )
    .optional()
    .default([]),
});

function parseMonth(value?: string | null) {
  if (!value) return null;
  // esperamos "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  // primer día del mes; la zona horaria exacta da igual para el resumen
  return new Date(`${value}-01T00:00:00.000Z`);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, error: "No autenticado" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datos inválidos" },
      { status: 400 }
    );
  }

  const { experiences, education } = parsed.data;

  const expData = (experiences || [])
    .filter((e) => (e.role || "").trim() || (e.company || "").trim())
    .map((e) => ({
      userId: user.id,
      role: (e.role || "").trim(),
      company: (e.company || "").trim(),
      startDate: parseMonth(e.startDate),
      endDate: e?.isCurrent ? null : parseMonth(e.endDate),
      isCurrent: !!e?.isCurrent,
    }));

  const eduData = (education || [])
    .filter((e) => (e.institution || "").trim() || (e.program || "").trim())
    .map((e, idx) => {
      const start = parseMonth(e.startDate);
      const end = parseMonth(e.endDate);
      const ongoing = !end;

      return {
        userId: user.id,
        institution: (e.institution || "").trim(),
        program: (e.program || "").trim(),
        startDate: start,
        endDate: end,
        // estos valores casan con los que usas en EDUCATION_*_LABEL
        level: "OTHER" as any,
        status: (ongoing ? "ONGOING" : "COMPLETED") as any,
        sortIndex: idx,
      };
    });

  await prisma.$transaction(async (tx) => {
    // Experiencia
    await tx.workExperience.deleteMany({ where: { userId: user.id } });
    if (expData.length) {
      // 👇 Cast a any para no pelear con el tipo de startDate/endDate
      await tx.workExperience.createMany({ data: expData as any });
    }

    // Educación
    await tx.education.deleteMany({ where: { userId: user.id } });
    if (eduData.length) {
      await tx.education.createMany({ data: eduData });
    }
  });

  return NextResponse.json({ ok: true });
}
