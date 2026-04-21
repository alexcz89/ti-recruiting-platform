// app/api/applications/[id]/assessment-invite/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/prisma";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";
import { sendAssessmentInviteEmail } from "@/lib/server/mailer";
import { NotificationService } from "@/lib/notifications/service";
import { getCurrentBillingCycle } from "@/lib/assessments/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EmailStatus = "sent" | "skipped" | "failed";

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

const ONE_CREDIT = new Prisma.Decimal(1);

function json(status: number, body: unknown) {
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

function isInviteReusable(
  inv: { status: string | null; expiresAt: Date | null },
  now: Date
) {
  const s = String(inv.status || "").toUpperCase();
  if (s !== "SENT" && s !== "STARTED") return false;
  if (inv.expiresAt && inv.expiresAt <= now) return false;
  return true;
}

function computeExpiresAt(days: number) {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * days);
}

function isCreditsEnforced() {
  return (
    String(process.env.ASSESSMENTS_REQUIRE_CREDITS || "").toLowerCase() ===
    "true"
  );
}

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
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const t0 = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const user = session.user as SessionUser;
    const isAdmin = user.role === "ADMIN";
    const isRecruiter = user.role === "RECRUITER";

    if (!isAdmin && !isRecruiter) {
      return json(403, { error: "No autorizado" });
    }

    const sessionCompanyId = await getSessionCompanyId().catch(() => null);
    if (!sessionCompanyId && !isAdmin) {
      return json(403, { error: "Sin empresa asociada" });
    }

    let body: { templateId?: unknown; expiresInDays?: unknown } = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        body = await request.json();
      } catch {
        return json(400, { error: "Cuerpo inválido (JSON requerido)" });
      }
    }

    const requestedTemplateId =
      typeof body.templateId === "string" ? body.templateId : null;

    const expiresInDaysRaw = body.expiresInDays;
    const expiresInDays =
      typeof expiresInDaysRaw === "number" &&
      Number.isFinite(expiresInDaysRaw) &&
      expiresInDaysRaw > 0
        ? Math.floor(expiresInDaysRaw)
        : 7;

    const now = new Date();
    const newExpiresAt = computeExpiresAt(expiresInDays);

    const application = await prisma.application.findFirst({
      where: {
        id: params.id,
        ...(isAdmin ? {} : { job: { companyId: sessionCompanyId as string } }),
      },
      select: {
        id: true,
        jobId: true,
        candidateId: true,
        candidate: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            companyId: true,
            recruiterId: true,
            company: {
              select: {
                id: true,
                name: true,
                assessmentCredits: true,
              },
            },
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

    if (!application) {
      return json(404, { error: "Postulación no encontrada" });
    }

    if (isRecruiter) {
      const recruiterCompanyOk =
        !!sessionCompanyId && application.job.companyId === sessionCompanyId;
      const recruiterOwnerOk =
        !!application.job.recruiterId && application.job.recruiterId === user.id;

      if (!recruiterCompanyOk && !recruiterOwnerOk) {
        return json(403, { error: "No autorizado (job fuera de tu scope)" });
      }
    }

    const jobAssessments = application.job.assessments ?? [];
    if (!jobAssessments.length) {
      return json(400, {
        error: "Esta vacante no tiene assessments asignados",
      });
    }

    const defaultTemplateId =
      jobAssessments.find((a) => a.isRequired)?.templateId ??
      jobAssessments[0]?.templateId;

    const chosenTemplateId =
      requestedTemplateId ?? (defaultTemplateId ? String(defaultTemplateId) : null);

    if (!chosenTemplateId) {
      return json(400, {
        error: "Esta vacante no tiene assessments asignados",
      });
    }

    const chosenJobAssessment = jobAssessments.find(
      (a) => String(a.templateId) === chosenTemplateId
    );

    if (!chosenJobAssessment) {
      return json(400, {
        error: "El template solicitado no está asignado a esta vacante",
      });
    }

    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: chosenTemplateId },
      select: {
        id: true,
        title: true,
        timeLimit: true,
        type: true,
        difficulty: true,
      },
    });

    if (!template) {
      return json(404, { error: "Template no encontrado" });
    }

    const assessmentType = template.type;
    const difficulty = template.difficulty;

    let recruiterProfileId: string | null = null;

    if (user.id) {
      const recruiterProfile = await prisma.recruiterProfile.findUnique({
        where: { userId: user.id },
        select: { id: true, companyId: true },
      });

      if (recruiterProfile?.companyId === application.job.company.id) {
        recruiterProfileId = recruiterProfile.id;
      }
    }

    let createdInvite = false;
    let reusedInvite = false;
    let rotated = false;
    let creditsCharged = false;

    const invite = await prisma.$transaction(async (tx) => {
      let localInvite = await tx.assessmentInvite.findFirst({
        where: {
          applicationId: application.id,
          templateId: template.id,
        },
        select: selectInvite,
      });

      const enforceCredits = !isAdmin && isCreditsEnforced();
      const companyId = application.job.company.id;

      if (!localInvite) {
        const token = crypto.randomBytes(32).toString("hex");

        try {
          localInvite = await tx.assessmentInvite.create({
            data: {
              application: { connect: { id: application.id } },
              job: { connect: { id: application.jobId } },
              candidate: { connect: { id: application.candidateId } },
              template: { connect: { id: template.id } },
              token,
              status: "SENT",
              expiresAt: newExpiresAt,
              sentAt: null,
              invitedBy: user.id ? { connect: { id: user.id } } : undefined,
            },
            select: selectInvite,
          });

          createdInvite = true;
          reusedInvite = false;

          if (enforceCredits) {
            const updated = await tx.company.updateMany({
              where: {
                id: companyId,
                assessmentCredits: { gt: 0 },
              },
              data: {
                assessmentCredits: { decrement: 1 },
              },
            });

            if (updated.count === 0) {
              throw new Error("NO_CREDITS");
            }

            await tx.assessmentInviteChargeLedger.create({
              data: {
                inviteId: localInvite.id,
                companyId,
                kind: "ASSESSMENT_INVITE",
                cycle: getCurrentBillingCycle(),
                amount: ONE_CREDIT,
                status: "RESERVED",
                reservedAmount: ONE_CREDIT,
                assessmentType,
                difficulty,
                meta: JSON.parse(
                  JSON.stringify({
                    reservedAt: new Date().toISOString(),
                    type: "RESERVE",
                    recruiterProfileId: recruiterProfileId ?? null,
                  })
                ),
              },
            });

            creditsCharged = true;
          }
        } catch (e: unknown) {
          const isP2002 =
            typeof e === "object" &&
            e !== null &&
            "code" in e &&
            String((e as any).code) === "P2002";

          if (!isP2002) throw e;

          localInvite = await tx.assessmentInvite.findFirst({
            where: {
              applicationId: application.id,
              templateId: template.id,
            },
            select: selectInvite,
          });

          reusedInvite = true;
        }
      }

      if (!localInvite) {
        throw new Error("INVITE_CREATE_FAILED");
      }

      if (!isInviteReusable(localInvite, now)) {
        const rotatedToken = crypto.randomBytes(32).toString("hex");
        rotated = true;

        localInvite = await tx.assessmentInvite.update({
          where: { id: localInvite.id },
          data: {
            token: rotatedToken,
            status: "SENT",
            expiresAt: newExpiresAt,
            sentAt: null,
            invitedBy: user.id ? { connect: { id: user.id } } : undefined,
          },
          select: selectInvite,
        });
      } else {
        const s = String(localInvite.status || "").toUpperCase();
        if (s === "SENT" || s === "STARTED") {
          localInvite = await tx.assessmentInvite.update({
            where: { id: localInvite.id },
            data: {
              expiresAt: newExpiresAt,
              invitedBy: user.id ? { connect: { id: user.id } } : undefined,
            },
            select: selectInvite,
          });
        }
      }

      return localInvite;
    });

    const baseUrl = buildBaseUrl(request);
    const inviteUrl = new URL(`/assessments/${template.id}`, baseUrl);
    inviteUrl.searchParams.set("token", invite.token);
    const inviteUrlString = inviteUrl.toString();

    let emailStatus: EmailStatus = "skipped";
    let emailError: string | null = null;

    const candidateEmail = application.candidate?.email
      ? String(application.candidate.email)
      : "";

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
          inviteUrl: inviteUrlString,
          dedupeKey: invite.id,
        });

        if (typeof r === "object" && r !== null && "ok" in r && r.ok === true) {
          emailStatus = "sent";
        } else if (
          typeof r === "object" &&
          r !== null &&
          "skipped" in r &&
          r.skipped === true
        ) {
          emailStatus = "skipped";
        } else if (
          typeof r === "object" &&
          r !== null &&
          "error" in r &&
          typeof r.error === "string"
        ) {
          emailStatus = "failed";
          emailError = r.error;
        }
      } catch (err: unknown) {
        emailStatus = "failed";
        emailError = err instanceof Error ? err.message : "send_failed";
      }
    } else {
      emailStatus = "skipped";
      emailError = "candidate_email_missing";
    }

    if (emailStatus === "sent" || emailStatus === "skipped") {
      await prisma.assessmentInvite.update({
        where: { id: invite.id },
        data: { sentAt: new Date() },
      });
    }

    await NotificationService.create({
      userId: application.candidateId,
      type: "ASSESSMENT_INVITATION",
      metadata: {
        jobTitle: application.job.title,
        jobId: application.jobId,
        assessmentId: invite.id,
        templateId: template.id,
        dueDate: invite.expiresAt || newExpiresAt,
        inviteUrl: inviteUrlString,
      },
    }).catch((notifErr) => {
      console.warn(
        "[POST /api/applications/assessment-invite] Notification failed:",
        notifErr
      );
    });

    const activeNotExpiredWhere: Prisma.AssessmentAttemptWhereInput = {
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    const existingAttemptByInvite = await prisma.assessmentAttempt.findFirst({
      where: {
        inviteId: invite.id,
        ...activeNotExpiredWhere,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        startedAt: true,
        expiresAt: true,
      },
    });

    const existingAttempt =
      existingAttemptByInvite ??
      (await prisma.assessmentAttempt.findFirst({
        where: {
          applicationId: application.id,
          candidateId: application.candidateId,
          templateId: template.id,
          ...activeNotExpiredWhere,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          startedAt: true,
          expiresAt: true,
        },
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
        creditsCharged,
        attemptId: existingAttempt?.id ?? null,
        inviteUrl: inviteUrlString,
        emailStatus,
        emailError,
        isRequired: Boolean(chosenJobAssessment.isRequired),
        minScore: chosenJobAssessment.minScore ?? null,
        ms: Date.now() - t0,
      });
    }

    return json(200, {
      ok: true,
      template: {
        id: template.id,
        title: template.title,
        timeLimit: template.timeLimit,
      },
      jobAssessment: {
        id: chosenJobAssessment.id,
        isRequired: Boolean(chosenJobAssessment.isRequired),
        minScore: chosenJobAssessment.minScore ?? null,
      },
      attempt: existingAttempt ?? null,
      invite: {
        id: invite.id,
        status: invite.status,
        sentAt: invite.sentAt,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        updatedAt: invite.updatedAt,
      },
      inviteUrl: inviteUrlString,
      emailStatus,
      emailError,
      meta: { reusedInvite, createdInvite, rotated, creditsCharged },
    });
  } catch (e: unknown) {
    console.error("[ASSESSMENT INVITE] ERROR", e);

    const msg = e instanceof Error ? e.message : String(e);

    if (msg === "NO_CREDITS") {
      return json(402, {
        error: "Sin créditos para enviar assessments",
        code: "NO_CREDITS",
      });
    }

    const isDev = process.env.NODE_ENV !== "production";
    return json(500, {
      error: "Error al enviar invitación",
      ...(isDev ? { detail: msg } : {}),
    });
  }
}