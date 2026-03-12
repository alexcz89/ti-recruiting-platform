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
  mode?: "generate-all" | "improve-description" | "extract-structure";
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
  const mode = input.mode ?? "generate-all";

  const benefitsBlock =
    input.benefits && input.benefits.length
      ? input.benefits.map((b) => `- ${b}`).join("\n")
      : "No especificadas";

  const hasExistingDescription = !!input.currentDescriptionPlain?.trim();

  const existingBlock = [
    input.currentDescriptionPlain?.trim()
      ? `Descripción base escrita por el reclutador:\n${input.currentDescriptionPlain.trim()}`
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

  const objective =
    mode === "improve-description"
      ? "Mejorar, reestructurar y profesionalizar la descripción actual sin cambiar innecesariamente la intención del reclutador."
      : mode === "extract-structure"
        ? "Analizar la descripción actual y convertirla en estructura útil para el ATS, sin reescribir ni expandir innecesariamente el texto."
        : hasExistingDescription
          ? "Mejorar y estructurar el contenido base del reclutador, complementándolo solo cuando haga sentido."
          : "Generar un primer borrador útil a partir del título y del contexto disponible.";

  const modeRules =
    mode === "improve-description"
      ? `
Reglas adicionales para este modo:
- Enfócate principalmente en "descriptionPlain".
- Reescribe la descripción para que sea más clara, profesional y publicable.
- Conserva la intención del texto base del reclutador.
- No cambies radicalmente el perfil buscado.
- No inventes tecnologías, beneficios o requisitos nuevos si no están respaldados por el contexto.
- Mantén requiredSkills, niceSkills, eduRequired, eduNice, certs y languages estables, salvo ajustes mínimos y obvios de consistencia.
`
      : mode === "extract-structure"
        ? `
Reglas adicionales para este modo:
- No reescribas ni expandas la descripción.
- Conserva "descriptionPlain" esencialmente igual al texto actual, salvo limpieza mínima.
- Extrae requiredSkills y niceSkills a partir de la descripción y del contexto.
- Si una skill parece claramente esencial para ejecutar el rol, colócala en requiredSkills.
- Si una skill parece complementaria, opcional o deseable, colócala en niceSkills.
- Extrae educación, idiomas y certificaciones solo si aparecen o se infieren claramente.
- No inventes tecnologías no mencionadas ni no inferibles claramente.
- Si no hay suficiente evidencia para una categoría, devuelve array vacío en esa categoría.
`
        : `
Reglas adicionales para este modo:
- Puedes proponer un borrador integral de descripción, skills, educación, certificaciones e idiomas.
- Si ya existe contenido útil, úsalo como base.
`;

  return `
Eres un recruiter técnico senior en México, especializado en vacantes de TI.

Tu tarea es ayudar a redactar o estructurar una vacante profesional, clara y útil para filtrar talento real.
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

Prioridad de fuentes:
1) Si existe contenido base escrito por el reclutador, úsalo como fuente principal.
2) Usa el título y demás campos del formulario solo para complementar, ordenar y enriquecer.
3) Si el contenido escrito por el reclutador entra en conflicto con el título, prioriza el contenido escrito por el reclutador.
4) No reemplaces arbitrariamente la intención del reclutador por una interpretación genérica del título.

Reglas:
- Responde en español.
- No inventes tecnologías extremadamente específicas si no se pueden inferir del puesto o del contenido base.
- Prioriza claridad y utilidad para reclutamiento real.
- "descriptionPlain" debe incluir, cuando aplique:
  1) breve contexto del rol,
  2) responsabilidades,
  3) requisitos,
  4) beneficios o condiciones.
- Usa saltos de línea y bullets simples con "- " cuando ayude.
- Separa skills obligatorias vs deseables de forma realista.
- No agregues certificaciones o idiomas a menos que tengan sentido claro.
- Evita duplicados.
- No exageres seniority ni requisitos.
- Si no hay base para estudios muy específicos, usa una sugerencia razonable.
- Si el rol es técnico profesional, normalmente "BACHELOR" es una sugerencia razonable.
- No inventes salario, horario, esquema de trabajo ni beneficios adicionales.
- Usa únicamente la información proporcionada.
- Si existen prestaciones capturadas, menciónalas de forma precisa.
- Si solo existen prestaciones base o legales, puedes referirte a ellas como "prestaciones de ley".
- No digas "prestaciones superiores a la ley" a menos que se indique explícitamente.
- Si ya existe contenido útil, mejóralo, organízalo y complétalo sin contradecirlo absurdamente.
- Si el reclutador ya escribió una base del job description, reescríbela en mejor formato, pero conserva su intención.
- Mantén la descripción entre 120 y 300 palabras aproximadamente, excepto cuando el modo sea extracción de estructura.
- No repitas skills en requiredSkills y niceSkills.
- La descripción debe seguir esta estructura cuando sea posible: contexto del rol, responsabilidades, requisitos, condiciones o prestaciones.
${modeRules}

Objetivo:
${objective}

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
  const mode = input.mode ?? "generate-all";

  const descriptionPlain = input.currentDescriptionPlain?.trim()
    ? input.currentDescriptionPlain.trim()
    : [
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
    requiredSkills:
      mode === "improve-description"
        ? uniqClean(input.currentRequiredSkills, 8)
        : uniqClean(input.currentRequiredSkills, 8),
    niceSkills:
      mode === "improve-description"
        ? uniqClean(input.currentNiceSkills, 8)
        : uniqClean(input.currentNiceSkills, 8),
    eduRequired:
      mode === "improve-description"
        ? uniqClean(input.currentEduRequired, 5)
        : uniqClean(input.currentEduRequired, 5),
    eduNice:
      mode === "improve-description"
        ? uniqClean(input.currentEduNice, 5)
        : uniqClean(input.currentEduNice, 5),
    certs:
      mode === "improve-description"
        ? uniqClean(input.currentCerts, 5)
        : uniqClean(input.currentCerts, 5),
    languages:
      mode === "improve-description"
        ? uniqLanguages(input.currentLanguages, 5)
        : uniqLanguages(input.currentLanguages, 5),
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