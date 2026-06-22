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

const CompleteSchema = z.object({
  codingScore: z.number().int().min(0).max(100),
  qaScore: z.number().int().min(0).max(100),
  interviewerNotes: z.string().max(5000).optional(),
  recommendation: z.enum(["HIRE", "MAYBE", "REJECT"]),
});

// PATCH /api/live-interviews/[id]/complete
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { id: string; role: string; companyId?: string };
  if (!["RECRUITER", "ADMIN"].includes(user.role)) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = CompleteSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Datos inválidos", issues: parsed.error.flatten() }, 400);

  const interview = await prisma.liveInterview.findUnique({ where: { id: params.id } });
  if (!interview) return json({ error: "No encontrado" }, 404);
  if (user.companyId && interview.companyId !== user.companyId) return json({ error: "Forbidden" }, 403);

  const { codingScore, qaScore, interviewerNotes, recommendation } = parsed.data;
  // Weighted: coding 60%, Q&A 40%
  const finalScore = Math.round(codingScore * 0.6 + qaScore * 0.4);

  const updated = await prisma.liveInterview.update({
    where: { id: params.id },
    data: {
      codingScore,
      qaScore,
      finalScore,
      interviewerNotes: interviewerNotes ?? null,
      recommendation,
      status: "COMPLETED",
      completedAt: new Date(),
      qaEndedAt: new Date(),
    },
  });

  return json({ interview: updated });
}
