// app/api/dashboard/assessments/templates/route.ts
import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_QUESTIONS = 20;

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const role = String((session.user as any).role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return json(403, { error: "Sin permisos" });
    }

    const companyId = (session.user as any).companyId as string | undefined;

    const { searchParams } = new URL(req.url);
    const typeFilter   = searchParams.get("type");     // "MCQ" | "CODING" | "MIXED"
    const langFilter   = searchParams.get("language"); // "javascript" | "python" | "cpp"
    const scopeFilter  = searchParams.get("scope");    // "global" | "custom" | undefined = all

    const where: any = {
      isActive: true,
      OR: [
        { isGlobal: true },
        ...(companyId ? [{ companyId }] : []),
      ],
    };

    if (typeFilter)  where.type     = typeFilter;
    if (langFilter)  where.language = langFilter;
    if (scopeFilter === "global") where.isGlobal = true;
    if (scopeFilter === "custom") { where.isGlobal = false; where.companyId = companyId; }

    const templates = await prisma.assessmentTemplate.findMany({
      where,
      orderBy: [{ difficulty: "asc" }, { title: "asc" }],
      select: {
        id: true, title: true, slug: true, description: true,
        type: true, difficulty: true, language: true,
        isGlobal: true, companyId: true,
        totalQuestions: true, passingScore: true, timeLimit: true,
        sections: true,
        _count: { select: { questions: true } },
      },
    });

    return json(200, { templates });
  } catch (e: any) {
    console.error("[GET /api/dashboard/assessments/templates]", e);
    return json(500, { error: "Error interno" });
  }
}

// ── POST: crear template personalizado del reclutador ──
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const role = String((session.user as any).role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return json(403, { error: "Sin permisos" });
    }

    const companyId = (session.user as any).companyId as string | undefined;
    if (!companyId) return json(400, { error: "Sin empresa asociada" });

    const body = await req.json();
    const { title, description, type, difficulty, language, passingScore, timeLimit, questions } = body;

    // Validaciones
    if (!title?.trim())        return json(400, { error: "El título es requerido" });
    if (!type)                 return json(400, { error: "El tipo es requerido" });
    if (!difficulty)           return json(400, { error: "La dificultad es requerida" });
    if (!questions?.length)    return json(400, { error: "Agrega al menos una pregunta" });
    if (questions.length > MAX_QUESTIONS) return json(400, { error: `Máximo ${MAX_QUESTIONS} preguntas` });
    if (!passingScore || passingScore < 1 || passingScore > 100) return json(400, { error: "El puntaje mínimo debe ser entre 1 y 100" });
    if (!timeLimit || timeLimit < 5 || timeLimit > 180)          return json(400, { error: "El tiempo debe ser entre 5 y 180 minutos" });

    // Slug único basado en título + companyId + timestamp
    const slugBase = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);
    const slug = `${slugBase}-${companyId.slice(-6)}-${Date.now()}`;

    // Agrupar preguntas en secciones
    const sectionMap: Record<string, number> = {};
    for (const q of questions) {
      const sec = q.section || "General";
      sectionMap[sec] = (sectionMap[sec] || 0) + 1;
    }
    const sections = Object.entries(sectionMap).map(([name, count]) => ({ name, questions: count }));

    const template = await prisma.assessmentTemplate.create({
      data: {
        title: title.trim(),
        slug,
        description: description?.trim() || null,
        type,
        difficulty,
        language: language || null,
        passingScore: Number(passingScore),
        timeLimit: Number(timeLimit),
        totalQuestions: questions.length,
        sections,
        isGlobal: false,
        companyId,
        isActive: true,
        shuffleQuestions: true,
        allowRetry: false,
        maxAttempts: 1,
        penalizeWrong: false,
      },
    });

    // Crear preguntas
    for (const q of questions) {
      await prisma.assessmentQuestion.create({
        data: {
          templateId: template.id,
          questionText: q.questionText,
          section: q.section || "General",
          difficulty: q.difficulty || difficulty,
          tags: q.tags || [],
          type: q.type || "MULTIPLE_CHOICE",
          options: q.options || [],
          codeSnippet: q.codeSnippet || null,
          allowMultiple: q.allowMultiple || false,
          explanation: q.explanation || null,
          isActive: true,
        },
      });
    }

    return json(201, { template: { id: template.id, slug: template.slug } });
  } catch (e: any) {
    console.error("[POST /api/dashboard/assessments/templates]", e);
    return json(500, { error: "Error interno" });
  }
}