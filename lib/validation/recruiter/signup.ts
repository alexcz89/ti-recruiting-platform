// lib/validation/recruiter/signup.ts
import { z } from "zod";

// 🔁 Re-exportamos helpers de dominios desde un solo lugar común
export {
  FREE_DOMAINS,
  isFreeDomain,
  extractDomainFromUrl,
  domainMatches,
} from "@/lib/domains";

/** Password: 8+, 1 mayús, 1 min, 1 número. */
const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]{8,}$/;

/**
 * ============================================================
 * recruiterSignupSchema
 * ------------------------------------------------------------
 * Campos obligatorios y opcionales del alta de reclutador.
 * - Rechaza dominios gratuitos vía flujo de server action.
 * - Password fuerte con strongPasswordRegex.
 * ============================================================
 */
export const recruiterSignupSchema = z.object({
  companyName: z
    .string()
    .min(2, "Ingresa el nombre comercial")
    .max(80),
  website: z
    .string()
    .url()
    .optional()
    .or(z.literal("")), // opcional
  country: z.string().min(2).max(56),
  city: z.string().min(2).max(80),
  phone: z
    .string()
    .regex(/^\+\d{6,15}$/, "Formato E.164, ej. +52..."),
  firstName: z.string().min(2).max(60),
  lastName: z.string().min(2).max(60),
  email: z.string().email("Correo inválido"),
  password: z
    .string()
    .regex(
      strongPasswordRegex,
      "Mín. 8, 1 mayús, 1 min, 1 número"
    ),
  size: z
    .enum(["1-10", "11-50", "51-200", "201-1000", "1000+"])
    .optional(),
  industry: z.string().optional(),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  description: z.string().max(240).optional(),
  terms: z.literal(true, {
    errorMap: () => ({
      message: "Debes aceptar Términos y Privacidad",
    }),
  }),
  captchaToken: z
    .string()
    .min(1, "Captcha requerido"),
});

export type RecruiterSignupInput = z.infer<
  typeof recruiterSignupSchema
>;
