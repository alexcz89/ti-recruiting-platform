// lib/schemas/profile.ts
import { z } from "zod";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** URL laxa: acepta con o sin http(s):// y permite vacío */
const UrlLoose = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ?? "").trim())
  .refine(
    (v) => v === "" || /^(https?:\/\/)?[^\s]+\.[^\s]+/i.test(v),
    "URL inválida"
  );

/* =========================
   Experiencia laboral
========================= */
export const ExperienceSchema = z
  .object({
    role: z.string().min(2, "Rol requerido"),
    company: z.string().min(2, "Empresa requerida"),
    startDate: z.string().regex(MONTH_RE, "Formato inválido (YYYY-MM)"),
    endDate: z
      .union([
        z.string().regex(MONTH_RE, "Formato inválido (YYYY-MM)"),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .nullable(),
    isCurrent: z.boolean().optional().default(false),
  })
  .refine(
    (v) => {
      // Si es actual, endDate debe ser vacío o null
      if (v.isCurrent) return !v.endDate || v.endDate === "";
      // Si NO es actual, endDate debe existir y ser cronológicamente válido
      if (v.endDate === "" || v.endDate == null) return false;
      const s = new Date(`${v.startDate}-01T00:00:00.000Z`);
      const e = new Date(`${v.endDate}-01T00:00:00.000Z`);
      return !isNaN(s.getTime()) && !isNaN(e.getTime()) && s.getTime() <= e.getTime();
    },
    { message: "Rango de fechas inválido", path: ["endDate"] }
  );

/* =========================
   Idiomas y skills
========================= */
export const LanguageSchema = z.object({
  termId: z.string().min(1, "Idioma requerido"),
  label: z.string().min(1),
  level: z.enum(["NATIVE", "PROFESSIONAL", "CONVERSATIONAL", "BASIC"]),
});

export const SkillDetailedSchema = z.object({
  termId: z.string().min(1, "Skill requerido"),
  label: z.string().min(1),
  level: z.number().int().min(1).max(5),
});

/* =========================
   Escolaridad
========================= */
export const EducationLevel = z.enum([
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

export const EducationStatus = z.enum(["ONGOING", "COMPLETED", "INCOMPLETE"]);

export const EducationSchema = z
  .object({
    id: z.string().optional(), // para upsert si existe en DB
    level: EducationLevel.nullable(), // opcional por registro
    status: EducationStatus,
    institution: z.string().min(1, "Institución requerida"),
    program: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    startDate: z.string().regex(MONTH_RE).optional().nullable(), // YYYY-MM
    endDate: z.string().regex(MONTH_RE).optional().nullable(), // YYYY-MM (o null si ONGOING)
    grade: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    sortIndex: z.number().int().min(0),
  })
  .superRefine((v, ctx) => {
    // Si está en curso → Fin debe ir vacío
    if (v.status === "ONGOING" && v.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Si está en curso, 'Fin' debe quedar vacío.",
      });
    }
    // Validación cronológica si hay ambas fechas
    if (v.startDate && v.endDate) {
      const s = new Date(`${v.startDate}-01T00:00:00.000Z`);
      const e = new Date(`${v.endDate}-01T00:00:00.000Z`);
      if (!(s.getTime() <= e.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "El fin no puede ser anterior al inicio.",
        });
      }
    }
  });

/* =========================
   Perfil del candidato
========================= */
export const ProfileFormSchema = z.object({
  firstName: z.string().min(2, "Nombre requerido"),
  lastName1: z.string().min(2, "Apellido paterno requerido"),
  lastName2: z.string().optional(),
  location: z.string().min(2, "Ubicación requerida"),
  birthdate: z.string().optional(),
  linkedin: UrlLoose,
  github: UrlLoose,
  resumeUrl: UrlLoose, // ← agregado para validar la URL del CV
  phoneCountry: z.string().default("52"),
  phoneLocal: z.string().optional(),
  certifications: z.array(z.string()).optional().default([]),
  experiences: z.array(ExperienceSchema).optional().default([]),
  languages: z.array(LanguageSchema).optional().default([]),
  skillsDetailed: z.array(SkillDetailedSchema).optional().default([]),

  // 🔹 NUEVOS
  highestEducationLevel: EducationLevel.optional().default("NONE"),
  education: z.array(EducationSchema).optional().default([]),
});

export type ProfileFormData = z.infer<typeof ProfileFormSchema>;
export type EducationFormData = z.infer<typeof EducationSchema>;
export type EducationLevelType = z.infer<typeof EducationLevel>;
export type EducationStatusType = z.infer<typeof EducationStatus>;
