// lib/ai/analyzeCv.ts

import { openai } from "./openai";
import { AI_MODEL_FAST } from "./config";
import { AiCvSchema, type AiCvResponse, type AiCvResult } from "./schemas";

const MAX_CHARS = 12000;
const MAX_RETRIES = 2;
const MAX_TOKENS = 900;

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
  return {
    ...data,
    _meta: meta,
  };
}

function cleanupStringArray(values: string[]): string[] {
  return Array.from(
    new Set(values.map((v) => v.trim()).filter(Boolean))
  );
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
      .map((lang) => ({
        label: lang.label.trim(),
        level: lang.level,
      }))
      .filter((lang) => lang.label),
    experiences: data.experiences
      .map((exp) => ({
        role: exp.role.trim(),
        company: exp.company.trim(),
        startDate: exp.startDate.trim(),
        endDate: exp.endDate.trim(),
        isCurrent: exp.isCurrent,
      }))
      .filter((exp) => exp.role || exp.company),
    education: data.education
      .map((edu) => ({
        institution: edu.institution.trim(),
        program: edu.program.trim(),
        startDate: edu.startDate.trim(),
        endDate: edu.endDate.trim(),
        level: edu.level,
      }))
      .filter((edu) => edu.institution || edu.program),
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
  "languages": [
    {
      "label": "idioma",
      "level": "NATIVE | PROFESSIONAL | CONVERSATIONAL | BASIC"
    }
  ],
  "experiences": [
    {
      "role": "puesto",
      "company": "empresa",
      "startDate": "YYYY-MM o cadena vacía",
      "endDate": "YYYY-MM o cadena vacía",
      "isCurrent": true
    }
  ],
  "education": [
    {
      "institution": "institución",
      "program": "programa o carrera",
      "startDate": "YYYY-MM o cadena vacía",
      "endDate": "YYYY-MM o cadena vacía",
      "level": "NONE | PRIMARY | SECONDARY | HIGH_SCHOOL | TECHNICAL | BACHELOR | MASTER | DOCTORATE | OTHER | null"
    }
  ]
}

Reglas:
- No escribas nada fuera del JSON.
- "skills" debe incluir lenguajes, frameworks, cloud, bases de datos o herramientas detectadas.
- "yearsExperience" debe ser un número entero estimado.
- Si no hay red flags devuelve [].
- El resumen debe ser máximo 3 líneas.
- Si no encuentras linkedin o github, devuelve cadena vacía.
- Si no encuentras languages, experiences o education, devuelve [].
- Usa fechas en formato YYYY-MM cuando sea posible; si no es claro, devuelve cadena vacía.

CV:
${cvText}
`;
}

export async function analyzeCv(cvText: string): Promise<AiCvResponse> {
  const trimmedText = cvText.slice(0, MAX_CHARS);
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
            warning: "validation_failed",
          });
        }

        continue;
      }

      const normalized = normalizeCvResult(safe.data);

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

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  return withMeta(emptyCvResult(), {
    model: AI_MODEL_FAST,
    parsedAt: new Date().toISOString(),
    error: "exhausted_retries",
  });
}