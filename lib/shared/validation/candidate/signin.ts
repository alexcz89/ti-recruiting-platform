// lib/shared/validation/candidate/signin.ts
import { z } from "zod";

/**
 * ============================================================
 * candidateSigninSchema
 * ------------------------------------------------------------
 * - Permite cualquier dominio (sí acepta Gmail, Outlook, etc.)
 * - Password mínimo 4 caracteres (útil para entorno demo)
 * ============================================================
 */
export const candidateSigninSchema = z.object({
  email: z.string().min(5, "Ingresa un correo válido").email("Correo inválido"),
  password: z.string().min(4, "Contraseña requerida"),
});

export type CandidateSigninInput = z.infer<typeof candidateSigninSchema>;

// Compatibilidad con imports antiguos
export const CandidateSignInSchema = candidateSigninSchema;
export type CandidateSignInInput = CandidateSigninInput;
