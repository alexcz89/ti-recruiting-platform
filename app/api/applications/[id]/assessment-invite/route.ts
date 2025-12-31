// app/api/applications/[id]/assessment-invite/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionCompanyId } from "@/lib/session";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// POST /api/applications/[id]/assessment-invite
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const t0 = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const companyId = await getSessionCompanyId().catch(() => null);

    console.log("[ASSESSMENT INVITE] hit", {
      applicationId: params.id,
      sessionUserId: user?.id,
      role: user?.role,
      companyId,
    });

    if (!companyId) {
      return NextResponse.json({ error: "Sin empresa asociada" }, { status: 403 });
    }

    if (user?.role !== "RECRUITER" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 1) Cargar postulación + validar multiempresa
    const application = await prisma.application.findFirst({
      where: { id: params.id, job: { companyId } },
      select: {
        id: true,
        jobId: true,
        candidateId: true,
        candidate: { select: { id: true, email: true, name: true } },
        job: {
          select: {
            id: true,
            title: true,
            companyId: true,
            assessments: {
              orderBy: { createdAt: "asc" },
              select: { id: true, templateId: true, isRequired: true, minScore: true },
            },
          },
        },
      },
    });

    if (!application) {
      console.log("[ASSESSMENT INVITE] application not found or not in company", {
        applicationId: params.id,
        companyId,
      });
      return NextResponse.json({ error: "Postulación no encontrada" }, { status: 404 });
    }

    // 2) Elegir template a enviar (por ahora: primer assessment asignado a la vacante)
    const jobAssessments = application.job.assessments ?? [];
    const chosen = jobAssessments[0] ?? null;

    if (!chosen?.templateId) {
      console.log("[ASSESSMENT INVITE] job has no assessments assigned", {
        jobId: application.jobId,
        assessmentsCount: jobAssessments.length,
      });
      return NextResponse.json(
        { error: "Esta vacante no tiene assessments asignados" },
        { status: 400 }
      );
    }

    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: chosen.templateId },
      select: { id: true, title: true, timeLimit: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
    }

    // 3) Reusar attempt si existe (NOT_STARTED o IN_PROGRESS) para esta aplicación+template
    const existingAttempt = await prisma.assessmentAttempt.findFirst({
      where: {
        applicationId: application.id,
        candidateId: application.candidateId,
        templateId: template.id,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] as any },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true },
    });

    const attempt =
      existingAttempt ??
      (await prisma.assessmentAttempt.create({
        data: {
          applicationId: application.id,
          candidateId: application.candidateId,
          templateId: template.id,
          status: "NOT_STARTED" as any,
          startedAt: null,
          expiresAt: null,
        } as any,
        select: { id: true, status: true, createdAt: true },
      }));

    // 4) Reusar invite activo si ya existe (no expirado)
    const now = new Date();
    const existingInvite = await prisma.assessmentInvite.findFirst({
      where: {
        applicationId: application.id,
        jobId: application.jobId,
        candidateId: application.candidateId,
        templateId: template.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        status: { in: ["SENT", "STARTED"] as any },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        status: true,
        sentAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const token = existingInvite?.token ?? crypto.randomBytes(24).toString("hex");
    const expiresAt = existingInvite?.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 días

    const invite =
      existingInvite ??
      (await prisma.assessmentInvite.create({
        data: {
          application: { connect: { id: application.id } },
          job: { connect: { id: application.jobId } },
          candidate: { connect: { id: application.candidateId } },
          template: { connect: { id: template.id } },
          token,
          expiresAt,
          // Marcamos sentAt aunque no tengas SMTP aún (ya “se envió” desde tu UI)
          sentAt: new Date(),
          invitedBy: user?.id ? { connect: { id: user.id } } : undefined,
          // status queda por default SENT, pero lo dejamos explícito por claridad
          status: "SENT" as any,
        } as any,
        select: {
          id: true,
          token: true,
          status: true,
          sentAt: true,
          expiresAt: true,
          createdAt: true,
        },
      }));

    // 5) Email (por ahora lo dejamos “skipped” para no bloquear)
    const emailStatus: "sent" | "skipped" | "failed" = "skipped";
    const emailError: string | null = null;

    console.log("[ASSESSMENT INVITE] ok", {
      applicationId: application.id,
      jobId: application.jobId,
      candidateId: application.candidateId,
      templateId: template.id,
      attemptId: attempt.id,
      inviteId: invite.id,
      reusedAttempt: !!existingAttempt,
      reusedInvite: !!existingInvite,
      emailStatus,
      ms: Date.now() - t0,
    });

    return NextResponse.json(
      {
        ok: true,
        template: { id: template.id, title: template.title },
        attempt,
        invite,
        emailStatus,
        emailError,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("[ASSESSMENT INVITE] ERROR", e);
    return NextResponse.json(
      { error: "Error al enviar invitación", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
