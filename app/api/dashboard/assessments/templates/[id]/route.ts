// app/api/dashboard/assessments/templates/[id]/route.ts
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

async function getAuthContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  const role = String(user.role ?? "").toUpperCase();
  if (role !== "RECRUITER" && role !== "ADMIN") return null;
  return { user, role, companyId: user.companyId as string | undefined };
}

// ── GET /api/dashboard/assessments/templates/[id] ──
// Carga un template con sus preguntas y test cases (para el builder en modo edición)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return json(401, { error: "No autorizado" });

    const { companyId, role } = auth;

    const template = await prisma.assessmentTemplate.findFirst({
      where: {
        id: params.id,
        isActive: true,
        ...(role !== "ADMIN"
          ? {
              OR: [
                { isGlobal: true },
                ...(companyId ? [{ companyId }] : []),
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        difficulty: true,
        language: true,
        passingScore: true,
        timeLimit: true,
        allowRetry: true,
        maxAttempts: true,
        isGlobal: true,
        companyId: true,
        questions: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            type: true,
            questionText: true,
            section: true,
            difficulty: true,
            explanation: true,
            options: true,
            allowMultiple: true,
            codeSnippet: true,
            starterCode: true,
            language: true,
            allowedLanguages: true,
            testCases: {
              orderBy: { orderIndex: "asc" },
              select: {
                id: true,
                input: true,
                expectedOutput: true,
                isHidden: true,
                points: true,
              },
            },
          },
        },
      },
    });

    if (!template) return json(404, { error: "Template no encontrado" });

    return json(200, template);
  } catch (e: any) {
    console.error("[GET /api/dashboard/assessments/templates/[id]]", e);
    return json(500, { error: "Error interno" });
  }
}

// ── PUT /api/dashboard/assessments/templates/[id] ──
// Actualiza un template existente desde el builder en modo edición
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return json(401, { error: "No autorizado" });

    const { companyId, role } = auth;

    const existing = await prisma.assessmentTemplate.findFirst({
      where: {
        id: params.id,
        isActive: true,
        ...(role !== "ADMIN" && companyId ? { companyId } : {}),
      },
      select: { id: true, companyId: true, isGlobal: true },
    });

    if (!existing) return json(404, { error: "Template no encontrado o sin permisos" });

    if (existing.isGlobal && role !== "ADMIN") {
      return json(403, { error: "Los templates globales no son editables" });
    }

    const body = await req.json();
    const {
      title, description, type, difficulty, language,
      passingScore, timeLimit, allowRetry, maxAttempts, questions,
    } = body;

    if (!title?.trim())     return json(400, { error: "El título es requerido" });
    if (!type)              return json(400, { error: "El tipo es requerido" });
    if (!difficulty)        return json(400, { error: "La dificultad es requerida" });
    if (!questions?.length) return json(400, { error: "Agrega al menos una pregunta" });
    if (questions.length > MAX_QUESTIONS)
      return json(400, { error: `Máximo ${MAX_QUESTIONS} preguntas` });
    if (!passingScore || passingScore < 1 || passingScore > 100)
      return json(400, { error: "El puntaje mínimo debe ser entre 1 y 100" });
    if (!timeLimit || timeLimit < 5 || timeLimit > 180)
      return json(400, { error: "El tiempo debe ser entre 5 y 180 minutos" });

    // Recalcular secciones
    const sectionMap: Record<string, number> = {};
    for (const q of questions) {
      const sec = q.section || "General";
      sectionMap[sec] = (sectionMap[sec] || 0) + 1;
    }
    const sections = Object.entries(sectionMap).map(([name, count]) => ({ name, questions: count }));

    await prisma.$transaction(async (tx) => {
      // 1) Actualizar template
      await tx.assessmentTemplate.update({
        where: { id: params.id },
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          type,
          difficulty,
          language: language || null,
          passingScore: Number(passingScore),
          timeLimit: Number(timeLimit),
          totalQuestions: questions.length,
          sections,
          allowRetry: Boolean(allowRetry),
          maxAttempts: Number(maxAttempts ?? 1),
        },
      });

      // 2) Soft-delete preguntas existentes
      await tx.assessmentQuestion.updateMany({
        where: { templateId: params.id },
        data: { isActive: false },
      });

      // 3) Crear nuevas preguntas con language y allowedLanguages correctos
      for (const q of questions) {
        const isCoding = q.type === "CODING";
        const testCasesRaw: any[] = Array.isArray(q.testCases) ? q.testCases : [];

        await tx.assessmentQuestion.create({
          data: {
            templateId: params.id,
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
            // ✅ Propaga language del template a cada pregunta CODING
            language: isCoding ? (language || null) : null,
            allowedLanguages: isCoding && language ? JSON.stringify([language]) : null,
            ...(isCoding && testCasesRaw.length > 0
              ? {
                  testCases: {
                    create: testCasesRaw.map((tc: any, idx: number) => ({
                      input: String(tc.input ?? ""),
                      expectedOutput: String(tc.expectedOutput ?? ""),
                      isHidden: Boolean(tc.isHidden ?? false),
                      points: Number(tc.points ?? 10),
                      orderIndex: idx,
                    })),
                  },
                }
              : {}),
          },
        });
      }
    });

    return json(200, { ok: true, id: params.id });
  } catch (e: any) {
    console.error("[PUT /api/dashboard/assessments/templates/[id]]", e);
    return json(500, { error: "Error interno" });
  }
}

// ── DELETE /api/dashboard/assessments/templates/[id] ──
// Soft-delete del template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return json(401, { error: "No autorizado" });

    const { companyId, role } = auth;

    const existing = await prisma.assessmentTemplate.findFirst({
      where: {
        id: params.id,
        isActive: true,
        ...(role !== "ADMIN" && companyId ? { companyId, isGlobal: false } : {}),
      },
      select: { id: true },
    });

    if (!existing) return json(404, { error: "Template no encontrado o sin permisos" });

    await prisma.assessmentTemplate.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return json(200, { ok: true });
  } catch (e: any) {
    console.error("[DELETE /api/dashboard/assessments/templates/[id]]", e);
    return json(500, { error: "Error interno" });
  }
}