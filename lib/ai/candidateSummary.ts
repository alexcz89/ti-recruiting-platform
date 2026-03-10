import OpenAI from "openai";
import { z } from "zod";
import { createHash } from "crypto";
import { AI_MODEL_SMART } from "./config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const SUMMARY_VERSION = "v1";

export interface CandidateSummaryInput {
  name: string;
  seniority?: string | null;
  yearsExperience?: number | null;
  location?: string | null;

  skills: string[];
  languages: string[];
  experienceTitles: string[];
  certifications?: string[];

  job?: {
    title: string;
    seniority?: string | null;
    minYearsExperience?: number | null;
    requiredSkills: string[];
    missingRequired: string[];
    missingNice: string[];
    matchScore?: number | null;
  };
}

export interface CandidateSummary {
  headline: string;
  summary: string;
  strengths: string[];
  risks: string[];
  suggestedQuestions: string[];
  jobFitNotes?: string;
  missingSkillsNote?: string;
  generatedAt: string;
}

const CandidateSummarySchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  jobFitNotes: z.string().optional(),
  missingSkillsNote: z.string().optional(),
});

function uniqClean(values: string[] | undefined | null, limit?: number): string[] {
  const out = Array.from(
    new Set((values ?? []).map((v) => String(v || "").trim()).filter(Boolean))
  );
  return typeof limit === "number" ? out.slice(0, limit) : out;
}

/**
 * Fingerprint con datos estables, no con strings decoradas de UI.
 * Así evitamos invalidar caché por cambios cosméticos.
 */
export function buildFingerprint(input: CandidateSummaryInput): string {
  const stable = {
    summaryVersion: SUMMARY_VERSION,
    name: String(input.name || "").trim(),
    seniority: input.seniority ?? null,
    yearsExperience: input.yearsExperience ?? null,
    location: input.location ?? null,

    skills: uniqClean(input.skills).sort().slice(0, 12),
    languages: uniqClean(input.languages).sort(),
    experienceTitles: uniqClean(input.experienceTitles).slice(0, 5),
    certifications: uniqClean(input.certifications).sort().slice(0, 8),

    job: input.job
      ? {
          title: String(input.job.title || "").trim(),
          seniority: input.job.seniority ?? null,
          minYearsExperience: input.job.minYearsExperience ?? null,
          requiredSkills: uniqClean(input.job.requiredSkills).sort(),
          missingRequired: uniqClean(input.job.missingRequired).sort(),
          missingNice: uniqClean(input.job.missingNice).sort(),
          matchScore: input.job.matchScore ?? null,
        }
      : null,
  };

  return createHash("sha256")
    .update(JSON.stringify(stable))
    .digest("hex")
    .slice(0, 32);
}

function buildPrompt(input: CandidateSummaryInput): string {
  const profileBlock = [
    `Nombre: ${input.name}`,
    input.seniority ? `Seniority: ${input.seniority}` : null,
    input.yearsExperience != null
      ? `Años de experiencia: ${input.yearsExperience}`
      : null,
    input.location ? `Ubicación: ${input.location}` : null,
    input.skills.length ? `Skills: ${input.skills.slice(0, 12).join(", ")}` : null,
    input.languages.length ? `Idiomas: ${input.languages.join(", ")}` : null,
    input.experienceTitles.length
      ? `Experiencia reciente:\n${input.experienceTitles
          .slice(0, 3)
          .map((e) => `- ${e}`)
          .join("\n")}`
      : null,
    input.certifications?.length
      ? `Certificaciones: ${input.certifications.slice(0, 5).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const jobBlock = input.job
    ? [
        `--- VACANTE ---`,
        `Título: ${input.job.title}`,
        input.job.seniority ? `Seniority requerido: ${input.job.seniority}` : null,
        input.job.minYearsExperience != null
          ? `Años mínimos: ${input.job.minYearsExperience}`
          : null,
        input.job.requiredSkills.length
          ? `Skills requeridos/deseables: ${input.job.requiredSkills
              .slice(0, 10)
              .join(", ")}`
          : null,
        input.job.missingRequired.length
          ? `Skills requeridos faltantes: ${input.job.missingRequired.join(", ")}`
          : null,
        input.job.missingNice.length
          ? `Skills deseables faltantes: ${input.job.missingNice.join(", ")}`
          : null,
        input.job.matchScore != null
          ? `Match score actual: ${input.job.matchScore}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return `
Eres un recruiter técnico senior.

Devuelve ÚNICAMENTE JSON válido con esta forma exacta:

{
  "headline": "máx 18 palabras",
  "summary": "2-3 oraciones ejecutivas",
  "strengths": ["máx 3 bullets concretos"],
  "risks": ["máx 2 bullets reales, array vacío si no hay"],
  "suggestedQuestions": ["3-5 preguntas útiles para entrevista"],
  "jobFitNotes": "máx 50 palabras — solo si hay vacante",
  "missingSkillsNote": "1 línea sobre gaps críticos — solo si hay gaps importantes"
}

Reglas:
- Responde en español
- No inventes datos que no estén en el perfil
- Si no hay vacante, omite jobFitNotes y missingSkillsNote
- Sé directo y útil para un reclutador, no poético

PERFIL:
${profileBlock}

${jobBlock}
`.trim();
}

function fallbackSummary(input: CandidateSummaryInput): CandidateSummary {
  return {
    headline: `${input.name}${input.seniority ? ` · ${input.seniority}` : ""}`,
    summary: "Perfil generado con información estructurada del candidato.",
    strengths: uniqClean(input.skills, 3),
    risks: input.job?.missingRequired?.length
      ? [`Faltan skills requeridos: ${uniqClean(input.job.missingRequired).join(", ")}`]
      : [],
    suggestedQuestions: [
      "¿Cuál ha sido tu proyecto más relevante recientemente?",
      "¿Qué herramientas o tecnologías dominas mejor hoy?",
      "¿Qué tipo de rol estás buscando actualmente?",
    ],
    jobFitNotes: input.job ? `Evaluado contra: ${input.job.title}` : undefined,
    missingSkillsNote: input.job?.missingRequired?.length
      ? `Faltan skills clave: ${uniqClean(input.job.missingRequired).join(", ")}`
      : undefined,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateCandidateSummary(
  input: CandidateSummaryInput
): Promise<CandidateSummary> {
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL_SMART,
      messages: [{ role: "user", content: buildPrompt(input) }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 700,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const safe = CandidateSummarySchema.safeParse(parsed);

    if (!safe.success) {
      return fallbackSummary(input);
    }

    return {
      ...safe.data,
      strengths: uniqClean(safe.data.strengths, 3),
      risks: uniqClean(safe.data.risks, 2),
      suggestedQuestions: uniqClean(safe.data.suggestedQuestions, 5),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return fallbackSummary(input);
  }
}