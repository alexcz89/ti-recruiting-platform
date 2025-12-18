// JobWizard/types.ts
import { z } from "zod";

export type LocationType = "REMOTE" | "HYBRID" | "ONSITE";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
export type Currency = "MXN" | "USD";
export type DegreeLevel = "HIGHSCHOOL" | "TECH" | "BACHELOR" | "MASTER" | "PHD";
export type LanguageProficiency = "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";

export type PresetCompany = { 
  id: string | null; 
  name: string | null;
};

export type TemplateJob = {
  id: string;
  title?: string;
  locationType?: LocationType;
  city?: string | null;
  country?: string | null;
  admin1?: string | null;
  cityNorm?: string | null;
  admin1Norm?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  currency?: Currency;
  salaryMin?: number | null;
  salaryMax?: number | null;
  showSalary?: boolean | null;
  employmentType?: EmploymentType;
  schedule?: string | null;
  benefitsJson?: any | null;
  description?: string | null;
  descriptionHtml?: string | null;
  education?: Array<{ name: string; required: boolean }> | null;
  minDegree?: DegreeLevel | null;
  skills?: Array<{ name: string; required: boolean }> | null;
  certs?: string[] | null;
  languages?: Array<{ name: string; level: LanguageProficiency }> | null;
};

export type JobWizardProps = {
  onSubmit: (fd: FormData) => Promise<any>;
  presetCompany: PresetCompany;
  skillsOptions: string[];
  certOptions: string[];
  templates?: TemplateJob[];
  initial?: {
    id?: string;
    title?: string;
    companyMode?: "own" | "other" | "confidential";
    companyOtherName?: string;
    locationType?: LocationType;
    city?: string;
    country?: string | null;
    admin1?: string | null;
    cityNorm?: string | null;
    admin1Norm?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;
    currency?: Currency;
    salaryMin?: number | string | null;
    salaryMax?: number | string | null;
    showSalary?: boolean;
    employmentType?: EmploymentType;
    schedule?: string;
    showBenefits?: boolean;
    benefitsJson?: Record<string, any>;
    description?: string;
    descriptionHtml?: string | null;
    education?: Array<{ name: string; required: boolean }>;
    minDegree?: DegreeLevel;
    skills?: Array<{ name: string; required: boolean }>;
    certs?: string[];
    languages?: Array<{ name: string; level: LanguageProficiency }>;
  };
};

// Zod schema
export const jobSchema = z.object({
  // Paso 1
  title: z.string().min(3, "Mínimo 3 caracteres."),
  companyMode: z.enum(["own", "confidential"]),
  companyOtherName: z.string().optional(),
  locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
  city: z.string().optional(),
  country: z.string().optional(),
  admin1: z.string().optional(),
  cityNorm: z.string().optional(),
  admin1Norm: z.string().optional(),
  locationLat: z.number().nullable().optional(),
  locationLng: z.number().nullable().optional(),
  currency: z.enum(["MXN", "USD"]),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  showSalary: z.boolean(),
  // Paso 2
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]),
  schedule: z.string().optional(),
  // Paso 3
  showBenefits: z.boolean(),
  benefits: z.record(z.boolean()),
  aguinaldoDias: z.number().min(0),
  vacacionesDias: z.number().min(0),
  primaVacPct: z.number().min(0).max(100),
  // Paso 4
  descriptionHtml: z.string().optional(),
  descriptionPlain: z.string().min(50, "Mínimo 50 caracteres."),
  minDegree: z.enum(["HIGHSCHOOL", "TECH", "BACHELOR", "MASTER", "PHD"]),
  eduRequired: z.array(z.string()),
  eduNice: z.array(z.string()),
  requiredSkills: z.array(z.string()),
  niceSkills: z.array(z.string()),
  certs: z.array(z.string()),
  languages: z.array(
    z.object({
      name: z.string(),
      level: z.enum(["NATIVE", "PROFESSIONAL", "CONVERSATIONAL", "BASIC"]),
    })
  ),
}).superRefine((data, ctx) => {
  if (
    (data.locationType === "HYBRID" || data.locationType === "ONSITE") &&
    !data.city?.trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Para híbrido/presencial, la ciudad es obligatoria.",
      path: ["city"],
    });
  }

  const min = data.salaryMin ? Number(data.salaryMin) : undefined;
  const max = data.salaryMax ? Number(data.salaryMax) : undefined;

  if (data.salaryMin && (Number.isNaN(min) || (min as number) < 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El sueldo mínimo debe ser ≥ 0.",
      path: ["salaryMin"],
    });
  }
  if (data.salaryMax && (Number.isNaN(max) || (max as number) < 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El sueldo máximo debe ser ≥ 0.",
      path: ["salaryMax"],
    });
  }
  if (
    typeof min === "number" &&
    typeof max === "number" &&
    !Number.isNaN(min) &&
    !Number.isNaN(max) &&
    min > max
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El sueldo mínimo no puede ser mayor que el máximo.",
      path: ["salaryMin"],
    });
  }
});

export type JobForm = z.infer<typeof jobSchema>;
