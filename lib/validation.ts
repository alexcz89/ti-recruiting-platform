// lib/validation.ts
import { z } from "zod";

export const EmailSchema = z.string().email("Email inválido");
export const PhoneMxSchema = z
  .string()
  .min(10, "Teléfono muy corto")
  .regex(/^\+?(\d[\s-]?){10,15}$/, "Teléfono inválido");

export const CandidateRegisterSchema = z.object({
  name: z.string().min(2, "Nombre muy corto"),
  lastName: z.string().min(2, "Apellido muy corto"),
  email: EmailSchema,
  password: z.string().min(6, "Mínimo 6 caracteres"),
  location: z.string().min(2, "Ubicación requerida"),
  birthdate: z.string().optional(),
  linkedin: z.string().url().optional().or(z.literal("")),
  github: z.string().url().optional().or(z.literal("")),
  phone: PhoneMxSchema.optional().or(z.literal("")),
  skills: z.array(z.string()).min(1, "Agrega al menos una habilidad"),
  cvUrl: z.string().url().optional(),
});

export const RecruiterRegisterSchema = z.object({
  companyName: z.string().min(2),
  name: z.string().min(2),
  email: EmailSchema,
  password: z.string().min(6),
  phone: PhoneMxSchema.optional().or(z.literal("")),
  country: z.string().min(2),
  city: z.string().min(2),
});

export const JobSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  location: z.string().min(2),
  skills: z.array(z.string()).min(1),
  // 🔧 usa coerce para convertir "12345" -> 12345 automáticamente
  grossSalary: z.coerce.number().nonnegative().optional(),
  benefitsLaw: z.boolean().default(true),
});

export const ProfileUpdateSchema = z.object({
  location: z.string().min(2),
  phone: PhoneMxSchema.optional().or(z.literal("")),
  linkedin: z.string().url().optional().or(z.literal("")),
  github: z.string().url().optional().or(z.literal("")),
  skills: z.array(z.string()).min(1),
});

// 🟢 <-- AGREGA ESTO
export const SignInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(3, "Contraseña muy corta"),
});
export type SignInInput = z.infer<typeof SignInSchema>;
