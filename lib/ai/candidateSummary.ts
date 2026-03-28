// lib/ai/candidateSummary.ts

import OpenAI from "openai";
import { z } from "zod";
import { createHash } from "crypto";
import { AI_MODEL_SMART } from "./config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const SUMMARY_VERSION = "v2";

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

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function inferProfileShape(input: CandidateSummaryInput) {
  const exp = input.experienceTitles.join(" ").toLowerCase();
  const skillText = input.skills.join(" ").toLowerCase();
  const combined = `${exp} ${skillText}`;

  const recruitingKeywords = [
    "recruit", "reclut", "headhunt", "talent", "hiring", "candidate", "staffing", "sourcing"
  ];

  const businessKeywords = [
    "founder", "product", "consultant", "consultor", "operations", "operaciones",
    "planning", "forecast", "sales", "ventas", "business"
  ];

  const techKeywords = [
    "developer", "desarrollador", "engineer", "ingeniero", "software", "frontend",
    "backend", "fullstack", "full stack", "architect", "devops"
  ];

  const modernWebSignals = [
    "next.js", "nextjs", "typescript", "react", "postgresql", "prisma", "node", "javascript"
  ];

  return {
    recruitingDominant: includesAny(combined, recruitingKeywords),
    businessDominant: includesAny(combined, businessKeywords),
    techDominant: includesAny(combined, techKeywords),
    hasModernWebSignals: includesAny(skillText, modernWebSignals),
  };
}

/**
 * Fingerprint con datos estables, no con strings decoradas de UI.
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
      ? `Años de experiencia profesional total: ${input.yearsExperience}`
      : null,
    input.location ? `Ubicación: ${input.location}` : null,
    input.skills.length ? `Skills detectadas: ${input.skills.slice(0, 12).join(", ")}` : null,
    input.languages.length ? `Idiomas: ${input.languages.join(", ")}` : null,
    input.experienceTitles.length
      ? `Experiencia reciente:\n${input.experienceTitles
          .slice(0, 4)
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
          ? `Skills requeridos/deseables: ${input.job.requiredSkills.slice(0, 10).join(", ")}`
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
  "headline": "máx 12 palabras",
  "summary": "2-3 oraciones ejecutivas, honestas y precisas",
  "strengths": ["máx 3 bullets concretos"],
  "risks": ["máx 2 bullets reales, array vacío si no hay"],
  "suggestedQuestions": ["3-5 preguntas útiles para entrevista"],
  "jobFitNotes": "máx 50 palabras — solo si hay vacante",
  "missingSkillsNote": "1 línea sobre gaps críticos — solo si hay gaps importantes"
}

Reglas críticas:
- Responde en español.
- No inventes datos.
- No exageres seniority técnico.
- No conviertas experiencia profesional total en experiencia especializada por stack.
- Si el perfil es híbrido o su trayectoria principal no es técnica, dilo explícitamente.
- Si hay experiencia técnica reciente pero no dominante, descríbela como reciente, práctica o complementaria.
- Si el candidato no se alinea bien con la vacante, menciónalo claramente en risks o jobFitNotes.
- No uses lenguaje promocional como "experto", "especializado", "extensa experiencia", salvo evidencia muy clara.
- Sé útil para reclutador, no poético.

PERFIL:
${profileBlock}

${jobBlock}
`.trim();
}

function sanitizeSummaryText(text: string): string {
  return normalizeText(text)
    .replace(/\s+/g, " ")
    .replace(/especializad[oa] en/gi, "con experiencia en")
    .replace(/experto en/gi, "con experiencia en")
    .replace(/extensa experiencia en/gi, "experiencia en")
    .replace(/ha trabajado extensamente con/gi, "ha trabajado con")
    .trim();
}

function fallbackSummary(input: CandidateSummaryInput): CandidateSummary {
  const shape = inferProfileShape(input);

  const summary = shape.recruitingDominant || shape.businessDominant
    ? [
        "Perfil híbrido con trayectoria principal en reclutamiento, negocio u operación.",
        shape.hasModernWebSignals
          ? "También muestra experiencia técnica reciente o práctica en desarrollo de producto."
          : "Su experiencia principal no parece centrarse en desarrollo de software puro.",
      ]
        .filter(Boolean)
        .join(" ")
    : "Perfil generado con información estructurada del candidato.";

  const strengths = shape.recruitingDominant || shape.businessDominant
    ? [
        input.experienceTitles[0] ? `Trayectoria reciente en: ${input.experienceTitles[0]}` : "",
        input.skills.length ? `Exposición práctica a: ${uniqClean(input.skills, 3).join(", ")}` : "",
        input.languages.length ? `Idiomas: ${uniqClean(input.languages, 2).join(", ")}` : "",
      ].filter(Boolean)
    : uniqClean(input.skills, 3);

  const risks = [
    ...(input.job?.missingRequired?.length
      ? [`Faltan skills requeridos: ${uniqClean(input.job.missingRequired).join(", ")}`]
      : []),
    ...((shape.recruitingDominant || shape.businessDominant) && input.job
      ? ["La trayectoria principal del candidato no parece estar totalmente alineada con una vacante técnica especializada."]
      : []),
  ];

  return {
    headline: `${input.name}${input.seniority ? ` · ${input.seniority}` : ""}`,
    summary,
    strengths: uniqClean(strengths, 3),
    risks: uniqClean(risks, 2),
    suggestedQuestions: [
      "¿Cuál ha sido tu responsabilidad principal en tus experiencias más recientes?",
      "¿Qué parte de tu experiencia técnica ha sido práctica y reciente?",
      "¿Qué tipo de rol estás buscando actualmente?",
      ...(input.job
        ? ["¿Qué tan alineado te consideras con esta vacante y por qué?"]
        : []),
    ].slice(0, 5),
    jobFitNotes: input.job
      ? "Conviene validar si la experiencia principal del candidato realmente se alinea con el rol."
      : undefined,
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
      temperature: 0.2,
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
      summary: sanitizeSummaryText(safe.data.summary),
      strengths: uniqClean(safe.data.strengths, 3),
      risks: uniqClean(safe.data.risks, 2),
      suggestedQuestions: uniqClean(safe.data.suggestedQuestions, 5),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return fallbackSummary(input);
  }
}