import { z } from "zod";

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const YearMonthSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || YEAR_MONTH.test(value), {
    message: "La fecha debe usar el formato YYYY-MM",
  });

const LanguageLevelSchema = z.enum([
  "NATIVE",
  "PROFESSIONAL",
  "CONVERSATIONAL",
  "BASIC",
]);

const EducationLevelSchema = z.enum([
  "NONE",
  "PRIMARY",
  "SECONDARY",
  "HIGH_SCHOOL",
  "TECHNICAL",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
  "OTHER",
]);

export const CvImportAnalysisSchema = z.object({
  location: z.string().trim().max(200).default(""),
  phonePrimary: z.string().trim().max(40).nullable().default(null),
  linkedin: z.string().trim().max(500).default(""),
  github: z.string().trim().max(500).default(""),
  seniority: z.enum(["junior", "mid", "senior"]).default("mid"),
  yearsExperience: z.number().int().min(0).max(80).default(0),
  experiences: z
    .array(
      z.object({
        role: z.string().trim().max(200).default(""),
        company: z.string().trim().max(200).default(""),
        startDate: YearMonthSchema.default(""),
        endDate: YearMonthSchema.nullable().default(""),
        isCurrent: z.boolean().default(false),
      })
    )
    .max(50)
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string().trim().max(250).default(""),
        program: z.string().trim().max(250).default(""),
        startDate: YearMonthSchema.default(""),
        endDate: YearMonthSchema.nullable().default(""),
        level: EducationLevelSchema.nullable().default(null),
      })
    )
    .max(30)
    .default([]),
  skillsMatched: z
    .array(
      z.object({
        termId: z.string().min(1).max(100),
        label: z.string().trim().min(1).max(120),
      })
    )
    .max(100)
    .default([]),
  languages: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        level: LanguageLevelSchema.default("CONVERSATIONAL"),
      })
    )
    .max(30)
    .default([]),
});

export const CvImportSectionsSchema = z.object({
  personal: z.boolean(),
  experiences: z.boolean(),
  education: z.boolean(),
  skills: z.boolean(),
  languages: z.boolean(),
});

export const CvImportApplySchema = z.object({
  resumeUrl: z.string().url().max(2048),
  sections: CvImportSectionsSchema,
  analysis: CvImportAnalysisSchema,
});

export type CvImportAnalysis = z.infer<typeof CvImportAnalysisSchema>;
export type CvImportSections = z.infer<typeof CvImportSectionsSchema>;

export function normalizeComparison(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseYearMonth(value: string | null | undefined) {
  if (!value || !YEAR_MONTH.test(value)) return null;
  return new Date(`${value}-01T00:00:00.000Z`);
}

export function yearMonthFromDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 7) : "";
}

export function experienceFingerprint(input: {
  role: string;
  company: string;
  startDate: string;
}) {
  return [input.role, input.company, input.startDate]
    .map(normalizeComparison)
    .join("|");
}

export function educationFingerprint(input: {
  institution: string;
  program?: string | null;
  startDate?: string | null;
}) {
  return [input.institution, input.program, input.startDate]
    .map(normalizeComparison)
    .join("|");
}
