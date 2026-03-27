// app/dashboard/jobs/new/JobWizard/types.ts

import { z } from "zod";

import {
  EMPLOYMENT_TYPE_VALUES,
  LOCATION_TYPE_VALUES,
  DEGREE_VALUES,
  type EmploymentTypeValue,
  type LocationTypeValue,
  type DegreeValue,
} from "./lib/job-enums";

export const jobSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),

  companyMode: z.enum(["own", "external"]),
  companyOtherName: z.string().optional(),

  locationType: z.enum(LOCATION_TYPE_VALUES),
  city: z.string().min(1, "La ciudad es obligatoria"),

  country: z.string().optional(),
  admin1: z.string().optional(),
  cityNorm: z.string().optional(),
  admin1Norm: z.string().optional(),

  locationLat: z.number().nullable().optional(),
  locationLng: z.number().nullable().optional(),

  currency: z.enum(["MXN", "USD"]),
  salaryMin: z.coerce.number().nullable().optional(),
  salaryMax: z.coerce.number().nullable().optional(),
  showSalary: z.boolean(),

  employmentType: z.enum(EMPLOYMENT_TYPE_VALUES),

  schedule: z.string().optional(),

  showBenefits: z.boolean(),
  benefits: z.record(z.boolean()),
  aguinaldoDias: z.number(),
  vacacionesDias: z.number(),
  primaVacPct: z.number(),

  descriptionHtml: z.string(),
  descriptionPlain: z.string(),

  minDegree: z.enum(DEGREE_VALUES).optional(),

  eduRequired: z.array(z.string()),
  eduNice: z.array(z.string()),

  requiredSkills: z.array(z.string()),
  niceSkills: z.array(z.string()),

  certs: z.array(z.string()),
  languages: z
    .array(
      z.object({
        name: z.string(),
        level: z.enum([
          "NATIVE",
          "PROFESSIONAL",
          "CONVERSATIONAL",
          "BASIC",
        ]),
      })
    )
    .optional(),

  assessmentTemplateId: z.string().optional(),
});

export type JobForm = z.infer<typeof jobSchema> & {
  locationType: LocationTypeValue;
  employmentType: EmploymentTypeValue;
  minDegree?: DegreeValue;
};

export type PresetCompany = {
  id: string;
  name: string;
} | null;

export type TemplateJob = {
  id: string;
  title?: string | null;
  locationType?: string | null;
  city?: string | null;
  country?: string | null;
  admin1?: string | null;
  cityNorm?: string | null;
  admin1Norm?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  currency?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  showSalary?: boolean | null;
  employmentType?: string | null;
  schedule?: string | null;
  benefitsJson?: unknown;
  description?: string | null;
  descriptionHtml?: string | null;
  minDegree?: string | null;
  education?: Array<{ name: string; required: boolean }> | null;
  skills?: Array<{ name: string; required: boolean }> | null;
  certs?: string[] | null;
  languages?:
    | Array<{
        name: string;
        level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
      }>
    | null;
};

export type JobWizardProps = {
  onSubmit: (fd: FormData) => Promise<
    | {
        error?: string;
        redirectTo?: string;
      }
    | void
  >;
  presetCompany?: PresetCompany;
  skillsOptions: string[];
  certOptions: string[];
  templates?: TemplateJob[];
  initial?: Partial<JobForm> & {
    id?: string;
  };
};