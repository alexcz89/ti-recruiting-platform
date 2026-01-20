// app/dashboard/profile/actions.ts
"use server";

import { z } from "zod";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';

/** Normaliza lo que el usuario escriba a un dominio limpio (sin http/https, sin paths, sin www.) */
function normalizeToDomain(input?: string | null): string | undefined {
  if (!input) return undefined;
  let v = input.trim();

  // Si viene vacío tras trim -> undefined
  if (!v) return undefined;

  // Si trae protocolo, intenta parsearlo como URL
  try {
    // Asegura tener protocolo para que URL no truene en casos como "mi-dominio.com/path"
    const hasProtocol = /^https?:\/\//i.test(v);
    const url = new URL(hasProtocol ? v : `https://${v}`);
    v = url.hostname;
  } catch {
    // Si no es URL válida, seguimos con lo escrito (p. ej., "task.com.mx")
  }

  // Quita "www." inicial
  v = v.replace(/^www\./i, "");

  // A minúsculas
  v = v.toLowerCase();

  // Valida que parezca dominio simple (sin espacios, con TLD)
  const domainLike = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v);
  if (!domainLike) return undefined;

  return v;
}

// Teléfono flexible y website normalizado a dominio
const ProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

export async function saveRecruiterProfile(prevState: any, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) {
      return { ok: false, message: "No hay sesión" };
    }

    const parsed = ProfileSchema.parse({
      phone: formData.get("phone")?.toString(),
      website: formData.get("website")?.toString(),
    });

    const normalizedDomain = normalizeToDomain(parsed.website);

    // Asegura que el perfil exista y actualízalo
    const profile = await prisma.recruiterProfile.upsert({
      where: { userId },
      create: {
        userId,
        company: (session?.user as any)?.companyName || "Mi empresa",
        phone: parsed.phone || null,
        website: normalizedDomain || null, // <-- guardamos sólo dominio limpio
        // status queda por default (PENDING) si es nuevo
      },
      update: {
        phone: parsed.phone || null,
        website: normalizedDomain || null, // <-- actualizado con dominio limpio
      },
      select: { id: true },
    });

    return { ok: true, message: "Perfil actualizado", id: profile.id };
  } catch (err: any) {
    const message =
      err?.message ||
      err?.errors?.[0]?.message ||
      "Error al guardar el perfil";
    return { ok: false, message };
  }
}
