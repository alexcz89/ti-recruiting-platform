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

// GET /api/live-interviews/questions?techStack=Java&seniority=MID
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { role: string };
  if (!["RECRUITER", "ADMIN"].includes(user.role)) {
    return json({ error: "Forbidden" }, 403);
  }

  const url = new URL(req.url);
  const techStack = url.searchParams.get("techStack") ?? undefined;
  const seniority = url.searchParams.get("seniority") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;

  const questions = await prisma.liveInterviewQuestion.findMany({
    where: {
      isActive: true,
      ...(techStack ? { techStack } : {}),
      ...(seniority ? { seniority: seniority as any } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ techStack: "asc" }, { orderIndex: "asc" }],
  });

  return json({ questions });
}

const CreateQuestionSchema = z.object({
  techStack: z.string().optional(),
  seniority: z.enum(["JUNIOR", "MID", "SENIOR", "LEAD"]).optional(),
  category: z.string().optional(),
  question: z.string().min(5).max(1000),
  expectedTopics: z.array(z.string()).default([]),
  orderIndex: z.number().int().default(0),
});

// POST /api/live-interviews/questions — admin creates a question in the bank
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return json({ error: "No autorizado" }, 401);

  const user = session.user as { role: string; companyId?: string };
  if (!["RECRUITER", "ADMIN"].includes(user.role)) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateQuestionSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Datos inválidos", issues: parsed.error.flatten() }, 400);

  const question = await prisma.liveInterviewQuestion.create({
    data: {
      ...parsed.data,
      companyId: user.companyId ?? null,
    },
  });

  return json({ question }, 201);
}
