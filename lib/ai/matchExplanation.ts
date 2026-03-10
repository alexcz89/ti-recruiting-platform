// lib/ai/matchExplanation.ts
import OpenAI from "openai";
import { z } from "zod";
import { createHash } from "crypto";
import { AI_MODEL_SMART } from "./config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const MATCH_EXPLANATION_VERSION = "v1";

export interface MatchExplanationInput {
  candidate: {
    name: string;
    seniority?: string | null;
    yearsExperience?: number | null;
    location?: string | null;
    skills: string[];
    languages?: string[];
    experienceTitles?: string[];
    certifications?: string[];
  };

  job: {
    title: string;
    seniority?: string | null;
    minYearsExperience?: number | null;
    requiredSkills: string[];
  };

  match: {
    score: number;
    label: string;
    skillScore: number;
    mustScore: number;
    niceScore: number;
    matchedCount: number;
    totalRequired: number;
    totalNice: number;
    matchedSkills: string[];
    missingRequired: string[];
    missingNice: string[];
    seniorityFit?: "exact" | "close" | "below" | "unknown";
    experienceFit?: "meets" | "close" | "below" | "unknown";
  };
}

export interface MatchExplanation {
  summary: string;
  strengths: string[];
  gaps: string[];
  interviewFocus: string[];
  recommendation: "STRONG_MATCH" | "REVIEW" | "WEAK_MATCH";
  generatedAt: string;
}

const MatchExplanationSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  interviewFocus: z.array(z.string()).default([]),
  recommendation: z.enum(["STRONG_MATCH", "REVIEW", "WEAK_MATCH"]),
});

function uniqClean(values: string[] | undefined | null, limit?: number): string[] {
  const out = Array.from(
    new Set((values ?? []).map((v) => String(v || "").trim()).filter(Boolean))
  );
  return typeof limit === "number" ? out.slice(0, limit) : out;
}

export function buildMatchExplanationFingerprint(input: MatchExplanationInput): string {
  const stable = {
    version: MATCH_EXPLANATION_VERSION,
    candidate: {
      name: String(input.candidate.name || "").trim(),
      seniority: input.candidate.seniority ?? null,
      yearsExperience: input.candidate.yearsExperience ?? null,
      location: input.candidate.location ?? null,
      skills: uniqClean(input.candidate.skills).sort().slice(0, 15),
      languages: uniqClean(input.candidate.languages).sort(),
      experienceTitles: uniqClean(input.candidate.experienceTitles).slice(0, 5),
      certifications: uniqClean(input.candidate.certifications).sort().slice(0, 8),
    },
    job: {
      title: String(input.job.title || "").trim(),
      seniority: input.job.seniority ?? null,
      minYearsExperience: input.job.minYearsExperience ?? null,
      requiredSkills: uniqClean(input.job.requiredSkills).sort(),
    },
    match: {
      score: input.match.score,
      label: input.match.label,
      skillScore: input.match.skillScore,
      mustScore: input.match.mustScore,
      niceScore: input.match.niceScore,
      matchedCount: input.match.matchedCount,
      totalRequired: input.match.totalRequired,
      totalNice: input.match.totalNice,
      matchedSkills: uniqClean(input.match.matchedSkills).sort(),
      missingRequired: uniqClean(input.match.missingRequired).sort(),
      missingNice: uniqClean(input.match.missingNice).sort(),
      seniorityFit: input.match.seniorityFit ?? "unknown",
      experienceFit: input.match.experienceFit ?? "unknown",
    },
  };

  return createHash("sha256")
    .update(JSON.stringify(stable))
    .digest("hex")
    .slice(0, 32);
}

