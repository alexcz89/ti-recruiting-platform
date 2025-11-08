// lib/validation/recruiter/signin.ts
import { z } from "zod";

/**
 * Dominios gratuitos no permitidos para login de reclutadores.
 * Mantén esta lista sincronizada con la de signup.
 */
export const FREE_MAIL_DOMAINS = [
  "gmail.com","hotmail.com","outlook.com","live.com","yahoo.com",
  "icloud.com","proton.me","aol.com","yandex.com","gmx.com",
  "msn.com","zoho.com","mail.com","outlook.es","hotmail.es","yahoo.com.mx",
] as const;

/** Valida que el email NO sea de dominio gratuito. */
export function isCorporateEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && !FREE_MAIL_DOMAINS.includes(domain as any);
}

/**
 * ============================================================
 * recruiterSigninSchema
 * ------------------------------------------------------------
 * - Exige correo corporativo (no dominios gratuitos)
 * - Password mínimo 4 (útil para entorno demo)
 * ============================================================
 */
export const recruiterSigninSchema = z.object({
  email: z
    .string()
    .min(5, "Ingresa un correo válido")
    .email("Correo inválido")
    .refine(isCorporateEmail, {
      message: "Usa un correo corporativo (no aceptamos dominios gratuitos)",
    }),
  password: z.string().min(4, "Contraseña requerida"),
});

export type RecruiterSigninInput = z.infer<typeof recruiterSigninSchema>;

/* Compatibilidad con imports antiguos */
export const recruiterSignInSchema = recruiterSigninSchema;
