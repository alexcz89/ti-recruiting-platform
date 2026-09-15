import { z } from "zod";

const singleLine = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} debe tener máximo ${max} caracteres.`)
    .regex(/^[^\u0000-\u001f\u007f]*$/u, `${label} contiene caracteres no válidos.`);

export const DemoRequestSchema = z
  .object({
    name: singleLine("El nombre", 80).min(2, "Ingresa tu nombre."),
    company: singleLine("La empresa", 100).min(2, "Ingresa el nombre de tu empresa."),
    email: singleLine("El correo", 254)
      .email("Ingresa un correo de trabajo válido.")
      .transform((value) => value.toLowerCase()),
    role: singleLine("El cargo", 80).optional(),
    hiringNeeds: z
      .string()
      .trim()
      .min(3, "Cuéntanos qué perfiles necesitas contratar.")
      .max(300, "Las necesidades de contratación deben tener máximo 300 caracteres."),
    message: z
      .string()
      .trim()
      .max(1000, "El mensaje debe tener máximo 1000 caracteres.")
      .optional(),
    website: z.string().max(200).optional(),
  })
  .strict();

export type DemoRequestInput = z.input<typeof DemoRequestSchema>;
export type DemoRequest = z.output<typeof DemoRequestSchema>;
