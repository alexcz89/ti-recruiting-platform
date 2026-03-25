// lib/ai/analyzeCv.ts

import crypto from "crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/prisma";
import { AI_MODEL_FAST } from "./config";
import { openai } from "./openai";
import { AiCvSchema, type AiCvResponse, type AiCvResult } from "./schemas";

const MAX_CHARS = 12000;
const MAX_RETRIES = 2;
const MAX_TOKENS = 1200;

// Incrementar cuando cambie el prompt, schema o lógica de normalización
const CACHE_VERSION = "cv-v4";

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
    location: "",
    phoneRaw: [],
    phonePrimary: null,
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

function normalizePhone(raw: string): string | null {
  if (!raw) return null;

  const cleanedLabel = raw
    .replace(
      /\b(cel(?:ular)?|tel(?:efo?no)?|telefono|phone|mobile|whatsapp|wa|contacto|contact)\b[:\s-]*/gi,
      ""
    )
    .trim();

  if (!cleanedLabel) return null;

  // Caso internacional explícito
  if (cleanedLabel.startsWith("+")) {
    const intl = `+${cleanedLabel.slice(1).replace(/\D+/g, "")}`;

    // WhatsApp viejo de MX: +521XXXXXXXXXX -> +52XXXXXXXXXX
    if (/^\+521\d{10}$/.test(intl)) {
      return `+52${intl.slice(4)}`;
    }

    return /^\+\d{8,15}$/.test(intl) ? intl : null;
  }

  const digits = cleanedLabel.replace(/\D+/g, "");
  if (!digits) return null;

  // MX local 10 dígitos
  if (/^\d{10}$/.test(digits)) {
    return `+52${digits}`;
  }

  // MX con 52 sin +
  if (/^52\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  // WhatsApp viejo 521 sin +
  if (/^521\d{10}$/.test(digits)) {
    return `+52${digits.slice(3)}`;
  }

  // Internacional sin +: mejor descartarlo
  return null;
}

function normalizeCvResult(data: AiCvResult): AiCvResult {
  const phones = cleanupStringArray(
    (data.phoneRaw || [])
      .map(normalizePhone)
      .filter((p): p is string => !!p)
  );

  const primary = phones[0] ?? null;

  return {
    ...data,
    summary: data.summary.trim(),
    linkedin: data.linkedin.trim(),
    github: data.github.trim(),
    location: (data.location || "").trim(),
    phoneRaw: phones,
    phonePrimary: primary,
    skills: cleanupStringArray(data.skills),
    recommendedRoles: cleanupStringArray(data.recommendedRoles),
    redFlags: cleanupStringArray(data.redFlags),
    languages: data.languages
      .map((l) => ({
        label: l.label.trim(),
        level: l.level,
      }))
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
  "location": "Ciudad, Estado, País — ej: Monterrey, Nuevo León, México",
  "phoneRaw": ["todos los teléfonos encontrados tal como aparecen o en formato local/internacional"],
  "languages": [{ "label": "idioma en español — ej: Inglés, Español", "level": "NATIVE | PROFESSIONAL | CONVERSATIONAL | BASIC" }],
  "experiences": [{ "role": "puesto", "company": "empresa", "startDate": "YYYY-MM o vacío", "endDate": "YYYY-MM o vacío", "isCurrent": true }],
  "education": [{ "institution": "institución", "program": "carrera", "startDate": "YYYY-MM o vacío", "endDate": "YYYY-MM o vacío", "level": "BACHELOR | MASTER | DOCTORATE | BOOTCAMP | CERTIFICATION | OTHER | null" }]
}

Reglas:
- No escribas nada fuera del JSON.
- "skills": lenguajes, frameworks, cloud, bases de datos, herramientas.
- "yearsExperience": número entero estimado.
- Si no hay red flags devuelve [].
- El resumen debe ser máximo 3 líneas.
- Si no encuentras linkedin/github devuelve cadena vacía.
- Si no encuentras location devuelve cadena vacía.
- phoneRaw: incluye todos los teléfonos encontrados.
- No inventes datos.
- Usa español para summary, recommendedRoles y redFlags.
- Los niveles de idioma deben respetar exactamente: NATIVE, PROFESSIONAL, CONVERSATIONAL, BASIC.
- Si no hay experiencias o educación, devuelve [].

CV:
"""${cvText}"""
`.trim();
}

export async function analyzeCv(
  rawText: string,
  candidateId?: string
): Promise<AiCvResponse> {
  const cvText = rawText.slice(0, MAX_CHARS).trim();

  if (!cvText) {
    return withMeta(emptyCvResult(), {
      model: AI_MODEL_FAST,
      parsedAt: new Date().toISOString(),
      error: "empty_text",
    });
  }

  const cvHash = buildCacheKey(cvText);

  try {
    const cached = await prisma.cvParseCache.findUnique({
      where: { cvHash },
    });

    if (cached?.parsedJson) {
      const safe = AiCvSchema.safeParse(cached.parsedJson);

      if (safe.success) {
        const normalized = normalizeCvResult(safe.data);
        const parsedJson = normalized as unknown as Prisma.InputJsonValue;

        if (candidateId) {
          void prisma.candidateAIProfile
            .upsert({
              where: { candidateId },
              update: {
                profileJson: parsedJson,
                sourceFingerprint: cvHash,
                profileVersion: CACHE_VERSION,
                summaryText: normalized.summary,
                strengthsJson:
                  normalized.skills as unknown as Prisma.InputJsonValue,
                risksJson:
                  normalized.redFlags as unknown as Prisma.InputJsonValue,
                tags: normalized.recommendedRoles,
              },
              create: {
                candidateId,
                profileJson: parsedJson,
                sourceFingerprint: cvHash,
                profileVersion: CACHE_VERSION,
                summaryText: normalized.summary,
                strengthsJson:
                  normalized.skills as unknown as Prisma.InputJsonValue,
                risksJson:
                  normalized.redFlags as unknown as Prisma.InputJsonValue,
                tags: normalized.recommendedRoles,
              },
            })
            .catch((e) =>
              console.warn("[analyzeCv] AI profile write error (cache hit):", e)
            );
        }

        return withMeta(normalized, {
          model: cached.model || AI_MODEL_FAST,
          parsedAt: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.warn("[analyzeCv] cache read error:", e);
  }

  const prompt = buildPrompt(cvText);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: AI_MODEL_FAST,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extrae información de CVs y responde únicamente JSON válido.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
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
      const parsedJson = normalized as unknown as Prisma.InputJsonValue;

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

      if (candidateId) {
        void prisma.candidateAIProfile
          .upsert({
            where: { candidateId },
            update: {
              profileJson: parsedJson,
              sourceFingerprint: cvHash,
              profileVersion: CACHE_VERSION,
              summaryText: normalized.summary,
              strengthsJson:
                normalized.skills as unknown as Prisma.InputJsonValue,
              risksJson:
                normalized.redFlags as unknown as Prisma.InputJsonValue,
              tags: normalized.recommendedRoles,
            },
            create: {
              candidateId,
              profileJson: parsedJson,
              sourceFingerprint: cvHash,
              profileVersion: CACHE_VERSION,
              summaryText: normalized.summary,
              strengthsJson:
                normalized.skills as unknown as Prisma.InputJsonValue,
              risksJson:
                normalized.redFlags as unknown as Prisma.InputJsonValue,
              tags: normalized.recommendedRoles,
            },
          })
          .catch((e) =>
            console.warn("[analyzeCv] AI profile write error:", e)
          );
      }

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