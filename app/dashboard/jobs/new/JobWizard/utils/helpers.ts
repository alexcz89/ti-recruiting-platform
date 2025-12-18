// JobWizard/utils/helpers.ts
import DOMPurify from "dompurify";
import {
  EmploymentType,
  DegreeLevel,
  LanguageProficiency,
  JobForm,
  PresetCompany,
  JobWizardProps,
} from "../types";
import { BENEFITS } from "../constants";

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

export function labelEmployment(e: EmploymentType) {
  switch (e) {
    case "FULL_TIME":
      return "Tiempo completo";
    case "PART_TIME":
      return "Medio tiempo";
    case "CONTRACT":
      return "Por periodo";
    case "INTERNSHIP":
      return "Prácticas profesionales";
  }
}

export function labelDegree(d: DegreeLevel) {
  switch (d) {
    case "HIGHSCHOOL":
      return "Bachillerato";
    case "TECH":
      return "Técnico";
    case "BACHELOR":
      return "Licenciatura / Ingeniería";
    case "MASTER":
      return "Maestría";
    case "PHD":
      return "Doctorado";
  }
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
  presetCompany: PresetCompany;
  initial?: JobWizardProps["initial"];
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
    const b = initial.benefitsJson as any;
    const base = { ...benefitsBase };
    for (const k of Object.keys(base)) {
      base[k] = typeof b[k] === "boolean" ? b[k] : base[k];
    }
    benefitsJson = base;
    if (typeof b.aguinaldoDias === "number") aguinaldoDias = b.aguinaldoDias;
    if (typeof b.vacacionesDias === "number")
      vacacionesDias = b.vacacionesDias;
    if (typeof b.primaVacPct === "number") primaVacPct = b.primaVacPct;
  }

  const plainFromInitial = initial?.description || "";
  let rawHtml = initial?.descriptionHtml || "";

  if (!rawHtml && plainFromInitial) {
    const lines = plainFromInitial
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length) {
      rawHtml = lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("\n");
    } else {
      rawHtml = "";
    }
  }

  const html = sanitizeHtml(rawHtml || "");
  const plain = plainFromInitial || (html ? htmlToPlain(html) : "");

  const initEdu = Array.isArray(initial?.education) ? initial.education : [];
  const eduReq = initEdu.filter((e) => e.required).map((e) => e.name);
  const eduNice = initEdu.filter((e) => !e.required).map((e) => e.name);

  const initSkills = Array.isArray(initial?.skills) ? initial.skills : [];
  const skillsReq = initSkills.filter((s) => s.required).map((s) => s.name);
  const skillsNice = initSkills.filter((s) => !s.required).map((s) => s.name);

  const defaultCompanyModeRaw =
    initial?.companyMode ?? (presetCompany?.id ? "own" : "confidential");
  const companyMode =
    defaultCompanyModeRaw === "other"
      ? "own"
      : (defaultCompanyModeRaw as "own" | "confidential");

  const languagesInit = Array.isArray(initial?.languages)
    ? initial.languages
    : [];

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
    currency: initial?.currency ?? "MXN",
    salaryMin:
      initial?.salaryMin === null || initial?.salaryMin === undefined
        ? ""
        : String(initial.salaryMin),
    salaryMax:
      initial?.salaryMax === null || initial?.salaryMax === undefined
        ? ""
        : String(initial.salaryMax),
    showSalary: !!initial?.showSalary,
    employmentType: initial?.employmentType ?? "FULL_TIME",
    schedule: initial?.schedule ?? "",
    showBenefits,
    benefits: benefitsJson,
    aguinaldoDias,
    vacacionesDias,
    primaVacPct,
    descriptionHtml: html,
    descriptionPlain: plain,
    minDegree: initial?.minDegree ?? "BACHELOR",
    eduRequired: eduReq,
    eduNice,
    requiredSkills: skillsReq,
    niceSkills: skillsNice,
    certs: Array.isArray(initial?.certs) ? initial.certs : [],
    languages: languagesInit,
  };
}
