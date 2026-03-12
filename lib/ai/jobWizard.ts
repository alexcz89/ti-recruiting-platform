// lib/ai/jobWizard.ts
import { z } from "zod";
import { openai } from "./openai";
import { AI_MODEL_SMART } from "./config";

const DegreeSchema = z.enum([
  "HIGHSCHOOL",
  "TECH",
  "BACHELOR",
  "MASTER",
  "PHD",
]);

const LanguageLevelSchema = z.enum([
  "NATIVE",
  "PROFESSIONAL",
  "CONVERSATIONAL",
  "BASIC",
]);

const JobWizardOutputSchema = z.object({
  descriptionPlain: z.string().trim().min(50),
  minDegree: DegreeSchema.nullable().optional(),
  requiredSkills: z.array(z.string().trim()).default([]),
  niceSkills: z.array(z.string().trim()).default([]),
  eduRequired: z.array(z.string().trim()).default([]),
  eduNice: z.array(z.string().trim()).default([]),
  certs: z.array(z.string().trim()).default([]),
  languages: z
    .array(
      z.object({
        name: z.string().trim(),
        level: LanguageLevelSchema,
      })
    )
    .default([]),
});

export type JobWizardAIOutput = z.infer<typeof JobWizardOutputSchema>;

export type JobWizardAIInput = {
  title: string;
  companyMode?: "own" | "confidential";
  locationType?: "REMOTE" | "HYBRID" | "ONSITE";
  city?: string;
  country?: string;
  currency?: "MXN" | "USD";
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  schedule?: string;
  benefits?: string[];
  assessmentSelected?: boolean;
  currentDescriptionPlain?: string;
  currentRequiredSkills?: string[];
  currentNiceSkills?: string[];
  currentEduRequired?: string[];
  currentEduNice?: string[];
  currentCerts?: string[];
  currentLanguages?: Array<{
    name: string;
    level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
  }>;
};

function uniqClean(values: string[] | undefined | null, limit?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of values ?? []) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (typeof limit === "number" && out.length >= limit) break;
  }

  return out;
}

