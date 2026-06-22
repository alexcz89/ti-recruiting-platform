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

const SubmitSchema = z.object({
  githubUrl: z.string().url({ message: "URL de GitHub inválida" }),
  liveUrl: z.string().url({ message: "URL del deploy inválida" }).optional().or(z.literal("")),
});

// PATCH /api/live-interviews/[id]/submit — candidate submits their deliverables
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { id: string; role: string };

  const interview = await prisma.liveInterview.findUnique({ where: { id: params.id } });
  if (!interview) return json({ error: "No encontrado" }, 404);

  // Only the candidate assigned to this interview can submit
  if (user.role === "CANDIDATE" && interview.candidateId !== user.id) {
    return json({ error: "Forbidden" }, 403);
  }
  // Recruiters can also set URLs on behalf (for testing or corrections)
  if (!["CANDIDATE", "RECRUITER", "ADMIN"].includes(user.role)) {
    return json({ error: "Forbidden" }, 403);
  }

  if (interview.submittedAt) {
    return json({ error: "Ya fueron entregados los links" }, 409);
  }

  const body = await req.json().catch(() => null);
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Datos inválidos", issues: parsed.error.flatten() }, 400);

  const updated = await prisma.liveInterview.update({
    where: { id: params.id },
    data: {
      githubUrl: parsed.data.githubUrl,
      liveUrl: parsed.data.liveUrl || null,
      submittedAt: new Date(),
      status: "REVIEW_PAUSE",
    },
  });

  return json({ interview: updated });
}
