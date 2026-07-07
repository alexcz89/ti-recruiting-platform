// app/api/badges/[templateId]/start/route.ts
// Inicia (o reanuda) un examen de badge candidato-iniciado: sin invite,
// sin empresa, sin créditos. El attempt se crea NOT_STARTED y el taker
// existente lo arranca vía resumeAttemptId.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { BADGE_RETRY_COOLDOWN_DAYS } from "@/lib/badges";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as { id?: string; role?: string };
    if (String(user.role ?? "").toUpperCase() !== "CANDIDATE") {
      return jsonNoStore({ error: "Solo candidatos" }, 403);
    }
    const candidateId = String(user.id ?? "");
    if (!candidateId) return jsonNoStore({ error: "No autorizado" }, 401);

    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: params.templateId },
      select: {
        id: true,
        isBadgeExam: true,
        isActive: true,
        isGlobal: true,
        badgeTermId: true,
        badgeLevel: true,
      },
    });

    if (
      !template ||
      !template.isBadgeExam ||
      !template.isActive ||
      !template.isGlobal ||
      !template.badgeTermId ||
      template.badgeLevel == null
    ) {
      return jsonNoStore({ error: "Examen de badge no disponible" }, 404);
    }

    // Ya obtenido → no se re-presenta
    const existingBadge = await prisma.candidateBadge.findUnique({
      where: {
        candidateId_termId_level: {
          candidateId,
          termId: template.badgeTermId,
          level: template.badgeLevel,
        },
      },
      select: { id: true },
    });
    if (existingBadge) {
      return jsonNoStore({ error: "Ya obtuviste este badge" }, 409);
    }

    // Gating: nivel 3+ requiere el nivel anterior del mismo skill
    if (template.badgeLevel >= 3) {
      const previous = await prisma.candidateBadge.findUnique({
        where: {
          candidateId_termId_level: {
            candidateId,
            termId: template.badgeTermId,
            level: template.badgeLevel - 1,
          },
        },
        select: { id: true },
      });
      if (!previous) {
        return jsonNoStore(
          { error: "Este nivel requiere aprobar el nivel anterior" },
          403
        );
      }
    }

    const now = new Date();

    // Reanudar attempt de badge activo (sin invite ni application) si existe
    const active = await prisma.assessmentAttempt.findFirst({
      where: {
        candidateId,
        templateId: template.id,
        inviteId: null,
        applicationId: null,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (active) {
      return jsonNoStore({ attemptId: active.id, reused: true });
    }

    // Cooldown: último attempt final reprobado dentro de la ventana
    const cooldownMs = BADGE_RETRY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const lastFailed = await prisma.assessmentAttempt.findFirst({
      where: {
        candidateId,
        templateId: template.id,
        inviteId: null,
        applicationId: null,
        status: { in: ["SUBMITTED", "EVALUATED", "COMPLETED"] },
        passed: false,
        submittedAt: { gt: new Date(now.getTime() - cooldownMs) },
      },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
    });
    if (lastFailed?.submittedAt) {
      const retryAt = new Date(lastFailed.submittedAt.getTime() + cooldownMs);
      return jsonNoStore(
        {
          error: `Podrás reintentar este examen el ${retryAt.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}`,
          retryAt: retryAt.toISOString(),
        },
        429
      );
    }

    const attemptsUsed = await prisma.assessmentAttempt.count({
      where: {
        candidateId,
        templateId: template.id,
        inviteId: null,
        applicationId: null,
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        candidateId,
        templateId: template.id,
        status: "NOT_STARTED",
        attemptNumber: attemptsUsed + 1,
      },
      select: { id: true },
    });

    return jsonNoStore({ attemptId: attempt.id, reused: false });
  } catch (err) {
    console.error("[badges/start]", err);
    return jsonNoStore({ error: "Error interno" }, 500);
  }
}
