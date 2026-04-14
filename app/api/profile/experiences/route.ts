// app/api/profile/experiences/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const ExperienceSchema = z.object({
  id: z.string().optional(),
  role: z.string().min(2, "Puesto requerido (mínimo 2 caracteres)"),
  company: z.string().min(2, "Empresa requerida (mínimo 2 caracteres)"),
  startDate: z.string().regex(MONTH_RE, "Fecha inicio inválida (YYYY-MM)"),
  endDate: z.string().regex(MONTH_RE).nullable().optional(),
  isCurrent: z.boolean().default(false),
}).refine(
  (e) => !(e.isCurrent && e.endDate),
  { message: "Trabajo actual no debe tener fecha fin" }
);

const toDate = (ym: string) => new Date(`${ym}-01T00:00:00.000Z`);

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
    const experiences = z.array(ExperienceSchema).parse(body.experiences ?? []);

    // Validate start < end for non-current jobs
    for (let i = 0; i < experiences.length; i++) {
      const e = experiences[i];
      if (!e.isCurrent && e.endDate) {
        const start = toDate(e.startDate);
        const end = toDate(e.endDate);
        if (start > end) {
          return NextResponse.json(
            { error: `Experiencia #${i + 1}: inicio no puede ser posterior al fin` },
            { status: 400 }
          );
        }
      }
    }

    // Sort by startDate desc
    const sorted = [...experiences].sort(
      (a, b) => toDate(b.startDate).getTime() - toDate(a.startDate).getTime()
    );

    await prisma.$transaction(async (tx) => {
      // Keep existing records that have an id, delete orphans
      const keepIds = sorted.map((e) => e.id).filter(Boolean) as string[];
      if (keepIds.length > 0) {
        await tx.workExperience.deleteMany({
          where: { userId: me.id, id: { notIn: keepIds } },
        });
      } else {
        await tx.workExperience.deleteMany({ where: { userId: me.id } });
      }

      for (const e of sorted) {
        const data = {
          userId: me.id,
          role: e.role,
          company: e.company,
          startDate: toDate(e.startDate),
          endDate: e.isCurrent ? null : e.endDate ? toDate(e.endDate) : null,
          isCurrent: !!e.isCurrent,
        };
        if (e.id) {
          await tx.workExperience.upsert({
            where: { id: e.id },
            update: data,
            create: { ...data },
          });
        } else {
          await tx.workExperience.create({ data });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    console.error("[PATCH /api/profile/experiences]", e);
    return NextResponse.json({ error: "Error al guardar experiencia" }, { status: 500 });
  }
}