function uniqLanguages(
  values:
    | Array<{
        name: string;
        level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
      }>
    | undefined
    | null,
  limit = 5
) {
  const seen = new Set<string>();
  const out: Array<{
    name: string;
    level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
  }> = [];

  for (const item of values ?? []) {
    const name = String(item?.name || "").trim();
    const level = item?.level;
    if (!name || !level) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, level });
    if (out.length >= limit) break;
  }

  return out;
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plainToBasicHtml(plain: string): string {
  const lines = plain.replace(/\r\n/g, "\n").split("\n");
  const paragraphs: string[][] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      if (buffer.length) {
        paragraphs.push(buffer);
        buffer = [];
      }
      continue;
    }
    buffer.push(line);
  }

  if (buffer.length) paragraphs.push(buffer);

  const bulletPrefixes = ["- ", "* ", "• "];

  return paragraphs
    .map((paraLines) => {
      const allBullets = paraLines.every((line) =>
        bulletPrefixes.some((prefix) => line.startsWith(prefix))
      );

      if (allBullets) {
        const items = paraLines
          .map((line) => {
            const prefix = bulletPrefixes.find((p) => line.startsWith(p)) || "";
            return escapeHtml(line.slice(prefix.length).trim());
          })
          .filter(Boolean);

        return items.length
          ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`
          : "";
      }

      return `<p>${paraLines.map((line) => escapeHtml(line)).join("<br/>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function buildPrompt(input: JobWizardAIInput) {
  const benefitsBlock =
    input.benefits && input.benefits.length
      ? input.benefits.map((b) => `- ${b}`).join("\n")
      : "No especificadas";

  const existingBlock = [
    input.currentDescriptionPlain?.trim()
      ? `Descripción actual:\n${input.currentDescriptionPlain.trim()}`
      : null,
    input.currentRequiredSkills?.length
      ? `Skills obligatorias actuales: ${input.currentRequiredSkills.join(", ")}`
      : null,
    input.currentNiceSkills?.length
      ? `Skills deseables actuales: ${input.currentNiceSkills.join(", ")}`
      : null,
    input.currentEduRequired?.length
      ? `Educación obligatoria actual: ${input.currentEduRequired.join(", ")}`
      : null,
    input.currentEduNice?.length
      ? `Educación deseable actual: ${input.currentEduNice.join(", ")}`
      : null,
    input.currentCerts?.length
      ? `Certificaciones actuales: ${input.currentCerts.join(", ")}`
      : null,
    input.currentLanguages?.length
      ? `Idiomas actuales: ${input.currentLanguages
          .map((l) => `${l.name} (${l.level})`)
          .join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `
Eres un recruiter técnico senior en México, especializado en vacantes de TI.

Tu tarea es ayudar a redactar una vacante profesional y útil para filtrar talento.
Debes devolver ÚNICAMENTE JSON válido, sin texto adicional.

Formato exacto:
{
  "descriptionPlain": "texto en español con mínimo 50 caracteres",
  "minDegree": "HIGHSCHOOL|TECH|BACHELOR|MASTER|PHD|null",
  "requiredSkills": ["..."],
  "niceSkills": ["..."],
  "eduRequired": ["..."],
  "eduNice": ["..."],
  "certs": ["..."],
  "languages": [
    { "name": "Inglés", "level": "PROFESSIONAL" }
  ]
}

Reglas:
- Responde en español.
- No inventes tecnologías extremadamente específicas si no se pueden inferir del puesto.
- Prioriza claridad y utilidad para reclutamiento real.
- "descriptionPlain" debe incluir:
  1) breve contexto del rol,
  2) responsabilidades,
  3) requisitos,
  4) beneficios o condiciones si aplica.
- Usa saltos de línea y bullets simples con "- " cuando ayude.
- Separa skills obligatorias vs deseables de forma realista.
- No agregues certificaciones o idiomas a menos que tengan sentido.
- Evita duplicados.
- No exageres seniority ni requisitos.
- Para vacantes generales de TI en México, "Inglés" puede ser deseable solo si hace sentido.
- Si no hay base para estudios muy específicos, usa una combinación razonable.
- Si el rol es técnico profesional, normalmente "BACHELOR" es una sugerencia razonable.
- Si ya existe contenido útil, mejóralo sin contradecirlo absurdamente.

Contexto de la vacante:
Título: ${input.title}
Empresa visible: ${input.companyMode === "confidential" ? "No, confidencial" : "Sí"}
Modalidad: ${input.locationType || "No especificada"}
Ciudad: ${input.city || "No especificada"}
País: ${input.country || "No especificado"}
Moneda: ${input.currency || "MXN"}
Sueldo mínimo: ${input.salaryMin ?? "No especificado"}
Sueldo máximo: ${input.salaryMax ?? "No especificado"}
Tipo de empleo: ${input.employmentType || "No especificado"}
Horario: ${input.schedule || "No especificado"}
Evaluación técnica seleccionada: ${input.assessmentSelected ? "Sí" : "No"}

Prestaciones:
${benefitsBlock}

Contenido actual:
${existingBlock || "Sin contenido previo"}
`.trim();
}

function fallbackOutput(input: JobWizardAIInput): JobWizardAIOutput {
  const title = String(input.title || "").trim() || "Especialista de TI";

  const descriptionPlain = [
    `Buscamos un perfil para la posición de ${title}.`,
    "",
    "Responsabilidades:",
    "- Ejecutar las funciones clave del puesto.",
    "- Colaborar con el equipo y áreas relacionadas.",
    "- Dar seguimiento a entregables, incidencias o mejoras según el rol.",
    "",
    "Requisitos:",
    "- Experiencia previa en un rol similar.",
    "- Conocimientos técnicos acordes a la vacante.",
    "- Capacidad para trabajar en equipo y comunicar avances.",
    "",
    input.benefits?.length ? "Prestaciones / condiciones:" : "",
    ...(input.benefits?.length ? input.benefits.map((b) => `- ${b}`) : []),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    descriptionPlain,
    minDegree: "BACHELOR",
    requiredSkills: uniqClean(input.currentRequiredSkills, 8),
    niceSkills: uniqClean(input.currentNiceSkills, 8),
    eduRequired: uniqClean(input.currentEduRequired, 5),
    eduNice: uniqClean(input.currentEduNice, 5),
    certs: uniqClean(input.currentCerts, 5),
    languages: uniqLanguages(input.currentLanguages, 5),
  };
}

export async function generateJobWizardDraft(
  input: JobWizardAIInput
): Promise<JobWizardAIOutput & { descriptionHtml: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL_SMART,
      messages: [{ role: "user", content: buildPrompt(input) }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 1400,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const safe = JobWizardOutputSchema.safeParse(parsed);

    if (!safe.success) {
      const fallback = fallbackOutput(input);
      return {
        ...fallback,
        descriptionHtml: plainToBasicHtml(fallback.descriptionPlain),
      };
    }

    const normalized: JobWizardAIOutput = {
      descriptionPlain: safe.data.descriptionPlain.trim(),
      minDegree: safe.data.minDegree ?? null,
      requiredSkills: uniqClean(safe.data.requiredSkills, 12),
      niceSkills: uniqClean(
        safe.data.niceSkills.filter(
          (item) =>
            !safe.data.requiredSkills.some(
              (req) => req.trim().toLowerCase() === item.trim().toLowerCase()
            )
        ),
        12
      ),
      eduRequired: uniqClean(safe.data.eduRequired, 8),
      eduNice: uniqClean(
        safe.data.eduNice.filter(
          (item) =>
            !safe.data.eduRequired.some(
              (req) => req.trim().toLowerCase() === item.trim().toLowerCase()
            )
        ),
        8
      ),
      certs: uniqClean(safe.data.certs, 8),
      languages: uniqLanguages(safe.data.languages, 5),
    };

    return {
      ...normalized,
      descriptionHtml: plainToBasicHtml(normalized.descriptionPlain),
    };
  } catch {
    const fallback = fallbackOutput(input);
    return {
      ...fallback,
      descriptionHtml: plainToBasicHtml(fallback.descriptionPlain),
    };
  }
}