import { z } from "zod";

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

const YearMonthSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}$/.test(value), {
    message: 'Date must be in "YYYY-MM" format or empty string',
  });

export const AiCvSchema = z.object({
  summary: z.string().trim().default(""),
  seniority: z.enum(["junior", "mid", "senior"]).default("mid"),
  skills: z.array(z.string().trim()).default([]),
  yearsExperience: z
    .union([z.number(), z.string()])
    .transform((value) => {
      const num =
        typeof value === "string" ? Number.parseInt(value, 10) : value;
      return Number.isNaN(num) || num < 0 ? 0 : Math.floor(num);
    })
    .default(0),
  recommendedRoles: z.array(z.string().trim()).default([]),
  redFlags: z.array(z.string().trim()).default([]),
  linkedin: z.string().trim().default(""),
  github: z.string().trim().default(""),
  languages: z
    .array(
      z.object({
        label: z.string().trim().default(""),
        level: LanguageLevelSchema.default("CONVERSATIONAL"),
      })
    )
    .default([]),
  experiences: z
    .array(
      z.object({
        role: z.string().trim().default(""),
        company: z.string().trim().default(""),
        startDate: YearMonthSchema.default(""),
        endDate: YearMonthSchema.default(""),
        isCurrent: z.boolean().default(false),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string().trim().default(""),
        program: z.string().trim().default(""),
        startDate: YearMonthSchema.default(""),
        endDate: YearMonthSchema.default(""),
        level: EducationLevelSchema.nullable().default(null),
      })
    )
    .default([]),
});

export const AiCvMetaSchema = z.object({
  model: z.string(),
  parsedAt: z.string(),
  error: z.string().optional(),
  warning: z.string().optional(),
});

export const AiCvResponseSchema = AiCvSchema.extend({
  _meta: AiCvMetaSchema,
});

export type AiCvResult = z.infer<typeof AiCvSchema>;
export type AiCvResponse = z.infer<typeof AiCvResponseSchema>;