// app/api/applications/route.ts
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/prisma";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";
import { sendApplicationEmail } from "@/lib/server/mailer";
import { NotificationService } from "@/lib/notifications/service";
import { reserveCredits, hasAvailableCredits } from "@/lib/assessments/credits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CandidateSessionUser = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

type NotificationMetadata = {
  candidateName: string;
  candidateId: string;
  jobTitle: string;
  jobId: string;
  applicationId: string;
  assessmentInvited?: boolean;
};

type PostResponse = {
  ok: true;
  applicationId: string;
  assessment?: {
    invited: boolean;
    warning: string | null;
  };
  message?: string;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// ==============================
// GET /api/applications?jobId=...&limit=...&cursor=...
// Reclutadores/Admin: solo ven applications de su empresa
// ==============================
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return noStoreJson({ error: "Unauthorized" }, 401);

    const user = session.user as CandidateSessionUser;
    const role = String(user.role || "");
    const isAdmin = role === "ADMIN";
    const isRecruiter = role === "RECRUITER";

    if (!isAdmin && !isRecruiter) {
      return noStoreJson({ error: "Unauthorized" }, 403);
    }

    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId && !isAdmin) {
      return noStoreJson({ error: "Sin empresa asociada" }, 403);
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    const rawLimit = Number(searchParams.get("limit") || "50");
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.max(Math.floor(rawLimit), 1), 100)
        : 50;
    const cursor = searchParams.get("cursor") || undefined;

    const where: Prisma.ApplicationWhereInput = isAdmin
      ? {}
      : { job: { companyId: companyId ?? undefined } };

    if (jobId) {
      where.jobId = jobId;
    }

    const apps = await prisma.application.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        job: { select: { id: true, title: true } },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            location: true,
            resumeUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items = apps.slice(0, limit);
    const nextCursor = apps.length > limit ? apps[limit].id : null;

    return noStoreJson({ items, nextCursor }, 200);
  } catch (err) {
    console.error("[GET /api/applications]", err);
    return noStoreJson({ error: "Internal Server Error" }, 500);
  }
}

