// lib/ai/analyzeCv.ts

import { openai } from "./openai";
import { AI_MODEL_FAST } from "./config";
import { AiCvSchema, type AiCvResponse, type AiCvResult } from "./schemas";
import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

const MAX_CHARS = 12000;
const MAX_RETRIES = 2;
const MAX_TOKENS = 900;

// Incrementar cuando cambie el prompt, schema o lógica de normalización
const CACHE_VERSION = "cv-v1";

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildCacheKey(cvText: string): string {
  return hashText(
    JSON.stringify({
      v: CACHE_VERSION,
      model: AI_MODEL_FAST,
      text: cvText,
    })
  );
}

function emptyCvResult(): AiCvResult {
  return {
    summary: "",
    seniority: "mid",
    skills: [],
    yearsExperience: 0,
    recommendedRoles: [],
    redFlags: [],
    linkedin: "",
    github: "",
    languages: [],
    experiences: [],
    education: [],
  };
}

function withMeta(
  data: AiCvResult,
  meta: AiCvResponse["_meta"]
): AiCvResponse {
  return { ...data, _meta: meta };
}

function cleanupStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function normalizeCvResult(data: AiCvResult): AiCvResult {
  return {
    ...data,
    summary: data.summary.trim(),
    linkedin: data.linkedin.trim(),
    github: data.github.trim(),
    skills: cleanupStringArray(data.skills),
    recommendedRoles: cleanupStringArray(data.recommendedRoles),
    redFlags: cleanupStringArray(data.redFlags),
    languages: data.languages
      .map((l) => ({ label: l.label.trim(), level: l.level }))
      .filter((l) => l.label),
    experiences: data.experiences
      .map((e) => ({
        role: e.role.trim(),
        company: e.company.trim(),
        startDate: e.startDate.trim(),
        endDate: e.endDate.trim(),
        isCurrent: e.isCurrent,
      }))
      .filter((e) => e.role || e.company),
    education: data.education
      .map((e) => ({
        institution: e.institution.trim(),
        program: e.program.trim(),
        startDate: e.startDate.trim(),
        endDate: e.endDate.trim(),
        level: e.level,
      }))
      .filter((e) => e.institution || e.program),
  };
}

function buildPrompt(cvText: string): string {
  return `
Eres un reclutador técnico senior especializado en perfiles de tecnología.

Analiza este CV y devuelve ÚNICAMENTE JSON válido con esta estructura exacta:

{
  "summary": "breve resumen profesional del candidato",
  "seniority": "junior | mid | senior",
  "skills": ["tecnologías detectadas"],
  "yearsExperience": number,
  "recommendedRoles": ["roles sugeridos"],
  "redFlags": ["posibles alertas"],
  "linkedin": "url o cadena vacía",
  "github": "url o cadena vacía",
  "languages": [{ "label": "idioma", "level": "NATIVE | PROFESSIONAL | CONVERSATIONAL | BASIC" }],
  "experiences": [{ "role": "puesto", "company": "empresa", "startDate": "YYYY-MM o vacío", "endDate": "YYYY-MM o vacío", "isCurrent": true }],
  "education": [{ "institution": "institución", "program": "carrera", "startDate": "YYYY-MM o vacío", "endDate": "YYYY-MM o vacío", "level": "BACHELOR | MASTER | ... | null" }]
}

Reglas:
- No escribas nada fuera del JSON.
- "skills": lenguajes, frameworks, cloud, bases de datos, herramientas.
- "yearsExperience": número entero estimado.
- Si no hay red flags devuelve [].
- El resumen debe ser máximo 3 líneas.
- Si no encuentras linkedin/github devuelve cadena vacía.
- Si no encuentras languages/experiences/education devuelve [].
- Fechas en formato YYYY-MM cuando sea posible; si no es claro, devuelve cadena vacía.

CV:
${cvText}
`;
}

export async function analyzeCv(cvText: string): Promise<AiCvResponse> {
  const trimmedText = cvText.slice(0, MAX_CHARS);
  const cvHash = buildCacheKey(trimmedText);

  try {
    const cached = await prisma.cvParseCache.findUnique({
      where: { cvHash },
    });

    if (cached && cached.parserVersion === CACHE_VERSION) {
      const safe = AiCvSchema.safeParse(cached.parsedJson);

      if (safe.success) {
        return withMeta(normalizeCvResult(safe.data), {
          model: cached.model,
          parsedAt: cached.updatedAt.toISOString(),
          warning: "from_cache",
        });
      }
    }
  } catch (e) {
    console.warn("[analyzeCv] cache read error:", e);
  }

  const prompt = buildPrompt(trimmedText);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: AI_MODEL_FAST,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
      });

      const raw = response.choices[0]?.message?.content ?? "{}";

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn(`[analyzeCv] attempt ${attempt}: JSON.parse failed`);

        if (attempt === MAX_RETRIES) {
          return withMeta(emptyCvResult(), {
            model: AI_MODEL_FAST,
            parsedAt: new Date().toISOString(),
            error: "json_parse_failed",
          });
        }

        continue;
      }

      const safe = AiCvSchema.safeParse(parsed);

      if (!safe.success) {
        console.warn(
          `[analyzeCv] attempt ${attempt}: Zod validation failed`,
          safe.error.flatten()
        );

        if (attempt === MAX_RETRIES) {
          return withMeta(emptyCvResult(), {
            model: AI_MODEL_FAST,
            parsedAt: new Date().toISOString(),
            error: "validation_failed",
          });
        }

        continue;
      }

      const normalized = normalizeCvResult(safe.data);
      const parsedJson =
        normalized as unknown as Prisma.InputJsonValue;

      void prisma.cvParseCache
        .upsert({
          where: { cvHash },
          update: {
            parsedJson,
            model: AI_MODEL_FAST,
            parserVersion: CACHE_VERSION,
          },
          create: {
            cvHash,
            parsedJson,
            model: AI_MODEL_FAST,
            parserVersion: CACHE_VERSION,
          },
        })
        .catch((e) => console.warn("[analyzeCv] cache write error:", e));

      return withMeta(normalized, {
        model: AI_MODEL_FAST,
        parsedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[analyzeCv] attempt ${attempt} error:`, error);

      if (attempt === MAX_RETRIES) {
        return withMeta(emptyCvResult(), {
          model: AI_MODEL_FAST,
          parsedAt: new Date().toISOString(),
          error: "ai_failed",
        });
      }

      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  return withMeta(emptyCvResult(), {
    model: AI_MODEL_FAST,
    parsedAt: new Date().toISOString(),
    error: "exhausted_retries",
  });
}