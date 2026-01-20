// lib/shared/validation/password-reset.ts
import { z } from "zod";

/**
 * Schema para solicitar restablecimiento de contraseña
 */
export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .min(5, "Ingresa un correo válido")
    .email("Correo inválido")
    .max(190),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * Schema para restablecer contraseña
 * Usa el mismo regex de password fuerte que signup
 */
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]{8,}$/;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .regex(strongPasswordRegex, "Mín. 8, 1 mayús, 1 min, 1 número"),
    confirmPassword: z.string().min(8, "Confirma tu contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Schema para verificar token de reset
 */
export const verifyResetTokenSchema = z.object({
  token: z.string().min(1, "Token requerido"),
});

export type VerifyResetTokenInput = z.infer<typeof verifyResetTokenSchema>;