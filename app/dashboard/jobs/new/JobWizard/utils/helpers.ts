// app/dashboard/jobs/new/JobWizard/utils/helpers.ts

import DOMPurify from "dompurify";
import type { JobForm, PresetCompany } from "../types";
import { BENEFITS } from "../constants";
import {
  DEGREE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
} from "../lib/job-enums";

type LanguageProficiency =
  | "NATIVE"
  | "PROFESSIONAL"
  | "CONVERSATIONAL"
  | "BASIC";

type WizardEducationItem = {
  name: string;
  required: boolean;
};

type WizardSkillItem = {
  name: string;
  required: boolean;
};

type WizardLanguageItem = {
  name: string;
  level: LanguageProficiency;
};

type WizardInitialData = Partial<JobForm> & {
  id?: string;
  benefitsJson?: unknown;
  description?: string | null;
  education?: WizardEducationItem[] | null;
  skills?: WizardSkillItem[] | null;
  certs?: string[] | null;
  languages?: WizardLanguageItem[] | null;
};

function getLabel(
  options: Array<{ value: string; label: string }>,
  value?: string | null
) {
  return options.find((o) => o.value === value)?.label || value || "—";
}

export function sanitizeHtml(html: string) {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "strong", "em", "ul", "ol", "li", "p", "br"],
    ALLOWED_ATTR: [],
  });
}

export function htmlToPlain(html: string) {
  if (!html) return "";
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

export function labelEmployment(e?: JobForm["employmentType"]) {
  return getLabel(EMPLOYMENT_TYPE_OPTIONS, e);
}

export function labelDegree(d?: JobForm["minDegree"]) {
  return getLabel(DEGREE_OPTIONS, d);
}

export function labelLanguageLevel(l: LanguageProficiency) {
  switch (l) {
    case "NATIVE":
      return "Nativo";
    case "PROFESSIONAL":
      return "Profesional (C1–C2)";
    case "CONVERSATIONAL":
      return "Conversacional (B1–B2)";
    case "BASIC":
      return "Básico (A1–A2)";
    default:
      return l;
  }
}

export function clampNonNegative(n: string) {
  const v = Math.max(0, Number(n || 0));
  if (!Number.isFinite(v)) return "";
  return String(v);
}

export function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function makeDefaultValues({
  presetCompany,
  initial,
}: {
  presetCompany?: PresetCompany;
  initial?: WizardInitialData;
}): JobForm {
  const benefitsBase = BENEFITS.reduce((acc, b) => {
    acc[b.key] = b.def;
    return acc;
  }, {} as Record<string, boolean>);

  const showBenefits =
    typeof initial?.showBenefits === "boolean" ? initial.showBenefits : true;

  let benefitsJson = benefitsBase;
  let aguinaldoDias = 15;
  let vacacionesDias = 12;
  let primaVacPct = 25;

  if (initial?.benefitsJson && typeof initial.benefitsJson === "object") {
    const b = initial.benefitsJson as Record<string, unknown>;
    const base = { ...benefitsBase };

    for (const k of Object.keys(base)) {
      base[k] = typeof b[k] === "boolean" ? (b[k] as boolean) : base[k];
    }

    benefitsJson = base;

    if (typeof b.aguinaldoDias === "number") aguinaldoDias = b.aguinaldoDias;
    if (typeof b.vacacionesDias === "number") vacacionesDias = b.vacacionesDias;
    if (typeof b.primaVacPct === "number") primaVacPct = b.primaVacPct;
  } else if (initial?.benefits && typeof initial.benefits === "object") {
    benefitsJson = {
      ...benefitsBase,
      ...initial.benefits,
    };
  }

  const plainFromInitial = initial?.descriptionPlain || initial?.description || "";
  let rawHtml = initial?.descriptionHtml || "";

  if (!rawHtml && plainFromInitial) {
    const lines = plainFromInitial
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean);

    rawHtml = lines.length
      ? lines.map((line: string) => `<p>${escapeHtml(line)}</p>`).join("\n")
      : "";
  }

  const html = sanitizeHtml(rawHtml || "");
  const plain = plainFromInitial || (html ? htmlToPlain(html) : "");

  const initEdu: WizardEducationItem[] = Array.isArray(initial?.education)
    ? initial.education
    : [];

  const eduReq = initEdu
    .filter((e: WizardEducationItem) => e.required)
    .map((e: WizardEducationItem) => e.name);

  const eduNice = initEdu
    .filter((e: WizardEducationItem) => !e.required)
    .map((e: WizardEducationItem) => e.name);

  const initSkills: WizardSkillItem[] = Array.isArray(initial?.skills)
    ? initial.skills
    : [];

  const skillsReq = initSkills
    .filter((s: WizardSkillItem) => s.required)
    .map((s: WizardSkillItem) => s.name);

  const skillsNice = initSkills
    .filter((s: WizardSkillItem) => !s.required)
    .map((s: WizardSkillItem) => s.name);

  const languagesInit: WizardLanguageItem[] = Array.isArray(initial?.languages)
    ? initial.languages
    : [];

  const companyMode: JobForm["companyMode"] =
    initial?.companyMode === "own"
      ? "own"
      : presetCompany?.id
        ? "own"
        : "external";

  return {
    title: initial?.title ?? "",
    companyMode,
    companyOtherName: initial?.companyOtherName ?? "",
    locationType: initial?.locationType ?? "ONSITE",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    admin1: initial?.admin1 ?? "",
    cityNorm: initial?.cityNorm ?? "",
    admin1Norm: initial?.admin1Norm ?? "",
    locationLat: initial?.locationLat ?? null,
    locationLng: initial?.locationLng ?? null,
    currency: initial?.currency === "USD" ? "USD" : "MXN",
    salaryMin:
      typeof initial?.salaryMin === "number"
        ? initial.salaryMin
        : typeof initial?.salaryMin === "string"
          ? Number(initial.salaryMin) || undefined
          : undefined,
    salaryMax:
      typeof initial?.salaryMax === "number"
        ? initial.salaryMax
        : typeof initial?.salaryMax === "string"
          ? Number(initial.salaryMax) || undefined
          : undefined,
    showSalary: !!initial?.showSalary,
    employmentType: initial?.employmentType ?? "FULL_TIME",
    schedule: initial?.schedule ?? "",
    showBenefits,
    benefits: benefitsJson,
    aguinaldoDias,
    vacacionesDias,
    primaVacPct,
    assessmentTemplateId: initial?.assessmentTemplateId ?? undefined,
    descriptionHtml: html,
    descriptionPlain: plain,
    minDegree: initial?.minDegree ?? undefined,
    eduRequired:
      eduReq.length > 0 ? eduReq : Array.isArray(initial?.eduRequired) ? initial.eduRequired : [],
    eduNice:
      eduNice.length > 0 ? eduNice : Array.isArray(initial?.eduNice) ? initial.eduNice : [],
    requiredSkills:
      skillsReq.length > 0
        ? skillsReq
        : Array.isArray(initial?.requiredSkills)
          ? initial.requiredSkills
          : [],
    niceSkills:
      skillsNice.length > 0
        ? skillsNice
        : Array.isArray(initial?.niceSkills)
          ? initial.niceSkills
          : [],
    certs: Array.isArray(initial?.certs) ? initial.certs : [],
    languages: languagesInit,
  };
}

