// lib/validation.ts
import { z } from "zod";

// ================================
// Helpers
// ================================
export * from "@/lib/schemas/profile";

export const EmailSchema = z.string().email("Email inválido");

export const PhoneMxSchema = z
  .string()
  .min(10, "Teléfono muy corto")
  .regex(/^\+?(\d[\s-]?){10,15}$/, "Teléfono inválido");

// ================================
// 1) Schema usado actualmente por signup de Candidato
// (EL QUE TE FALTABA Y ROMPÍA EL BUILD)
// ================================
export const CandidateSignupSchema = z.object({
  name: z.string().min(1, "Nombre es obligatorio"),
  email: EmailSchema,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
export type CandidateSignupInput = z.infer<typeof CandidateSignupSchema>;

// ================================
// 2) Versión extendida (Registro completo de candidato)
// (puede usarse para el Resume Builder o un onboarding más largo)
// ================================
export const CandidateRegisterSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(120),
  email: EmailSchema.max(190),
  password: z.string().min(8, "Mínimo 8 caracteres").max(100),

  lastName: z.string().min(2, "Apellido muy corto").max(120).optional(),
  location: z.string().min(2, "Ubicación requerida").optional(),
  birthdate: z.string().optional(),

  linkedin: z.string().url("URL inválida").optional().or(z.literal("")),
  github: z.string().url("URL inválida").optional().or(z.literal("")),
  phone: PhoneMxSchema.optional().or(z.literal("")),

  skills: z.array(z.string()).optional().default([]),
  cvUrl: z.string().url("URL inválida").optional(),
});
export type CandidateRegisterInput = z.infer<typeof CandidateRegisterSchema>;

// ================================
// 3) Registro de Reclutador / Empresa
// ================================
export const RecruiterRegisterSchema = z.object({
  companyName: z.string().min(2, "Nombre de empresa requerido"),
  name: z.string().min(2, "Nombre requerido"),
  email: EmailSchema,
  password: z.string().min(6, "Mínimo 6 caracteres"),
  phone: PhoneMxSchema.optional().or(z.literal("")),
  country: z.string().min(2, "País requerido"),
  city: z.string().min(2, "Ciudad requerida"),
});

// ================================
// 4) Validación de Vacante
// ================================
export const JobSchema = z.object({
  title: z.string().min(3, "Título muy corto"),
  description: z.string().min(10, "Descripción muy corta"),
  location: z.string().min(2, "Ubicación requerida"),
  skills: z.array(z.string()).min(1, "Agrega al menos una skill"),
  grossSalary: z.coerce.number().nonnegative().optional(),
  benefitsLaw: z.boolean().default(true),
});

// ================================
// 5) Actualización de Perfil (candidato)
// ================================
export const ProfileUpdateSchema = z.object({
  location: z.string().min(2, "Ubicación requerida"),
  phone: PhoneMxSchema.optional().or(z.literal("")),
  linkedin: z.string().url("URL inválida").optional().or(z.literal("")),
  github: z.string().url("URL inválida").optional().or(z.literal("")),
  skills: z.array(z.string()).min(1, "Agrega al menos una skill"),
});

// ================================
// 6) Login
// ================================
export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(3, "Contraseña muy corta"),
});
export type SignInInput = z.infer<typeof SignInSchema>;
