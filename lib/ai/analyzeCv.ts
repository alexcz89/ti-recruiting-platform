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
const CACHE_VERSION = "cv-v5";

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

  if (cleanedLabel.startsWith("+")) {
    const intl = `+${cleanedLabel.slice(1).replace(/\D+/g, "")}`;

    if (/^\+521\d{10}$/.test(intl)) {
      return `+52${intl.slice(4)}`;
    }

    return /^\+\d{8,15}$/.test(intl) ? intl : null;
  }

  const digits = cleanedLabel.replace(/\D+/g, "");
  if (!digits) return null;

  if (/^\d{10}$/.test(digits)) {
    return `+52${digits}`;
  }

  if (/^52\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  if (/^521\d{10}$/.test(digits)) {
    return `+52${digits.slice(3)}`;
  }

  return null;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function sanitizeGeneratedSummary(text: string): string {
  let out = normalizeText(text);

  if (!out) return out;

  out = out
    .replace(/\s+/g, " ")
    .replace(/especializad[oa] en/gi, "con experiencia en")
    .replace(/experto en/gi, "con experiencia en")
    .replace(/extensa experiencia en/gi, "experiencia en")
    .replace(/ha trabajado extensamente con/gi, "ha trabajado con")
    .replace(/una década de experiencia en/gi, "experiencia en")
    .replace(/m[aá]s de \d+\s*años de experiencia en/gi, "experiencia en");

  return out.trim();
}

function buildStackLabel(skills: string[]): string {
  const preferred = skills.filter(Boolean).slice(0, 4);
  if (!preferred.length) return "tecnologías web modernas";
  return preferred.join(", ");
}

function inferProfileSignals(data: AiCvResult) {
  const experienceText = (data.experiences || [])
    .map((e) => `${e.role} ${e.company}`.toLowerCase())
    .join(" | ");

  const summaryText = normalizeText(data.summary).toLowerCase();
  const combined = `${experienceText} | ${summaryText}`;

  const recruitingKeywords = [
    "recruit",
    "reclut",
    "talent",
    "headhunt",
    "staffing",
    "selección",
    "seleccion",
    "rh",
    "human resources",
    "interview",
    "sourcing",
    "candidate",
    "hiring",
  ];

  const businessKeywords = [
    "sales",
    "ventas",
    "commercial",
    "negocio",
    "business",
    "consultant",
    "consultor",
    "operations",
    "operaciones",
    "planning",
    "forecast",
    "supply chain",
    "product",
    "founder",
  ];

  const techRoleKeywords = [
    "developer",
    "desarrollador",
    "engineer",
    "ingeniero",
    "software",
    "frontend",
    "backend",
    "full stack",
    "fullstack",
    "architect",
    "devops",
    "data engineer",
    "data scientist",
  ];

  const recruitingDominant = includesAny(combined, recruitingKeywords);
  const businessDominant = includesAny(combined, businessKeywords);
  const technicalDominant = includesAny(combined, techRoleKeywords);

  const hasModernWebStack =
    cleanupStringArray(data.skills || [])
      .map((s) => s.toLowerCase())
      .filter((s) =>
        [
          "next.js",
          "nextjs",
          "typescript",
          "javascript",
          "react",
          "node.js",
          "node",
          "postgresql",
          "prisma",
        ].includes(s)
      ).length >= 2;

  const hasFounderSignal =
    combined.includes("founder") || combined.includes("product builder");

  return {
    recruitingDominant,
    businessDominant,
    technicalDominant,
    hasModernWebStack,
    hasFounderSignal,
  };
}

function detectProfileType(data: AiCvResult): string {
  const signals = inferProfileSignals(data);

  if (signals.recruitingDominant) {
    if (signals.hasModernWebStack) return "HYBRID";
    return "RECRUITING";
  }

  if (signals.businessDominant) {
    if (signals.hasModernWebStack) return "HYBRID";
    return "BUSINESS";
  }

  if (signals.technicalDominant) {
    return "ENGINEERING";
  }

  return "HYBRID";
}

function buildGroundedSummary(data: AiCvResult): string {
  const cleaned = sanitizeGeneratedSummary(data.summary);
  const signals = inferProfileSignals(data);
  const stackLabel = buildStackLabel(data.skills);

  if (
    (signals.recruitingDominant || signals.businessDominant) &&
    signals.hasModernWebStack
  ) {
    return [
      "Perfil híbrido con trayectoria principal en reclutamiento, negocio u operación.",
      `Cuenta con experiencia reciente construyendo o iterando productos digitales con ${stackLabel}.`,
      "Su experiencia técnica parece práctica y reciente, no una especialización técnica de largo plazo exclusivamente en desarrollo de software.",
    ].join(" ");
  }

  if (signals.recruitingDominant) {
    return [
      "Perfil con trayectoria principal en reclutamiento y atracción de talento.",
      signals.hasFounderSignal
        ? "También muestra experiencia emprendedora o de construcción de producto."
        : "Su experiencia principal no está centrada en desarrollo de software puro.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (signals.businessDominant && signals.hasModernWebStack) {
    return [
      "Perfil híbrido con base en negocio/producto y exposición técnica reciente.",
      `Ha trabajado con ${stackLabel} en un contexto práctico de construcción de producto.`,
      "El CV no sustenta una trayectoria larga exclusivamente como desarrollador.",
    ].join(" ");
  }

  if (signals.technicalDominant) {
    return cleaned || `Perfil técnico con experiencia en ${stackLabel}.`;
  }

  return cleaned;
}

function augmentRedFlags(data: AiCvResult): string[] {
  const signals = inferProfileSignals(data);
  const current = cleanupStringArray(data.redFlags || []);

  if (
    (signals.recruitingDominant || signals.businessDominant) &&
    signals.hasModernWebStack
  ) {
    current.push(
      "La trayectoria principal parece estar más orientada a reclutamiento/negocio que a desarrollo de software puro."
    );
  }

  return cleanupStringArray(current);
}

function normalizeCvResult(data: AiCvResult): AiCvResult {
  const phones = cleanupStringArray(
    (data.phoneRaw || [])
      .map(normalizePhone)
      .filter((p): p is string => !!p)
  );

  const primary = phones[0] ?? null;

  const normalizedBase: AiCvResult = {
    ...data,
    summary: normalizeText(data.summary),
    linkedin: normalizeText(data.linkedin),
    github: normalizeText(data.github),
    location: normalizeText(data.location),
    phoneRaw: phones,
    phonePrimary: primary,
    skills: cleanupStringArray(data.skills || []),
    recommendedRoles: cleanupStringArray(data.recommendedRoles || []),
    redFlags: cleanupStringArray(data.redFlags || []),
    languages: (data.languages || [])
      .map((l) => ({
        label: normalizeText(l.label),
        level: l.level,
      }))
      .filter((l) => l.label),
    experiences: (data.experiences || [])
      .map((e) => ({
        role: normalizeText(e.role),
        company: normalizeText(e.company),
        startDate: normalizeText(e.startDate),
        endDate: normalizeText(e.endDate),
        isCurrent: e.isCurrent,
      }))
      .filter((e) => e.role || e.company),
    education: (data.education || [])
      .map((e) => ({
        institution: normalizeText(e.institution),
        program: normalizeText(e.program),
        startDate: normalizeText(e.startDate),
        endDate: normalizeText(e.endDate),
        level: e.level,
      }))
      .filter((e) => e.institution || e.program),
  };

  return {
    ...normalizedBase,
    summary: buildGroundedSummary(normalizedBase),
    redFlags: augmentRedFlags(normalizedBase),
  };
}

function buildPrompt(cvText: string): string {
  return `
Eres un reclutador técnico senior y analista de CVs.

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
- "yearsExperience": número entero estimado de experiencia profesional total, no por tecnología.
- Si no hay red flags devuelve [].
- El resumen debe ser máximo 3 líneas.
- Si no encuentras linkedin/github devuelve cadena vacía.
- Si no encuentras location devuelve cadena vacía.
- phoneRaw: incluye todos los teléfonos encontrados.
- No inventes datos.
- Usa español para summary, recommendedRoles y redFlags.
- Los niveles de idioma deben respetar exactamente: NATIVE, PROFESSIONAL, CONVERSATIONAL, BASIC.
- Si no hay experiencias o educación, devuelve [].

Reglas críticas de interpretación:
- No conviertas experiencia profesional total en años de experiencia por stack o tecnología.
- No asumas que una tecnología reciente define el perfil principal del candidato.
- Si el CV mezcla negocio, reclutamiento, operaciones o producto con algo técnico, refléjalo como perfil híbrido.
- Si el candidato construyó un producto o startup con un stack técnico, descríbelo como experiencia práctica o reciente, no como carrera técnica de largo plazo salvo evidencia clara.
- Si la trayectoria principal parece no alinearse con un rol técnico puro, inclúyelo como redFlag de forma prudente.
- Evita lenguaje promocional o inflado como "experto", "especializado", "extensa experiencia", salvo evidencia explícita en el CV.
- El summary debe priorizar el rol principal real del candidato y después su contexto técnico reciente.

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
        const profileType = detectProfileType(normalized);

        if (candidateId) {
          void prisma.candidateAIProfile
            .upsert({
              where: { candidateId },
              update: {
                profileJson: parsedJson,
                sourceFingerprint: cvHash,
                profileVersion: CACHE_VERSION,
                profileType,
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
                profileType,
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
      const profileType = detectProfileType(normalized);

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
              profileType,
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
              profileType,
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