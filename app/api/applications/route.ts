// app/api/applications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { getSessionCompanyId } from '@/lib/server/session';
import { sendApplicationEmail } from '@/lib/server/mailer';

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

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        companyId: true,
        company: { select: { name: true } },
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
      select: { id: true, name: true, email: true, resumeUrl: true },
    });
    if (!candidate) return noStoreJson({ error: "Candidato no encontrado" }, 404);

    const effectiveResumeUrl =
      (resumeUrl && resumeUrl.trim() !== "" ? resumeUrl : null) ??
      (candidate.resumeUrl && candidate.resumeUrl.trim() !== "" ? candidate.resumeUrl : null);

    const app = await prisma.application.create({
      data: {
        jobId,
        candidateId,
        coverLetter,
        resumeUrl: effectiveResumeUrl,
      },
      select: { id: true },
    });

    // ✅ Solo correo de confirmación (no bloqueante)
    (async () => {
      try {
        if (!candidate.email) return;
        await sendApplicationEmail({
          to: candidate.email,
          candidateName: candidate.name || "Candidato",
          jobTitle: job.title,
          applicationId: app.id,
        });
      } catch (mailErr) {
        console.warn("[POST /api/applications] sendApplicationEmail failed:", mailErr);
      }
    })();

    return noStoreJson({ ok: true, applicationId: app.id }, 201);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return noStoreJson({ error: "Ya postulaste a esta vacante" }, 409);
    }
    console.error("[POST /api/applications]", err);
    return noStoreJson({ error: "Internal Server Error" }, 500);
  }
}
