// lib/validation/recruiter/onboarding.ts
import { z } from "zod";

export const SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const OnboardingCompanyStep1Schema = z.object({
  companyName: z.string().min(2, "Mínimo 2 caracteres").max(80),
  size: z.enum(SIZE_OPTIONS, { message: "Selecciona un tamaño" }),
});

export type OnboardingCompanyStep1Input = z.infer<typeof OnboardingCompanyStep1Schema>;

export const OnboardingCompanyStep2Schema = z.object({
  country: z.string().min(2, "País requerido").max(56),
  city: z.string().min(2, "Ciudad requerida").max(80),
  website: z
    .string()
    .url("URL inválida (ej. https://miempresa.com)")
    .optional()
    .or(z.literal("")),
  // Estos dos campos hoy son solo informativos en el front;
  // el backend actualmente no los guarda en Company.
  industry: z.string().optional(),
  description: z.string().max(240, "Máximo 240 caracteres").optional(),
  // opcional si luego agregas upload (aquí guardamos solo URL)
  logoUrl: z.string().url().optional(),
});

export type OnboardingCompanyStep2Input = z.infer<typeof OnboardingCompanyStep2Schema>;

/** Schema combinado por si quieres validar todo junto en algún momento */
export const OnboardingCompanyFullSchema = OnboardingCompanyStep1Schema.merge(
  OnboardingCompanyStep2Schema
);

export type OnboardingCompanyFullInput = z.infer<typeof OnboardingCompanyFullSchema>;