export type JobQualitySummary = {
  score: number;
  missingRecommended: string[];
  strengths: string[];
};

function hasMeaningfulDescription(values: Partial<JobForm>) {
  const plain = String(values.descriptionPlain || "").trim();
  return plain.length >= 80;
}

function getTotalSkills(values: Partial<JobForm>) {
  return (values.requiredSkills?.length || 0) + (values.niceSkills?.length || 0);
}

function hasValidSalaryValue(value: unknown) {
  if (typeof value === "number" && !Number.isNaN(value)) return true;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return !Number.isNaN(n);
  }
  return false;
}

function hasSalaryInfo(values: Partial<JobForm>) {
  return (
    hasValidSalaryValue(values.salaryMin) ||
    hasValidSalaryValue(values.salaryMax)
  );
}

function hasBenefitsInfo(values: Partial<JobForm>) {
  return Object.values(values.benefits || {}).some(Boolean);
}

function hasEducationInfo(values: Partial<JobForm>) {
  return (
    !!values.minDegree ||
    (values.eduRequired?.length || 0) > 0 ||
    (values.eduNice?.length || 0) > 0
  );
}

function hasLanguageInfo(values: Partial<JobForm>) {
  return (values.languages?.length || 0) > 0;
}

function hasAssessment(values: Partial<JobForm>) {
  return !!values.assessmentTemplateId;
}

export function getJobQualitySummary(
  values: Partial<JobForm>
): JobQualitySummary {
  let score = 0;
  const missingRecommended: string[] = [];
  const strengths: string[] = [];

  if ((values.title || "").trim().length >= 4) {
    score += 10;
    strengths.push("Título claro");
  } else {
    missingRecommended.push("Título poco claro");
  }

  if (hasMeaningfulDescription(values)) {
    score += 25;
    strengths.push("Descripción completa");
  } else {
    missingRecommended.push("Descripción poco detallada");
  }

  const totalSkills = getTotalSkills(values);
  if (totalSkills >= 5) {
    score += 20;
    strengths.push("Skills bien definidas");
  } else if (totalSkills >= 1) {
    score += 10;
  } else {
    missingRecommended.push("Faltan skills");
  }

  if ((values.requiredSkills?.length || 0) >= 1) {
    score += 5;
    strengths.push("Skills requeridas");
  }

  if (hasSalaryInfo(values)) {
    score += 10;
    strengths.push("Sueldo definido");
  } else {
    missingRecommended.push("Sueldo no especificado");
  }

  if (hasBenefitsInfo(values)) {
    score += 10;
    strengths.push("Prestaciones configuradas");
  } else {
    missingRecommended.push("Prestaciones no configuradas");
  }

  if (hasEducationInfo(values)) {
    score += 8;
    strengths.push("Educación definida");
  }

  if (hasLanguageInfo(values)) {
    score += 4;
    strengths.push("Idiomas definidos");
  }

  if (hasAssessment(values)) {
    score += 8;
    strengths.push("Evaluación técnica ligada");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    missingRecommended,
    strengths,
  };
}