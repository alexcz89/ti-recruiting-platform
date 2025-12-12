// lib/validation/recruiter/simple.ts 
import { z } from "zod";
import { FREE_DOMAINS } from "./signup";

// Reglas de contraseña: 8+, 1 mayús, 1 min, 1 número
const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]{8,}$/;

export const RecruiterSimpleSignupSchema = z
  .object({
    companyName: z.string().min(2, "Mínimo 2 caracteres").max(80),
    email: z
      .string()
      .email("Correo inválido")
      .refine((v) => {
        const domain = v.split("@")[1]?.toLowerCase() || "";
        // FREE_DOMAINS es un string[], usamos includes en vez de has
        return !FREE_DOMAINS.includes(domain);
      }, "Usa un correo corporativo (no aceptamos dominios gratuitos)"),
    firstName: z.string().min(2, "Mínimo 2").max(60),
    lastName: z.string().min(2, "Mínimo 2").max(60),
    password: z
      .string()
      .regex(strongPwd, "Mín. 8, 1 mayús, 1 min, 1 número"),
    confirmPassword: z.string().min(8, "Confirma tu contraseña"),
    size: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"], {
      required_error: "Selecciona el tamaño de la empresa",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RecruiterSimpleSignupInput = z.infer<
  typeof RecruiterSimpleSignupSchema
>;
