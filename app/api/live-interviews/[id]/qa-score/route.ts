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

const ScoreSchema = z.object({
  questionId: z.string().cuid(),
  score: z.number().int().min(1).max(5),
  notes: z.string().max(1000).optional(),
});

// POST /api/live-interviews/[id]/qa-score — interviewer scores a Q&A answer
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { id: string; role: string; companyId?: string };
  if (!["RECRUITER", "ADMIN"].includes(user.role)) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = ScoreSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Datos inválidos", issues: parsed.error.flatten() }, 400);

  const interview = await prisma.liveInterview.findUnique({ where: { id: params.id } });
  if (!interview) return json({ error: "No encontrado" }, 404);
  if (user.companyId && interview.companyId !== user.companyId) return json({ error: "Forbidden" }, 403);

  const qaScore = await prisma.liveInterviewQAScore.upsert({
    where: {
      interviewId_questionId: {
        interviewId: params.id,
        questionId: parsed.data.questionId,
      },
    },
    update: {
      score: parsed.data.score,
      notes: parsed.data.notes ?? null,
      answeredAt: new Date(),
    },
    create: {
      interviewId: params.id,
      questionId: parsed.data.questionId,
      score: parsed.data.score,
      notes: parsed.data.notes ?? null,
      answeredAt: new Date(),
    },
  });

  return json({ qaScore });
}
