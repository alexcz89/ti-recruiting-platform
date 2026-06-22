import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getInterview(id: string) {
  return prisma.liveInterview.findUnique({
    where: { id },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      interviewer: { select: { id: true, name: true, email: true } },
      job: { select: { id: true, title: true } },
      application: { select: { id: true, status: true } },
      qaScores: {
        include: {
          question: {
            select: {
              id: true,
              question: true,
              expectedTopics: true,
              category: true,
            },
          },
        },
        orderBy: { answeredAt: "asc" },
      },
    },
  });
}

// GET /api/live-interviews/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { id: string; role: string; companyId?: string };
  const interview = await getInterview(params.id);
  if (!interview) return json({ error: "No encontrado" }, 404);

  const isRecruiter = ["RECRUITER", "ADMIN"].includes(user.role);
  const isCandidate = user.role === "CANDIDATE" && interview.candidateId === user.id;

  if (!isRecruiter && !isCandidate) return json({ error: "Forbidden" }, 403);
  if (isRecruiter && user.companyId && interview.companyId !== user.companyId) {
    return json({ error: "Forbidden" }, 403);
  }

  // Candidates don't see internal notes or recommendation until COMPLETED
  if (isCandidate) {
    const { interviewerNotes, recommendation, qaScores, ...safe } = interview as any;
    return json({ interview: safe });
  }

  return json({ interview });
}