// ==============================
// POST /api/applications
// Candidatos: deben estar logueados para poder aplicar
// Body JSON o formData: { jobId, coverLetter?, resumeUrl? }
//
// Ahora envía evaluaciones automáticamente si la vacante las tiene
// ==============================
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sUser = session?.user as CandidateSessionUser | undefined;

    if (!sUser) {
      return noStoreJson(
        { error: "Debe iniciar sesión para postular" },
        401
      );
    }

    if (sUser.role !== "CANDIDATE") {
      return noStoreJson({ error: "Solo candidatos pueden postular" }, 403);
    }

    let candidateId: string | null = sUser.id ?? null;

    if (!candidateId && sUser.email) {
      const found = await prisma.user.findUnique({
        where: { email: sUser.email },
        select: { id: true },
      });
      candidateId = found?.id ?? null;
    }

    if (!candidateId) {
      return noStoreJson(
        { error: "No se pudo identificar al candidato" },
        400
      );
    }

    const ctype = req.headers.get("content-type") || "";
    let jobId = "";
    let coverLetter = "";
    let resumeUrl: string | null = null;

    if (ctype.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as
        | { jobId?: unknown; coverLetter?: unknown; resumeUrl?: unknown }
        | null;

      jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
      coverLetter =
        typeof body?.coverLetter === "string" ? body.coverLetter : "";
      resumeUrl =
        typeof body?.resumeUrl === "string" && body.resumeUrl.trim() !== ""
          ? body.resumeUrl
          : null;
    } else {
      const form = await req.formData();
      jobId = String(form.get("jobId") || "").trim();
      coverLetter = String(form.get("coverLetter") || "");
      const r = form.get("resumeUrl");
      resumeUrl = r ? String(r) : null;
    }

    if (!jobId) {
      return noStoreJson({ error: "jobId es requerido" }, 400);
    }

    if (coverLetter.length > 10000) {
      return noStoreJson(
        { error: "coverLetter excede el tamaño permitido" },
        400
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        companyId: true,
        recruiterId: true,
        company: { select: { name: true } },
        assessments: {
          where: { isRequired: true },
          include: {
            template: {
              select: {
                id: true,
                title: true,
                type: true,
                difficulty: true,
                timeLimit: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!job) {
      return noStoreJson({ error: "Vacante no encontrada" }, 404);
    }

    const exists = await prisma.application.findFirst({
      where: { jobId, candidateId },
      select: { id: true },
    });

    if (exists) {
      return noStoreJson({ error: "Ya postulaste a esta vacante" }, 409);
    }

    const candidate = await prisma.user.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        resumeUrl: true,
      },
    });

    if (!candidate) {
      return noStoreJson({ error: "Candidato no encontrado" }, 404);
    }

    const effectiveResumeUrl =
      (resumeUrl && resumeUrl.trim() !== "" ? resumeUrl : null) ??
      (candidate.resumeUrl && candidate.resumeUrl.trim() !== ""
        ? candidate.resumeUrl
        : null);

    const app = await prisma.application.create({
      data: {
        jobId,
        candidateId,
        coverLetter,
        resumeUrl: effectiveResumeUrl,
      },
      select: { id: true },
    });

    const hasAssessment = job.assessments.length > 0;
    const assessment = hasAssessment ? job.assessments[0] : null;
    let assessmentInvited = false;
    let assessmentWarning: string | null = null;

    if (hasAssessment && assessment) {
      const hasCredits = await hasAvailableCredits(job.companyId, 0.5);

      if (hasCredits) {
        try {
          const token = `inv_${randomUUID()}`;
          const expiresAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          );

          const invite = await prisma.assessmentInvite.create({
            data: {
              token,
              applicationId: app.id,
              jobId: job.id,
              candidateId,
              templateId: assessment.templateId,
              invitedById: job.recruiterId || undefined,
              status: "SENT",
              sentAt: new Date(),
              expiresAt,
            },
          });

          const reserveResult = await reserveCredits(
            job.companyId,
            invite.id,
            assessment.template.type,
            assessment.template.difficulty
          );

          if (reserveResult.success) {
            assessmentInvited = true;
            console.log(
              `[POST /api/applications] ✓ Assessment invite created and credits reserved ` +
                `(application: ${app.id}, invite: ${invite.id})`
            );
          } else {
            await prisma.assessmentInvite.delete({ where: { id: invite.id } });
            assessmentWarning =
              reserveResult.message || "Error al reservar créditos";
            console.error(
              `[POST /api/applications] ✗ Failed to reserve credits, invite deleted: ${assessmentWarning}`
            );
          }
        } catch (assessmentErr) {
          console.error(
            "[POST /api/applications] Assessment invite error:",
            assessmentErr
          );
          assessmentWarning = "Error al crear invitación de evaluación";
        }
      } else {
        assessmentWarning = "La empresa no tiene créditos disponibles";
        console.warn(
          `[POST /api/applications] ⚠️ Company ${job.companyId} has no credits for assessment`
        );
      }
    }

    const postSideEffects = [];

    if (candidate.email) {
      postSideEffects.push(
        sendApplicationEmail({
          to: candidate.email,
          candidateName:
            candidate.name || candidate.firstName || "Candidato",
          jobTitle: job.title,
          applicationId: app.id,
        }).catch((mailErr) => {
          console.warn(
            "[POST /api/applications] sendApplicationEmail failed:",
            mailErr
          );
        })
      );
    }

    if (job.recruiterId) {
      const metadata: NotificationMetadata = {
        candidateName: candidate.name || candidate.email || "Candidato",
        candidateId: candidate.id,
        jobTitle: job.title,
        jobId: job.id,
        applicationId: app.id,
      };

      if (assessmentInvited) {
        metadata.assessmentInvited = true;
      }

      postSideEffects.push(
        NotificationService.create({
          userId: job.recruiterId,
          type: "NEW_APPLICATION",
          metadata,
        }).catch((notifErr) => {
          console.warn(
            "[POST /api/applications] Notification failed:",
            notifErr
          );
        })
      );
    }

    await Promise.allSettled(postSideEffects);

    const response: PostResponse = {
      ok: true,
      applicationId: app.id,
    };

    if (hasAssessment) {
      response.assessment = {
        invited: assessmentInvited,
        warning: assessmentWarning,
      };

      if (assessmentInvited) {
        response.message =
          "Aplicación enviada. Recibirás un correo con la evaluación técnica.";
      } else if (assessmentWarning) {
        response.message = `Aplicación enviada. ${assessmentWarning}`;
      }
    }

    return noStoreJson(response, 201);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return noStoreJson({ error: "Ya postulaste a esta vacante" }, 409);
    }

    console.error("[POST /api/applications]", err);
    return noStoreJson({ error: "Internal Server Error" }, 500);
  }
}