// app/api/dashboard/assessments/templates/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const role = String((session.user as any).role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return json(403, { error: "Sin permisos" });
    }

    const templates = await prisma.assessmentTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ difficulty: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        type: true,
        difficulty: true,
        totalQuestions: true,
        passingScore: true,
        timeLimit: true,
        sections: true,
        _count: {
          select: { questions: true },
        },
      },
    });

    return json(200, { templates });
  } catch (e: any) {
    console.error("[GET /api/dashboard/assessments/templates]", e);
    return json(500, { error: "Error interno" });
  }
}