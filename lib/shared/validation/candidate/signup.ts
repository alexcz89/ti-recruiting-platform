// lib/shared/validation/candidate/signup.ts
import { z } from "zod";

/**
 * ============================================================
 * candidateSignupSchema
 * ------------------------------------------------------------
 * - Password fuerte: mín. 8, 1 mayúscula, 1 minúscula, 1 número
 * - Incluye campos opcionales y validaciones legales
 * ============================================================
 */
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]{8,}$/;

export const candidateSignupSchema = z.object({
  // Nombre completo (un solo campo)
  name: z.string().min(2, "Nombre requerido").max(120),

  email: z.string().email("Correo inválido").max(190),

  password: z
    .string()
    .regex(strongPasswordRegex, "Mín. 8, 1 mayús, 1 min, 1 número"),

  // Campos opcionales
  phone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),

  // Términos y captcha (desactivables)
  terms: z
    .literal(true, {
      errorMap: () => ({ message: "Debes aceptar Términos y Privacidad" }),
    })
    .optional(),

  captchaToken: z.string().min(1, "Captcha requerido").optional(),
});

export type CandidateSignupInput = z.infer<typeof candidateSignupSchema>;

/**
 * Variante reducida (compatibilidad con endpoint antiguo)
 * para /api/auth/signup/candidate
 */
export const candidateRegisterSchema = z.object({
  name: z.string().min(2, "Nombre requerido").max(120),
  email: z.string().email("Email inválido").max(190),
  password: z.string().min(8, "Mínimo 8 caracteres").max(100),
});

export type CandidateRegisterInput = z.infer<typeof candidateRegisterSchema>;

// Compatibilidad con nombres antiguos
export const CandidateSignupSchema = candidateSignupSchema;
export const CandidateRegisterSchema = candidateRegisterSchema;
