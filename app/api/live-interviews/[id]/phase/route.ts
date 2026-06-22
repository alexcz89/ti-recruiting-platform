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

const PhaseSchema = z.object({
  action: z.enum(["start_coding", "end_coding", "start_qa", "cancel"]),
});

// PATCH /api/live-interviews/[id]/phase — recruiter transitions the session state
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { id: string; role: string; companyId?: string };
  if (!["RECRUITER", "ADMIN"].includes(user.role)) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = PhaseSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Acción inválida" }, 400);

  const interview = await prisma.liveInterview.findUnique({ where: { id: params.id } });
  if (!interview) return json({ error: "No encontrado" }, 404);
  if (user.companyId && interview.companyId !== user.companyId) return json({ error: "Forbidden" }, 403);

  const { action } = parsed.data;
  const now = new Date();

  const transitions: Record<string, { status: string; field: string }> = {
    start_coding: { status: "CODING_PHASE", field: "codingStartedAt" },
    end_coding: { status: "REVIEW_PAUSE", field: "codingEndedAt" },
    start_qa: { status: "QA_PHASE", field: "qaStartedAt" },
    cancel: { status: "CANCELLED", field: "completedAt" },
  };

  const t = transitions[action];

  const updated = await prisma.liveInterview.update({
    where: { id: params.id },
    data: {
      status: t.status as any,
      [t.field]: now,
    },
  });

  return json({ interview: updated });
}
