import { NextRequest } from "next/server";
import { prisma } from "lib/prisma"; // o "@/lib/prisma" si configuraste paths
import bcrypt from "bcryptjs";

// GET /api/applications  -> lista todas las postulaciones con info de vacante y candidato
export async function GET() {
  const applications = await prisma.application.findMany({
    orderBy: { createdAt: "desc" },
    include: { job: true, candidate: true },
  });
  return Response.json({ applications });
}

// POST /api/applications -> crear una nueva postulación (tu código original)
export async function POST(req: NextRequest) {
  const ctype = req.headers.get("content-type") || "";
  let jobId = "";
  let email = "";
  let coverLetter = "";

  if (ctype.includes("application/json")) {
    const body = await req.json();
    jobId = body.jobId || "";
    email = body.email || "";
    coverLetter = body.coverLetter || "";
  } else {
    const form = await req.formData();
    jobId = String(form.get("jobId") || "");
    email = String(form.get("email") || "");
    coverLetter = String(form.get("coverLetter") || "");
  }

  if (!jobId || !email) {
    return new Response(JSON.stringify({ error: "Faltan campos" }), { status: 400 });
  }

  // Auto-crear candidato si no existe (MVP)
  const passwordHash = await bcrypt.hash("Candidate123!", 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, role: "CANDIDATE" }
  });

  const app = await prisma.application.create({
    data: { jobId, candidateId: user.id, coverLetter }
  });

  return Response.json({ ok: true, applicationId: app.id });
}
