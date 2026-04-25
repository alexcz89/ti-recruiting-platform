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

    // Generar N items de ejemplo en el schema para que el modelo entienda cuántos debe generar
    const schemaCodingItem = (i: number) => `    {
      "questionText": "enunciado del problema ${i} — diferente a los demás",
      "section": "sección temática relevante",
      "difficulty": "${difficulty || "MID"}",
      "explanation": "explicación detallada con la solución completa en ${language || "python"}",
      "codeSnippet": "esqueleto de la función que el candidato debe completar",
      "allowedLanguages": ["${language || "python"}"],
      "testCases": [
        { "input": "input visible 1", "expectedOutput": "output exacto 1", "isHidden": false },
        { "input": "input visible 2", "expectedOutput": "output exacto 2", "isHidden": false },
        { "input": "edge case oculto", "expectedOutput": "resultado exacto", "isHidden": true },
        { "input": "caso difícil oculto", "expectedOutput": "resultado exacto", "isHidden": true }
      ]
    }`;

    const schemaMCQItem = (i: number) => `    {
      "questionText": "pregunta técnica ${i} — diferente a las demás",
      "section": "sección temática relevante",
      "difficulty": "${difficulty || "MID"}",
      "explanation": "por qué cada opción es correcta o incorrecta",
      "options": [
        { "text": "opción correcta", "isCorrect": true },
        { "text": "distractor plausible A", "isCorrect": false },
        { "text": "distractor plausible B", "isCorrect": false },
        { "text": "distractor plausible C", "isCorrect": false }
      ]
    }`;

    const schemaItems = Array.from({ length: clampedCount }, (_, i) =>
      isCoding ? schemaCodingItem(i + 1) : schemaMCQItem(i + 1)
    ).join(",\n");

    const schema = `{
  "questions": [
${schemaItems}
  ]
}`;

    const systemContent = `Eres un experto en evaluaciones técnicas de reclutamiento IT especializado en México y Latinoamérica.
Generas preguntas técnicas de alta calidad para assessments de candidatos.
REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con JSON válido. Sin texto adicional, sin markdown, sin backticks.
2. El array "questions" debe contener EXACTAMENTE ${clampedCount} elemento(s) — ni más ni menos.
3. Sigue el schema exactamente como se muestra.`;

    const userContent = isCoding
      ? `Genera EXACTAMENTE ${clampedCount} pregunta(s) DISTINTAS de código en ${language || "python"}, nivel ${difficultyLabel}.

Descripción del tema: "${prompt}"

REQUISITOS OBLIGATORIOS:
- Devuelve EXACTAMENTE ${clampedCount} objeto(s) en el array "questions"
- Cada pregunta debe ser DIFERENTE — distintos contextos, funciones y test cases
- El enunciado debe describir un problema real con contexto de negocio
- El codeSnippet debe ser el esqueleto de la función (sin implementar)
- Los inputs/outputs deben ser valores exactos que Ruby pueda comparar directamente
- IMPORTANTE: Los inputs para ${language || "python"} deben ser valores que el programa lee de STDIN (no como argumentos)
- La explanation debe incluir la solución completa funcional

Schema con ${clampedCount} pregunta(s):
${schema}`
      : `Genera EXACTAMENTE ${clampedCount} pregunta(s) DISTINTAS de opción múltiple, nivel ${difficultyLabel}${language ? ` sobre ${language}` : ""}.

Descripción del tema: "${prompt}"

REQUISITOS OBLIGATORIOS:
- Devuelve EXACTAMENTE ${clampedCount} objeto(s) en el array "questions"
- Cada pregunta debe ser DIFERENTE — distintos conceptos y escenarios
- Exactamente 4 opciones por pregunta, exactamente 1 correcta
- Los distractores deben ser técnicamente plausibles (no obviamente incorrectos)

Schema con ${clampedCount} pregunta(s):
${schema}`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL_SMART,
      temperature: 0.7,
      max_tokens: Math.min(1000 + clampedCount * 1500, 8000),
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