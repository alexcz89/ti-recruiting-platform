// app/api/applications/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionCompanyId } from "@/lib/session"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendApplicationEmail } from "@/lib/mailer" // 👈 NUEVO

// ==============================
// GET /api/applications?jobId=...
// Reclutadores: solo ven applications de su empresa
// ==============================
export async function GET(req: NextRequest) {
  try {
    const companyId = await getSessionCompanyId().catch(() => null)
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")

    const where: any = { job: { companyId } }
    if (jobId) where.jobId = jobId

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
            frontend: true,
            backend: true,
            mobile: true,
            cloud: true,
            database: true,
            certifications: true,
            resumeUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(apps)
  } catch (err) {
    console.error("[GET /api/applications]", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// ==============================
// POST /api/applications
// Candidatos: deben estar logueados (registrados) para poder aplicar
// Body JSON o formData: { jobId, coverLetter?, resumeUrl? }
// ==============================
export async function POST(req: NextRequest) {
  try {
    // 1) Sesión obligatoria
    const session = await getServerSession(authOptions)
    const sUser = session?.user as any | undefined
    if (!sUser) {
      return NextResponse.json({ error: "Debe iniciar sesión para postular" }, { status: 401 })
    }

    // 2) Solo candidatos
    if (sUser.role !== "CANDIDATE") {
      return NextResponse.json({ error: "Solo candidatos pueden postular" }, { status: 403 })
    }

    // 3) Identificar candidateId (desde token; si falta, por email)
    let candidateId: string | null = sUser.id ?? null
    if (!candidateId && sUser.email) {
      const found = await prisma.user.findUnique({
        where: { email: sUser.email },
        select: { id: true },
      })
      candidateId = found?.id ?? null
    }
    if (!candidateId) {
      return NextResponse.json({ error: "No se pudo identificar al candidato" }, { status: 400 })
    }

    // 4) Parse body (JSON o form-data)
    const ctype = req.headers.get("content-type") || ""
    let jobId = ""
    let coverLetter = ""
    let resumeUrl: string | null = null

    if (ctype.includes("application/json")) {
      const body = await req.json()
      jobId = String(body.jobId || "")
      coverLetter = String(body.coverLetter || "")
      resumeUrl = body.resumeUrl ? String(body.resumeUrl) : null
    } else {
      const form = await req.formData()
      jobId = String(form.get("jobId") || "")
      coverLetter = String(form.get("coverLetter") || "")
      const r = form.get("resumeUrl")
      resumeUrl = r ? String(r) : null
    }

    if (!jobId) {
      return NextResponse.json({ error: "jobId es requerido" }, { status: 400 })
    }

    // 5) Validar vacante
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, companyId: true },
    })
    if (!job) {
      return NextResponse.json({ error: "Vacante no encontrada" }, { status: 404 })
    }

    // 6) Evitar duplicado (candidato + job)
    const exists = await prisma.application.findFirst({
      where: { jobId, candidateId },
      select: { id: true },
    })
    if (exists) {
      return NextResponse.json({ error: "Ya postulaste a esta vacante" }, { status: 409 })
    }

    // 7) Obtener datos del candidato (para fallback de CV y correo)
    const candidate = await prisma.user.findUnique({
      where: { id: candidateId },
      select: { id: true, name: true, email: true, resumeUrl: true },
    })
    if (!candidate) {
      return NextResponse.json({ error: "Candidato no encontrado" }, { status: 404 })
    }

    const effectiveResumeUrl =
      (resumeUrl && resumeUrl.trim() !== "" ? resumeUrl : null) ??
      (candidate.resumeUrl && candidate.resumeUrl.trim() !== "" ? candidate.resumeUrl : null)

    // 8) Crear postulación
    const app = await prisma.application.create({
      data: {
        jobId,
        candidateId,
        coverLetter,
        resumeUrl: effectiveResumeUrl,
      },
    })

    // 9) Enviar correo de confirmación (no bloqueante)
    ;(async () => {
      try {
        await sendApplicationEmail({
          to: candidate.email,
          candidateName: candidate.name || "Candidato",
          jobTitle: job.title,
          applicationId: app.id,
        })
      } catch (mailErr) {
        console.warn("[POST /api/applications] sendApplicationEmail failed:", mailErr)
      }
    })()

    return NextResponse.json({ ok: true, applicationId: app.id }, { status: 201 })
  } catch (err: any) {
    // Manejo por si llega a lanzar P2002 (únicidad)
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Ya postulaste a esta vacante" }, { status: 409 })
    }
    console.error("[POST /api/applications]", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
