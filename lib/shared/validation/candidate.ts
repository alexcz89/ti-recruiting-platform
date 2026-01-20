// lib/shared/validation/candidate.ts
import { z } from "zod";

const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]{8,}$/; // 8+, 1 mayús, 1 min, 1 número

export const candidateSignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nombre requerido (min. 2)")
    .max(120, "Máximo 120 caracteres"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Correo inválido")
    .max(190, "Máximo 190 caracteres"),
  password: z
    .string()
    .regex(pwdRegex, "Mín. 8, 1 mayús, 1 min, 1 número"),
});

export type CandidateSignupInput = z.infer<typeof candidateSignupSchema>;
