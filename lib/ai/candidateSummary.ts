// lib/ai/candidateSummary.ts
import OpenAI from "openai";
import { z } from "zod";
import { AI_MODEL_SMART } from "./config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

function buildPrompt(input: CandidateSummaryInput): string {
  const { name, seniority, yearsExperience, location, skills, languages, experienceTitles, certifications, job } = input;

  const profileBlock = [
    `Nombre: ${name}`,
    seniority ? `Seniority: ${seniority}` : null,
    yearsExperience != null ? `Años de experiencia: ${yearsExperience}` : null,
    location ? `Ubicación: ${location}` : null,
    skills.length ? `Skills: ${skills.join(", ")}` : null,
    languages.length ? `Idiomas: ${languages.join(", ")}` : null,
    experienceTitles.length ? `Experiencia:\n${experienceTitles.map((e) => `- ${e}`).join("\n")}` : null,
    certifications?.length ? `Certificaciones: ${certifications.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const jobBlock = job
    ? [
        `--- VACANTE ---`,
        `Título: ${job.title}`,
        job.seniority ? `Seniority requerido: ${job.seniority}` : null,
        job.minYearsExperience != null
          ? `Años mínimos requeridos: ${job.minYearsExperience}`
          : null,
        job.requiredSkills.length
          ? `Skills requeridos/deseables: ${job.requiredSkills.join(", ")}`
          : null,
        job.missingRequired.length
          ? `Skills requeridos faltantes: ${job.missingRequired.join(", ")}`
          : null,
        job.missingNice.length
          ? `Skills deseables faltantes: ${job.missingNice.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return `
Eres un recruiter senior de tecnología.

Devuelve ÚNICAMENTE JSON válido con esta forma:

{
  "headline": "string",
  "summary": "string",
  "strengths": ["string"],
  "risks": ["string"],
  "suggestedQuestions": ["string"],
  "jobFitNotes": "string opcional",
  "missingSkillsNote": "string opcional"
}

Reglas:
- headline: una sola línea, ejecutiva.
- summary: 2 o 3 oraciones.
- strengths: 3 a 5 bullets concretos.
- risks: 0 a 3 bullets reales, no inventes.
- suggestedQuestions: 3 a 5 preguntas útiles para entrevista.
- Si no hay vacante, omite jobFitNotes y missingSkillsNote.
- Si hay vacante, explica fit real, no adornes.
- Responde en español.

PERFIL:
${profileBlock}

${jobBlock}
`.trim();
}

function fallbackSummary(input: CandidateSummaryInput): CandidateSummary {
  return {
    headline: `${input.name}${input.seniority ? ` · ${input.seniority}` : ""}`,
    summary: "Perfil generado con información estructurada del candidato.",
    strengths: input.skills.slice(0, 5),
    risks: input.job?.missingRequired?.length
      ? [`Faltan skills requeridos: ${input.job.missingRequired.join(", ")}`]
      : [],
    suggestedQuestions: [
      "¿Cuál ha sido tu proyecto más relevante recientemente?",
      "¿Qué herramientas o tecnologías dominas mejor hoy?",
      "¿Qué tipo de rol estás buscando actualmente?",
    ],
    jobFitNotes: input.job ? `Se evaluó contra la vacante ${input.job.title}.` : undefined,
    missingSkillsNote:
      input.job?.missingRequired?.length
        ? `Faltan skills clave: ${input.job.missingRequired.join(", ")}`
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
      max_tokens: 900,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const safe = CandidateSummarySchema.safeParse(parsed);

    if (!safe.success) {
      return fallbackSummary(input);
    }

    return {
      ...safe.data,
      strengths: safe.data.strengths.slice(0, 5),
      risks: safe.data.risks.slice(0, 3),
      suggestedQuestions: safe.data.suggestedQuestions.slice(0, 5),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return fallbackSummary(input);
  }
}