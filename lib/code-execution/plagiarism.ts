// lib/code-execution/plagiarism.ts
// Detección de plagio por similitud de tokens (Jaccard) entre submissions del mismo question.

import { prisma } from "@/lib/server/prisma";

const SIMILARITY_THRESHOLD = 0.70; // >= 70% → posible plagio

/**
 * Tokeniza código eliminando literales, whitespace y operadores cortos.
 * Mantiene identificadores y palabras clave para maximizar señal semántica.
 */
function tokenize(code: string): Set<string> {
  return new Set(
    code
      .toLowerCase()
      // eliminar strings y comentarios crudos
      .replace(/\/\/[^\n]*/g, " ")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, " ")
      // split por no-alfanuméricos
      .split(/[\s\W]+/)
      .filter((t) => t.length > 2) // solo tokens de 3+ chars
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionSize = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersectionSize++;
  }

  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

interface PlagiarismMatch {
  answerId: string;
  candidateId: string;
  similarity: number;
}

/**
 * Compara el código del candidato contra todas las otras submissions del mismo questionId.
 * Guarda el resultado en PlagiarismCheck (upsert via delete+create).
 * Debe llamarse de forma async sin bloquear la respuesta al candidato.
 */
export async function checkPlagiarism({
  answerId,
  questionId,
  code,
  candidateId,
}: {
  answerId: string;
  questionId: string;
  code: string;
  candidateId: string;
}): Promise<void> {
  try {
    // Obtener otras submissions para la misma pregunta (excluyendo el candidato actual)
    const others = await prisma.attemptAnswer.findMany({
      where: {
        questionId,
        codeSubmission: { not: null },
        attempt: {
          candidateId: { not: candidateId },
          status: { in: ["SUBMITTED", "EVALUATED", "COMPLETED"] },
        },
      },
      select: {
        id: true,
        codeSubmission: true,
        attempt: { select: { candidateId: true } },
      },
      take: 200, // cap para no hacer O(n²) con miles de candidatos
    });

    const matches: PlagiarismMatch[] = [];
    let maxSimilarity = 0;

    for (const other of others) {
      if (!other.codeSubmission) continue;
      const score = jaccardSimilarity(code, other.codeSubmission);
      if (score > maxSimilarity) maxSimilarity = score;
      if (score >= SIMILARITY_THRESHOLD) {
        matches.push({
          answerId: other.id,
          candidateId: other.attempt.candidateId,
          similarity: Math.round(score * 1000) / 1000,
        });
      }
    }

    // Guardar resultado (replace si ya existe)
    await prisma.plagiarismCheck.deleteMany({ where: { answerId } });
    await prisma.plagiarismCheck.create({
      data: {
        answerId,
        questionId,
        similarityScore: Math.round(maxSimilarity * 1000) / 1000,
        matchedSources: (matches.length > 0 ? matches : []) as any,
      },
    });

    if (matches.length > 0) {
      console.warn(
        `[Plagiarism] ⚠️  answerId=${answerId} questionId=${questionId} maxSimilarity=${maxSimilarity.toFixed(2)} matches=${matches.length}`
      );
    }
  } catch (err) {
    // No bloquear el flujo principal si falla el check de plagio
    console.error("[Plagiarism] Error checking plagiarism:", err);
  }
}
