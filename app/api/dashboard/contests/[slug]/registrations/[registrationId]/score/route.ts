import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

const scoreSchema = z.object({
  qualityScore: z.coerce.number().int().min(0).max(10),
  efficiencyScore: z.coerce.number().int().min(0).max(10),
  explanationScore: z.coerce.number().int().min(0).max(5),
  status: z.enum(["QUALIFIER_SUBMITTED", "FINALIST", "WINNER", "DISQUALIFIED"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; registrationId: string } }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (String(user.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = scoreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Puntuación inválida", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const registration = await prisma.contestRegistration.findFirst({
    where: { id: params.registrationId, contest: { slug: params.slug } },
    select: { id: true, automatedScore: true, attempt: { select: { status: true } } },
  });
  if (!registration) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  if (!registration.attempt || !["SUBMITTED", "EVALUATED", "COMPLETED"].includes(registration.attempt.status)) {
    return NextResponse.json({ error: "La clasificatoria aún no ha sido enviada" }, { status: 409 });
  }

  const manualScore = parsed.data.qualityScore + parsed.data.efficiencyScore + parsed.data.explanationScore;
  const updated = await prisma.contestRegistration.update({
    where: { id: registration.id },
    data: {
      ...parsed.data,
      finalScore: registration.automatedScore + manualScore,
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
    select: { finalScore: true, status: true },
  });

  return NextResponse.json({ success: true, ...updated });
}