// app/api/ai/assessment-builder/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { openai } from "@/lib/ai/openai";
import { AI_MODEL_SMART } from "@/lib/ai/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ error: "No autorizado" }, 401);

    const role = (session.user as any)?.role;
    if (role !== "RECRUITER" && role !== "ADMIN")
      return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { prompt, questionType, language, difficulty, count = 1 } = body;

    if (!prompt || !questionType)
      return json({ error: "Faltan campos: prompt y questionType" }, 400);

    const clampedCount = Math.min(Math.max(Number(count) || 1, 1), 5);
    const isCoding = questionType === "CODING";

    const difficultyLabel =
      difficulty === "JUNIOR" ? "Junior (básico)"
      : difficulty === "SENIOR" ? "Senior (avanzado)"
      : "Mid Level (intermedio)";

    const schema = isCoding
      ? `{
  "questions": [
    {
      "questionText": "enunciado claro del problema",
      "section": "sección temática",
      "difficulty": "${difficulty || "MID"}",
      "explanation": "explicación de la solución con el código correcto",
      "codeSnippet": "función esqueleto que el candidato debe completar",
      "allowedLanguages": ["${language || "python"}"],
      "testCases": [
        { "input": "valor exacto de entrada", "expectedOutput": "valor exacto de salida", "isHidden": false },
        { "input": "otro input", "expectedOutput": "otro output", "isHidden": false },
        { "input": "caso edge", "expectedOutput": "resultado edge", "isHidden": true },
        { "input": "caso difícil", "expectedOutput": "resultado difícil", "isHidden": true }
      ]
    }
  ]
}`
      : `{
  "questions": [
    {
      "questionText": "pregunta clara y técnicamente precisa",
      "section": "sección temática",
      "difficulty": "${difficulty || "MID"}",
      "explanation": "explicación de por qué cada opción es correcta o incorrecta",
      "options": [
        { "text": "opción correcta", "isCorrect": true },
        { "text": "opción incorrecta plausible", "isCorrect": false },
        { "text": "opción incorrecta plausible", "isCorrect": false },
        { "text": "opción incorrecta plausible", "isCorrect": false }
      ]
    }
  ]
}`;

    const systemContent = `Eres un experto en evaluaciones técnicas de reclutamiento IT especializado en México y Latinoamérica.
Generas preguntas técnicas de alta calidad para assessments de candidatos.
Responde ÚNICAMENTE con JSON válido. Sin texto adicional, sin markdown, sin backticks.
El JSON debe seguir exactamente el schema proporcionado.`;

    const userContent = isCoding
      ? `Genera ${clampedCount} pregunta(s) de código en ${language || "python"}, nivel ${difficultyLabel}.

Descripción: "${prompt}"

Requisitos:
- El enunciado debe describir un problema real con contexto claro
- El codeSnippet debe ser el esqueleto de la función (sin implementar), con comentarios de orientación
- Incluir exactamente 2 test cases visibles (isHidden: false) y 2 ocultos (isHidden: true)
- Los inputs y outputs deben ser valores exactos y verificables por el juez automático
- La explanation debe incluir la solución completa correcta

Schema esperado:
${schema}`
      : `Genera ${clampedCount} pregunta(s) de opción múltiple nivel ${difficultyLabel}${language ? ` sobre ${language}` : ""}.

Descripción: "${prompt}"

Requisitos:
- Exactamente 4 opciones por pregunta, exactamente 1 correcta
- Las opciones incorrectas deben ser técnicamente plausibles (no obvias)
- Preguntas basadas en situaciones reales de desarrollo

Schema esperado:
${schema}`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL_SMART,
      temperature: 0.7,
      max_tokens: 4000,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "";

    // Limpiar posible markdown accidental
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[AI Builder] JSON inválido:", cleaned.slice(0, 300));
      return json({ error: "El AI generó una respuesta inválida. Intenta de nuevo." }, 500);
    }

    if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
      return json({ error: "No se generaron preguntas. Intenta con una descripción más detallada." }, 500);
    }

    return json({ ok: true, questions: parsed.questions });
  } catch (err: any) {
    console.error("[AI Builder] Error:", err);
    return json({ error: "Error al generar preguntas con AI" }, 500);
  }
}