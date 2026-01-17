// app/api/applications/[id]/assessment-invite/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionCompanyId } from "@/lib/session";
import crypto from "crypto";
import { sendAssessmentInviteEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function buildBaseUrl(req: Request) {
  const env =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL;

  if (env) {
    const withProto = env.startsWith("http") ? env : `https://${env}`;
    return withProto.replace(/\/$/, "");
  }

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`.replace(/\/$/, "");

  return "http://localhost:3000";
}

function isInviteReusable(inv: { status: any; expiresAt: Date | null }, now: Date) {
  const s = String(inv.status || "").toUpperCase();
  if (s !== "SENT" && s !== "STARTED") return false;
  if (inv.expiresAt && inv.expiresAt <= now) return false;
  return true;
}

function computeExpiresAt(days: number) {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * days);
}

/**
 * Billing switch (scaffold)
 * - Default: FREE (no valida créditos)
 * - Si activas: ASSESSMENTS_REQUIRE_CREDITS=true => responderá 402 (hasta implementar consumo real)
 */
function isCreditsEnforced() {
  return String(process.env.ASSESSMENTS_REQUIRE_CREDITS || "").toLowerCase() === "true";
}

type EmailStatus = "sent" | "skipped" | "failed";

const selectInvite = {
  id: true,
  token: true,
  status: true,
  sentAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// POST /api/applications/[id]/assessment-invite
// Body opcional: { templateId?: string, expiresInDays?: number }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const t0 = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const user = session.user as any;
    const isAdmin = user?.role === "ADMIN";
    const isRecruiter = user?.role === "RECRUITER";
    if (!isAdmin && !isRecruiter) return json(403, { error: "No autorizado" });

    const sessionCompanyId = await getSessionCompanyId().catch(() => null);
    if (!sessionCompanyId && !isAdmin) return json(403, { error: "Sin empresa asociada" });

    // ===== Billing switch (scaffold) =====
    if (!isAdmin && isCreditsEnforced()) {
      return json(402, { error: "Sin créditos para enviar assessments", code: "NO_CREDITS" });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const requestedTemplateId = body?.templateId ? String(body.templateId) : null;
    const expiresInDaysRaw = body?.expiresInDays;

    const expiresInDays =
      typeof expiresInDaysRaw === "number" &&
      Number.isFinite(expiresInDaysRaw) &&
      expiresInDaysRaw > 0
        ? Math.floor(expiresInDaysRaw)
        : 7;

    const now = new Date();
    const newExpiresAt = computeExpiresAt(expiresInDays);

    // 1) Cargar application + validar scope
    const application = await prisma.application.findFirst({
      where: {
        id: params.id,
        ...(isAdmin ? {} : { job: { companyId: sessionCompanyId as string } }),
      },
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
            recruiterId: true,
            company: { select: { name: true } },
            assessments: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                templateId: true,
                isRequired: true,
                minScore: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!application) return json(404, { error: "Postulación no encontrada" });

    // scope extra para recruiter
    if (isRecruiter) {
      const recruiterCompanyOk = sessionCompanyId && application.job.companyId === sessionCompanyId;
      const recruiterOwnerOk = application.job.recruiterId && application.job.recruiterId === user.id;

      if (!recruiterCompanyOk && !recruiterOwnerOk) {
        return json(403, { error: "No autorizado (job fuera de tu scope)" });
      }
    }

    // 2) Elegir template
    const jobAssessments = application.job.assessments ?? [];
    if (!jobAssessments.length) {
      return json(400, { error: "Esta vacante no tiene assessments asignados" });
    }

    const defaultTemplateId =
      jobAssessments.find((a) => a.isRequired)?.templateId ?? jobAssessments[0]?.templateId;

    const chosenTemplateId =
      requestedTemplateId ?? (defaultTemplateId ? String(defaultTemplateId) : null);

    if (!chosenTemplateId) {
      return json(400, { error: "Esta vacante no tiene assessments asignados" });
    }

    const chosenJobAssessment = jobAssessments.find((a) => String(a.templateId) === chosenTemplateId);
    if (!chosenJobAssessment) {
      return json(400, { error: "El template solicitado no está asignado a esta vacante" });
    }

    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: chosenTemplateId },
      select: { id: true, title: true, timeLimit: true },
    });

    if (!template) return json(404, { error: "Template no encontrado" });

    // 3) Crear/reusar invite por (applicationId, templateId)
    let invite = await prisma.assessmentInvite.findFirst({
      where: { applicationId: application.id, templateId: template.id },
      select: selectInvite,
    });

    let createdInvite = false;
    let reusedInvite = Boolean(invite);
    let rotated = false;

    if (!invite) {
      const token = crypto.randomBytes(32).toString("hex");
      try {
        invite = await prisma.assessmentInvite.create({
          data: {
            application: { connect: { id: application.id } },
            job: { connect: { id: application.jobId } },
            candidate: { connect: { id: application.candidateId } },
            template: { connect: { id: template.id } },

            token,
            status: "SENT" as any,
            expiresAt: newExpiresAt,
            sentAt: null,

            invitedBy: user?.id ? { connect: { id: user.id } } : undefined,
          } as any,
          select: selectInvite,
        });

        createdInvite = true;
        reusedInvite = false;
      } catch (e: any) {
        if (String(e?.code || "") !== "P2002") throw e;

        invite = await prisma.assessmentInvite.findFirst({
          where: { applicationId: application.id, templateId: template.id },
          select: selectInvite,
        });

        reusedInvite = true;
      }
    }

    if (!invite) return json(500, { error: "No se pudo crear la invitación" });

    // 4) Si no es reusable => rotar token + reiniciar a SENT/expiresAt
    //    y MUY IMPORTANTE: desligar attempts activos viejos (inviteId @unique)
    if (!isInviteReusable(invite, now)) {
      const rotatedToken = crypto.randomBytes(32).toString("hex");
      rotated = true;

      invite = await prisma.$transaction(async (tx) => {
        // desligar attempts NO_FINALIZADOS para liberar el inviteId @unique
        await tx.assessmentAttempt.updateMany({
          where: {
            inviteId: invite!.id,
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] as any },
          } as any,
          data: { inviteId: null } as any,
        });

        return tx.assessmentInvite.update({
          where: { id: invite!.id },
          data: {
            token: rotatedToken,
            status: "SENT" as any,
            expiresAt: newExpiresAt,
            sentAt: null,
            invitedBy: user?.id ? { connect: { id: user.id } } : undefined,
          } as any,
          select: selectInvite,
        });
      });
    } else {
      // Reusable: si aún está SENT o STARTED, puedes extender expiración
      const s = String(invite.status || "").toUpperCase();
      if (s === "SENT" || s === "STARTED") {
        invite = await prisma.assessmentInvite.update({
          where: { id: invite.id },
          data: {
            expiresAt: newExpiresAt,
            invitedBy: user?.id ? { connect: { id: user.id } } : undefined,
          } as any,
          select: selectInvite,
        });
      }
    }

    // 5) Link (solo token)
    const baseUrl = buildBaseUrl(request);
    const inviteUrl = new URL(`/assessments/${template.id}`, baseUrl);
    inviteUrl.searchParams.set("token", invite.token);

    // 6) Enviar email (si hay email)
    let emailStatus: EmailStatus = "skipped";
    let emailError: string | null = null;

    const candidateEmail = application.candidate?.email ? String(application.candidate.email) : "";

    if (candidateEmail) {
      try {
        const r = await sendAssessmentInviteEmail({
          to: candidateEmail,
          candidateName: application.candidate?.name ?? null,
          jobTitle: application.job?.title ?? null,
          companyName: application.job?.company?.name ?? null,
          templateTitle: template.title,
          timeLimit: template.timeLimit ?? null,
          expiresAt: invite.expiresAt ?? null,
          inviteUrl: inviteUrl.toString(),
          dedupeKey: invite.id,
        } as any);

        if ("ok" in r && (r as any).ok) emailStatus = "sent";
        else if ("skipped" in r && (r as any).skipped) emailStatus = "skipped";
        else if ("error" in r) {
          emailStatus = "failed";
          emailError = (r as any).error;
        }
      } catch (err: any) {
        emailStatus = "failed";
        emailError = err?.message || "send_failed";
      }
    } else {
      emailStatus = "skipped";
      emailError = "candidate_email_missing";
    }

    // sentAt = último “intento de envío” (ok o skipped)
    if (emailStatus === "sent" || emailStatus === "skipped") {
      invite = await prisma.assessmentInvite.update({
        where: { id: invite.id },
        data: { sentAt: now },
        select: selectInvite,
      });
    }

    // 7) Lookup opcional de attempt "reusable": SOLO si está NO_FINALIZADO y NO EXPIRADO
    //    Si no hay uno activo, regresamos attempt: null (el candidato crea uno nuevo vía /start con token).
    const activeNotExpiredWhere = {
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] as any },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    } as const;

    const existingAttemptByInvite = await prisma.assessmentAttempt.findFirst({
      where: {
        inviteId: invite.id,
        ...(activeNotExpiredWhere as any),
      } as any,
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, startedAt: true, expiresAt: true },
    });

    const existingAttempt =
      existingAttemptByInvite ??
      (await prisma.assessmentAttempt.findFirst({
        where: {
          applicationId: application.id,
          candidateId: application.candidateId,
          templateId: template.id,
          ...(activeNotExpiredWhere as any),
        } as any,
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true, startedAt: true, expiresAt: true },
      }));

    if (process.env.NODE_ENV !== "production") {
      console.log("[ASSESSMENT INVITE] ok", {
        applicationId: application.id,
        jobId: application.jobId,
        candidateId: application.candidateId,
        templateId: template.id,
        inviteId: invite.id,
        reusedInvite,
        createdInvite,
        rotated,
        attemptId: existingAttempt?.id ?? null,
        inviteUrl: inviteUrl.toString(),
        emailStatus,
        emailError,
        isRequired: Boolean(chosenJobAssessment.isRequired),
        minScore: chosenJobAssessment.minScore ?? null,
        ms: Date.now() - t0,
      });
    }

    return json(200, {
      ok: true,
      template: { id: template.id, title: template.title, timeLimit: template.timeLimit },
      jobAssessment: {
        id: chosenJobAssessment.id,
        isRequired: Boolean(chosenJobAssessment.isRequired),
        minScore: chosenJobAssessment.minScore ?? null,
      },
      attempt: existingAttempt ?? null, // 👈 si no hay activo/no expirado, queda null
      invite,
      inviteUrl: inviteUrl.toString(),
      emailStatus,
      emailError,
      meta: { reusedInvite, createdInvite, rotated },
    });
  } catch (e: any) {
    console.error("[ASSESSMENT INVITE] ERROR", e);

    const isDev = process.env.NODE_ENV !== "production";
    return json(500, {
      error: "Error al enviar invitación",
      ...(isDev ? { detail: e?.message || String(e) } : {}),
    });
  }
}
