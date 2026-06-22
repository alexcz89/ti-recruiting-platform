import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const CreateSchema = z.object({
  applicationId: z.string().cuid(),
  jobId: z.string().cuid(),
  candidateId: z.string().cuid(),
  challengeTitle: z.string().min(1).max(200),
  challengeDescription: z.string().min(1),
  apiName: z.string().optional(),
  apiDocsUrl: z.string().url().optional().or(z.literal("")),
  videoCallUrl: z.string().url().optional().or(z.literal("")),
  codingMinutes: z.number().int().min(10).max(180).default(50),
  qaMinutes: z.number().int().min(10).max(120).default(40),
  scheduledAt: z.string().datetime().optional(),
  questionIds: z.array(z.string().cuid()).optional(),
});

// POST /api/live-interviews — Recruiter crea una sesión
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { id: string; role: string; companyId?: string };
  if (!["RECRUITER", "ADMIN"].includes(user.role)) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Datos inválidos", issues: parsed.error.flatten() }, 400);

  const data = parsed.data;

  // Verify the application belongs to this company
  const application = await prisma.application.findUnique({
    where: { id: data.applicationId },
    include: { job: { select: { companyId: true } } },
  });
  if (!application) return json({ error: "Aplicación no encontrada" }, 404);
  if (user.companyId && application.job.companyId !== user.companyId) {
    return json({ error: "Forbidden" }, 403);
  }

  const interview = await prisma.liveInterview.create({
    data: {
      applicationId: data.applicationId,
      jobId: data.jobId,
      candidateId: data.candidateId,
      interviewerId: user.id,
      companyId: application.job.companyId,
      challengeTitle: data.challengeTitle,
      challengeDescription: data.challengeDescription,
      apiName: data.apiName || null,
      apiDocsUrl: data.apiDocsUrl || null,
      videoCallUrl: data.videoCallUrl || null,
      codingMinutes: data.codingMinutes,
      qaMinutes: data.qaMinutes,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    },
  });

  return json({ interview }, 201);
}

// GET /api/live-interviews — list for the current recruiter's company
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { id: string; role: string; companyId?: string };
  if (!["RECRUITER", "ADMIN"].includes(user.role)) {
    return json({ error: "Forbidden" }, 403);
  }

  const url = new URL(req.url);
  const applicationId = url.searchParams.get("applicationId");

  const interviews = await prisma.liveInterview.findMany({
    where: {
      companyId: user.companyId,
      ...(applicationId ? { applicationId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      job: { select: { id: true, title: true } },
      qaScores: true,
    },
  });

  return json({ interviews });
}
