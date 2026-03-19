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

type Degree = z.infer<typeof DegreeSchema>;
type LanguageLevel = z.infer<typeof LanguageLevelSchema>;

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
  currentMinDegree?: Degree | null;
  currentLanguages?: Array<{
    name: string;
    level: LanguageLevel;
  }>;
};

const WEAK_SKILL_TERMS = new Set([
  "comunicación",
  "comunicacion",
  "trabajo en equipo",
  "proactivo",
  "proactiva",
  "proactividad",
  "responsable",
  "responsabilidad",
  "liderazgo",
  "actitud",
  "compromiso",
  "organización",
  "organizacion",
  "analítico",
  "analitico",
  "analitica",
  "analítica",
  "adaptabilidad",
  "resolución de problemas",
  "resolucion de problemas",
]);

function normalizeText(value: string) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/^[•*\-]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqClean(values: string[] | undefined | null, limit?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of values ?? []) {
    const value = normalizeText(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (typeof limit === "number" && out.length >= limit) break;
  }

  return out;
}

function normalizeLanguageName(name: string) {
  const raw = normalizeText(name).toLowerCase();

  if (!raw) return "";
  if (["ingles", "inglés", "english"].includes(raw)) return "Inglés";
  if (["espanol", "español", "spanish"].includes(raw)) return "Español";
  if (["portugues", "portugués", "portuguese"].includes(raw)) return "Portugués";
  if (["frances", "francés", "french"].includes(raw)) return "Francés";
  if (["aleman", "alemán", "german"].includes(raw)) return "Alemán";

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function uniqLanguages(
  values:
    | Array<{
        name: string;
        level: LanguageLevel;
      }>
    | undefined
    | null,
  limit = 5
) {
  const seen = new Set<string>();
  const out: Array<{
    name: string;
    level: LanguageLevel;
  }> = [];

  for (const item of values ?? []) {
    const name = normalizeLanguageName(item?.name || "");
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

function isWeakSkillItem(value: string) {
  const item = normalizeText(value).toLowerCase();
  if (!item) return true;
  if (item.length <= 2) return true;
  if (item.length > 60) return true;
  if (WEAK_SKILL_TERMS.has(item)) return true;
  return false;
}

function cleanSkills(values: string[] | undefined | null, limit = 12) {
  return uniqClean(values, limit).filter((item) => !isWeakSkillItem(item));
}

function removeOverlap(primary: string[], secondary: string[], limit: number) {
  const primarySet = new Set(primary.map((item) => item.trim().toLowerCase()));
  return uniqClean(
    secondary.filter((item) => !primarySet.has(item.trim().toLowerCase())),
    limit
  );
}

function preferExistingIfWeak<T>(
  next: T[],
  current: T[],
  options?: { minItems?: number }
) {
  const minItems = options?.minItems ?? 1;
  if (next.length >= minItems) return next;
  if (current.length > 0) return current;
  return next;
}

function chooseMinDegree(
  next: Degree | null | undefined,
  current: Degree | null | undefined,
  mode: JobWizardAIInput["mode"]
): Degree | null {
  if (next) return next;
  if (current) return current;
  if (mode === "extract-structure" || mode === "improve-description") return current ?? null;
  return "BACHELOR";
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
    input.currentMinDegree
      ? `Nivel mínimo actual: ${input.currentMinDegree}`
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
- Mantén requiredSkills, niceSkills, eduRequired, eduNice, certs, minDegree y languages estables, salvo ajustes mínimos y obvios de consistencia.
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
    minDegree: input.currentMinDegree ?? "BACHELOR",
    requiredSkills: uniqClean(input.currentRequiredSkills, 8),
    niceSkills: uniqClean(input.currentNiceSkills, 8),
    eduRequired: uniqClean(input.currentEduRequired, 5),
    eduNice: uniqClean(input.currentEduNice, 5),
    certs: uniqClean(input.currentCerts, 5),
    languages: uniqLanguages(input.currentLanguages, 5),
  };
}

function normalizeOutput(
  safeData: JobWizardAIOutput,
  input: JobWizardAIInput
): JobWizardAIOutput {
  const cleanedRequiredSkills = cleanSkills(safeData.requiredSkills, 12);
  const cleanedNiceSkills = removeOverlap(
    cleanedRequiredSkills,
    cleanSkills(safeData.niceSkills, 12),
    12
  );

  const cleanedEduRequired = uniqClean(safeData.eduRequired, 8);
  const cleanedEduNice = removeOverlap(
    cleanedEduRequired,
    uniqClean(safeData.eduNice, 8),
    8
  );

  const cleanedCerts = uniqClean(safeData.certs, 8);
  const cleanedLanguages = uniqLanguages(safeData.languages, 5);

  const currentRequiredSkills = uniqClean(input.currentRequiredSkills, 12);
  const currentNiceSkills = uniqClean(input.currentNiceSkills, 12);
  const currentEduRequired = uniqClean(input.currentEduRequired, 8);
  const currentEduNice = uniqClean(input.currentEduNice, 8);
  const currentCerts = uniqClean(input.currentCerts, 8);
  const currentLanguages = uniqLanguages(input.currentLanguages, 5);

  return {
    descriptionPlain: safeData.descriptionPlain.trim(),
    minDegree: chooseMinDegree(
      safeData.minDegree ?? null,
      input.currentMinDegree ?? null,
      input.mode
    ),
    requiredSkills: preferExistingIfWeak(cleanedRequiredSkills, currentRequiredSkills, {
      minItems: input.mode === "extract-structure" ? 2 : 1,
    }),
    niceSkills: preferExistingIfWeak(cleanedNiceSkills, currentNiceSkills, {
      minItems: 1,
    }),
    eduRequired: preferExistingIfWeak(cleanedEduRequired, currentEduRequired, {
      minItems: 1,
    }),
    eduNice: preferExistingIfWeak(cleanedEduNice, currentEduNice, {
      minItems: 1,
    }),
    certs: preferExistingIfWeak(cleanedCerts, currentCerts, {
      minItems: 1,
    }),
    languages: preferExistingIfWeak(cleanedLanguages, currentLanguages, {
      minItems: 1,
    }),
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

    const normalized = normalizeOutput(safe.data, input);

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