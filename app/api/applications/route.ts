// app/api/applications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { getSessionCompanyId } from '@/lib/server/session';
import { sendApplicationEmail } from '@/lib/server/mailer';
import { NotificationService } from '@/lib/notifications/service';
// ✅ NUEVO: Sistema de créditos
import { reserveCredits, hasAvailableCredits } from '@/lib/assessments/credits';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// ==============================
// GET /api/applications?jobId=...
// Reclutadores/Admin: solo ven applications de su empresa
// ==============================
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return noStoreJson({ error: "Unauthorized" }, 401);
    
    const user = session.user as any;
    const role = String(user?.role || "");
    const isAdmin = role === "ADMIN";
    const isRecruiter = role === "RECRUITER";
    if (!isAdmin && !isRecruiter) return noStoreJson({ error: "Unauthorized" }, 403);

    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId && !isAdmin) return noStoreJson({ error: "Sin empresa asociada" }, 403);

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    const where: any = isAdmin ? {} : { job: { companyId } };
    if (jobId) where.jobId = jobId;

    const apps = await prisma.application.findMany({
      where,
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

    return noStoreJson(apps, 200);
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
// ✅ ACTUALIZADO: Ahora envía evaluaciones automáticamente si la vacante las tiene
// ==============================
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sUser = session?.user as any | undefined;
    if (!sUser) return noStoreJson({ error: "Debe iniciar sesión para postular" }, 401);

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
    if (!candidateId) return noStoreJson({ error: "No se pudo identificar al candidato" }, 400);

    const ctype = req.headers.get("content-type") || "";
    let jobId = "";
    let coverLetter = "";
    let resumeUrl: string | null = null;

    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({} as any));
      jobId = String(body.jobId || "");
      coverLetter = String(body.coverLetter || "");
      resumeUrl = body.resumeUrl ? String(body.resumeUrl) : null;
    } else {
      const form = await req.formData();
      jobId = String(form.get("jobId") || "");
      coverLetter = String(form.get("coverLetter") || "");
      const r = form.get("resumeUrl");
      resumeUrl = r ? String(r) : null;
    }

    if (!jobId) return noStoreJson({ error: "jobId es requerido" }, 400);

    // ✅ MODIFICADO: Cargar evaluaciones asociadas al job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        companyId: true,
        recruiterId: true,
        company: { select: { name: true } },
        // ✅ NUEVO: Cargar assessments
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
    if (!job) return noStoreJson({ error: "Vacante no encontrada" }, 404);

    const exists = await prisma.application.findFirst({
      where: { jobId, candidateId },
      select: { id: true },
    });
    if (exists) return noStoreJson({ error: "Ya postulaste a esta vacante" }, 409);

    const candidate = await prisma.user.findUnique({
      where: { id: candidateId },
      select: { 
        id: true, 
        name: true, 
        firstName: true,
        lastName: true,
        email: true, 
        resumeUrl: true 
      },
    });
    if (!candidate) return noStoreJson({ error: "Candidato no encontrado" }, 404);

    const effectiveResumeUrl =
      (resumeUrl && resumeUrl.trim() !== "" ? resumeUrl : null) ??
      (candidate.resumeUrl && candidate.resumeUrl.trim() !== "" ? candidate.resumeUrl : null);

    // Crear la aplicación
    const app = await prisma.application.create({
      data: {
        jobId,
        candidateId,
        coverLetter,
        resumeUrl: effectiveResumeUrl,
      },
      select: { id: true },
    });

    // ✅ NUEVO: Manejo de evaluaciones automáticas
    const hasAssessment = job.assessments.length > 0;
    const assessment = hasAssessment ? job.assessments[0] : null;
    let assessmentInvited = false;
    let assessmentWarning: string | null = null;

    if (hasAssessment && assessment) {
      // Verificar si hay créditos
      const hasCredits = await hasAvailableCredits(job.companyId, 0.5);

      if (hasCredits) {
        try {
          // Generar token único
          const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

          // Crear invite
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

          // Reservar créditos
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

            // TODO: Enviar email con evaluación
            // await sendAssessmentInviteEmail({ ... });
          } else {
            // Falló reservar créditos, eliminar invite
            await prisma.assessmentInvite.delete({ where: { id: invite.id } });
            assessmentWarning = reserveResult.message || "Error al reservar créditos";
            console.error(
              `[POST /api/applications] ✗ Failed to reserve credits, invite deleted: ${assessmentWarning}`
            );
          }
        } catch (assessmentErr) {
          console.error("[POST /api/applications] Assessment invite error:", assessmentErr);
          assessmentWarning = "Error al crear invitación de evaluación";
        }
      } else {
        assessmentWarning = "La empresa no tiene créditos disponibles";
        console.warn(
          `[POST /api/applications] ⚠️ Company ${job.companyId} has no credits for assessment`
        );
      }
    }

    // ✅ Correo de confirmación (no bloqueante)
    (async () => {
      try {
        if (!candidate.email) return;
        await sendApplicationEmail({
          to: candidate.email,
          candidateName: candidate.name || candidate.firstName || "Candidato",
          jobTitle: job.title,
          applicationId: app.id,
        });
      } catch (mailErr) {
        console.warn("[POST /api/applications] sendApplicationEmail failed:", mailErr);
      }
    })();

    // 🔔 Notificar al recruiter
    (async () => {
      try {
        if (!job.recruiterId) return;
        
        // ✅ CORREGIDO: Construir metadata con tipo correcto
        const metadata: Record<string, any> = {
          candidateName: candidate.name || candidate.email || 'Candidato',
          candidateId: candidate.id,
          jobTitle: job.title,
          jobId: job.id,
          applicationId: app.id,
        };
        
        // Solo agregar assessmentInvited si es true
        if (assessmentInvited) {
          metadata.assessmentInvited = assessmentInvited;
        }
        
        await NotificationService.create({
          userId: job.recruiterId,
          type: 'NEW_APPLICATION',
          metadata: metadata as any,
        });
      } catch (notifErr) {
        console.warn("[POST /api/applications] Notification failed:", notifErr);
      }
    })();

    // ✅ NUEVO: Respuesta con info de evaluación
    const response: any = { ok: true, applicationId: app.id };
    
    if (hasAssessment) {
      response.assessment = {
        invited: assessmentInvited,
        warning: assessmentWarning,
      };
      
      if (assessmentInvited) {
        response.message = "Aplicación enviada. Recibirás un correo con la evaluación técnica.";
      } else if (assessmentWarning) {
        response.message = `Aplicación enviada. ${assessmentWarning}`;
      }
    }

    return noStoreJson(response, 201);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return noStoreJson({ error: "Ya postulaste a esta vacante" }, 409);
    }
    console.error("[POST /api/applications]", err);
    return noStoreJson({ error: "Internal Server Error" }, 500);
  }
}