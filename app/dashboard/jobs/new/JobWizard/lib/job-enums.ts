// app/dashboard/jobs/new/JobWizard/lib/job-enums.ts

export const LOCATION_TYPE_VALUES = ["ONSITE", "HYBRID", "REMOTE"] as const;
export type LocationTypeValue = (typeof LOCATION_TYPE_VALUES)[number];

export const EMPLOYMENT_TYPE_VALUES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
] as const;
export type EmploymentTypeValue = (typeof EMPLOYMENT_TYPE_VALUES)[number];

export const DEGREE_VALUES = [
  "HIGH_SCHOOL",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
] as const;
export type DegreeValue = (typeof DEGREE_VALUES)[number];

export const LOCATION_TYPE_OPTIONS: Array<{
  value: LocationTypeValue;
  label: string;
}> = [
  { value: "ONSITE", label: "Presencial" },
  { value: "HYBRID", label: "Híbrido" },
  { value: "REMOTE", label: "Remoto" },
];

export const EMPLOYMENT_TYPE_OPTIONS: Array<{
  value: EmploymentTypeValue;
  label: string;
}> = [
  { value: "FULL_TIME", label: "Tiempo completo" },
  { value: "PART_TIME", label: "Medio tiempo" },
  { value: "CONTRACT", label: "Por contrato" },
  { value: "TEMPORARY", label: "Temporal" },
  { value: "INTERNSHIP", label: "Prácticas / Internship" },
];

export const DEGREE_OPTIONS: Array<{
  value: DegreeValue;
  label: string;
}> = [
  { value: "HIGH_SCHOOL", label: "Bachillerato" },
  { value: "BACHELOR", label: "Licenciatura / Ingeniería" },
  { value: "MASTER", label: "Maestría" },
  { value: "DOCTORATE", label: "Doctorado" },
];

const DEGREE_ALIASES: Record<string, DegreeValue> = {
  HIGH_SCHOOL: "HIGH_SCHOOL",
  HIGHSCHOOL: "HIGH_SCHOOL",
  BACHILLERATO: "HIGH_SCHOOL",
  PREPARATORIA: "HIGH_SCHOOL",

  BACHELOR: "BACHELOR",
  BACHELORS: "BACHELOR",
  LICENCIATURA: "BACHELOR",
  INGENIERIA: "BACHELOR",
  "INGENIERÍA": "BACHELOR",
  "LICENCIATURA / INGENIERIA": "BACHELOR",
  "LICENCIATURA / INGENIERÍA": "BACHELOR",

  MASTER: "MASTER",
  MASTERS: "MASTER",
  MAESTRIA: "MASTER",
  MAESTRÍA: "MASTER",

  DOCTORATE: "DOCTORATE",
  DOCTORADO: "DOCTORATE",
  PHD: "DOCTORATE",
};

const EMPLOYMENT_TYPE_ALIASES: Record<string, EmploymentTypeValue> = {
  FULL_TIME: "FULL_TIME",
  FULLTIME: "FULL_TIME",
  TIEMPO_COMPLETO: "FULL_TIME",

  PART_TIME: "PART_TIME",
  PARTTIME: "PART_TIME",
  MEDIO_TIEMPO: "PART_TIME",

  CONTRACT: "CONTRACT",
  CONTRATO: "CONTRACT",

  TEMPORARY: "TEMPORARY",
  TEMPORAL: "TEMPORARY",

  INTERNSHIP: "INTERNSHIP",
  PRACTICAS: "INTERNSHIP",
  "PRÁCTICAS": "INTERNSHIP",
};

const LOCATION_TYPE_ALIASES: Record<string, LocationTypeValue> = {
  ONSITE: "ONSITE",
  PRESENCIAL: "ONSITE",

  HYBRID: "HYBRID",
  HIBRIDO: "HYBRID",
  "HÍBRIDO": "HYBRID",

  REMOTE: "REMOTE",
  REMOTO: "REMOTE",
};

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeDegreeValue(value: unknown): DegreeValue | undefined {
  if (DEGREE_VALUES.includes(value as DegreeValue)) {
    return value as DegreeValue;
  }

  const key = normalizeKey(value);
  return key ? DEGREE_ALIASES[key] : undefined;
}

export function normalizeEmploymentTypeValue(
  value: unknown
): EmploymentTypeValue | undefined {
  if (EMPLOYMENT_TYPE_VALUES.includes(value as EmploymentTypeValue)) {
    return value as EmploymentTypeValue;
  }

  const key = normalizeKey(value);
  return key ? EMPLOYMENT_TYPE_ALIASES[key] : undefined;
}

export function normalizeLocationTypeValue(
  value: unknown
): LocationTypeValue | undefined {
  if (LOCATION_TYPE_VALUES.includes(value as LocationTypeValue)) {
    return value as LocationTypeValue;
  }

  const key = normalizeKey(value);
  return key ? LOCATION_TYPE_ALIASES[key] : undefined;
}

export function isDegreeValue(value: unknown): value is DegreeValue {
  return DEGREE_VALUES.includes(value as DegreeValue);
}

export function isEmploymentTypeValue(
  value: unknown
): value is EmploymentTypeValue {
  return EMPLOYMENT_TYPE_VALUES.includes(value as EmploymentTypeValue);
}

export function isLocationTypeValue(
  value: unknown
): value is LocationTypeValue {
  return LOCATION_TYPE_VALUES.includes(value as LocationTypeValue);
}