function buildPrompt(input: MatchExplanationInput): string {
  const candidateBlock = [
    `Nombre: ${input.candidate.name}`,
    input.candidate.seniority ? `Seniority: ${input.candidate.seniority}` : null,
    input.candidate.yearsExperience != null
      ? `Años de experiencia: ${input.candidate.yearsExperience}`
      : null,
    input.candidate.location ? `Ubicación: ${input.candidate.location}` : null,
    input.candidate.skills.length
      ? `Skills: ${input.candidate.skills.slice(0, 15).join(", ")}`
      : null,
    input.candidate.languages?.length
      ? `Idiomas: ${input.candidate.languages.join(", ")}`
      : null,
    input.candidate.experienceTitles?.length
      ? `Experiencia reciente:\n${input.candidate.experienceTitles
          .slice(0, 4)
          .map((e) => `- ${e}`)
          .join("\n")}`
      : null,
    input.candidate.certifications?.length
      ? `Certificaciones: ${input.candidate.certifications.slice(0, 5).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const jobBlock = [
    `Título: ${input.job.title}`,
    input.job.seniority ? `Seniority requerido: ${input.job.seniority}` : null,
    input.job.minYearsExperience != null
      ? `Años mínimos requeridos: ${input.job.minYearsExperience}`
      : null,
    input.job.requiredSkills.length
      ? `Skills de la vacante: ${input.job.requiredSkills.slice(0, 12).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const matchBlock = [
    `Score total: ${input.match.score}`,
    `Etiqueta: ${input.match.label}`,
    `Score skills: ${input.match.skillScore}`,
    `Score requeridas: ${input.match.mustScore}`,
    `Score deseables: ${input.match.niceScore}`,
    `Skills coincidentes: ${input.match.matchedSkills.join(", ") || "Ninguna"}`,
    input.match.missingRequired.length
      ? `Skills requeridas faltantes: ${input.match.missingRequired.join(", ")}`
      : null,
    input.match.missingNice.length
      ? `Skills deseables faltantes: ${input.match.missingNice.join(", ")}`
      : null,
    `Seniority fit: ${input.match.seniorityFit ?? "unknown"}`,
    `Experience fit: ${input.match.experienceFit ?? "unknown"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `
Eres un recruiter técnico senior.

Devuelve ÚNICAMENTE JSON válido con esta forma exacta:

{
  "summary": "2-3 oraciones concretas",
  "strengths": ["máx 3 fortalezas reales"],
  "gaps": ["máx 3 brechas reales"],
  "interviewFocus": ["3-5 puntos útiles para entrevista"],
  "recommendation": "STRONG_MATCH | REVIEW | WEAK_MATCH"
}

Reglas:
- Responde en español
- No inventes datos
- Usa el score y los gaps reales del match determinístico
- Sé útil para un recruiter, no genérico
- Si el candidato encaja bien, dilo claramente
- Si faltan skills críticas, dilo claramente
- interviewFocus debe servir para validar dudas reales

CANDIDATO:
${candidateBlock}

VACANTE:
${jobBlock}

MATCH DETERMINÍSTICO:
${matchBlock}
`.trim();
}

export function fallbackMatchExplanation(input: MatchExplanationInput): MatchExplanation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const interviewFocus: string[] = [];

  if (input.match.matchedSkills.length > 0) {
    strengths.push(
      `Coincide con ${input.match.matchedSkills.length} skill${
        input.match.matchedSkills.length === 1 ? "" : "s"
      } del perfil.`
    );
  }

  if (input.match.seniorityFit === "exact") {
    strengths.push("El seniority está alineado con la vacante.");
  } else if (input.match.seniorityFit === "close") {
    strengths.push("El seniority es cercano a lo solicitado.");
  }

  if (input.match.experienceFit === "meets") {
    strengths.push("La experiencia cumple o supera el mínimo requerido.");
  } else if (input.match.experienceFit === "close") {
    strengths.push("La experiencia está cerca del mínimo esperado.");
  }

  if (input.match.missingRequired.length > 0) {
    gaps.push(`Faltan skills requeridas: ${uniqClean(input.match.missingRequired).join(", ")}.`);
  }

  if (input.match.missingNice.length > 0) {
    gaps.push(`Hay brechas en skills deseables: ${uniqClean(input.match.missingNice, 3).join(", ")}.`);
  }

  if (input.match.seniorityFit === "below") {
    gaps.push("El seniority está por debajo del nivel ideal.");
  }

  if (input.match.experienceFit === "below") {
    gaps.push("La experiencia está por debajo del mínimo requerido.");
  }

  interviewFocus.push("Validar profundidad real en las skills principales.");

  if (input.match.missingRequired.length > 0) {
    interviewFocus.push(`Explorar exposición a ${uniqClean(input.match.missingRequired, 2).join(" y ")}.`);
  }

  if (input.match.seniorityFit === "close" || input.match.seniorityFit === "below") {
    interviewFocus.push("Confirmar nivel de autonomía y complejidad de proyectos.");
  }

  if (input.match.experienceFit === "close" || input.match.experienceFit === "below") {
    interviewFocus.push("Validar alcance real de experiencia reciente.");
  }

  const recommendation: MatchExplanation["recommendation"] =
    input.match.score >= 85
      ? "STRONG_MATCH"
      : input.match.score >= 55
      ? "REVIEW"
      : "WEAK_MATCH";

  return {
    summary:
      input.match.score >= 85
        ? "Buen ajuste general para la vacante. El perfil cubre gran parte de los requisitos clave y merece revisión prioritaria."
        : input.match.score >= 55
        ? "Ajuste parcial con señales positivas, pero conviene validar brechas antes de avanzar."
        : "El ajuste es limitado y presenta brechas importantes frente a la vacante.",
    strengths: uniqClean(strengths, 3),
    gaps: uniqClean(gaps, 3),
    interviewFocus: uniqClean(interviewFocus, 5),
    recommendation,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateMatchExplanation(
  input: MatchExplanationInput
): Promise<MatchExplanation> {
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL_SMART,
      messages: [{ role: "user", content: buildPrompt(input) }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 700,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const safe = MatchExplanationSchema.safeParse(parsed);

    if (!safe.success) {
      return fallbackMatchExplanation(input);
    }

    return {
      ...safe.data,
      strengths: uniqClean(safe.data.strengths, 3),
      gaps: uniqClean(safe.data.gaps, 3),
      interviewFocus: uniqClean(safe.data.interviewFocus, 5),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return fallbackMatchExplanation(input);
  }
}