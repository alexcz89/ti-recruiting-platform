// app/dashboard/profile/actions.ts
"use server";

import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { revalidatePath } from "next/cache";

function emptyToUndefined(value?: string | null) {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Normaliza a dominio limpio: sin protocolo, sin paths, sin www. */
function normalizeToDomain(input?: string | null): string | undefined {
  if (!input) return undefined;

  let value = input.trim();
  if (!value) return undefined;

  try {
    const hasProtocol = /^https?:\/\//i.test(value);
    const url = new URL(hasProtocol ? value : `https://${value}`);
    value = url.hostname;
  } catch {
    // seguimos con lo escrito
  }

  value = value.replace(/^www\./i, "").toLowerCase();

  const domainLike = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
  if (!domainLike) return undefined;

  return value;
}

/** Normaliza URL completa; si no trae protocolo, agrega https:// */
function normalizeToUrl(input?: string | null): string | undefined {
  if (!input) return undefined;

  const value = input.trim();
  if (!value) return undefined;

  try {
    const hasProtocol = /^https?:\/\//i.test(value);
    const url = new URL(hasProtocol ? value : `https://${value}`);
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Normaliza y valida que realmente sea LinkedIn */
function normalizeLinkedinUrl(input?: string | null): string | undefined {
  const normalized = normalizeToUrl(input);
  if (!normalized) return undefined;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (hostname !== "linkedin.com" && hostname !== "mx.linkedin.com" && !hostname.endsWith(".linkedin.com")) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

const ProfileSchema = z.object({
  phone: z.string().trim().max(40).optional().transform(emptyToUndefined),
  directPhone: z.string().trim().max(40).optional().transform(emptyToUndefined),
  jobTitle: z.string().trim().max(100).optional().transform(emptyToUndefined),
  linkedinUrl: z.string().trim().max(200).optional().transform(emptyToUndefined),
  website: z.string().trim().max(200).optional().transform(emptyToUndefined),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

export async function saveRecruiterProfile(
  _prevState: unknown,
  formData: FormData
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    if (!userId) {
      return { ok: false, message: "No hay sesión" };
    }

    const parsed = ProfileSchema.parse({
      phone: formData.get("phone")?.toString(),
      directPhone: formData.get("directPhone")?.toString(),
      jobTitle: formData.get("jobTitle")?.toString(),
      linkedinUrl: formData.get("linkedinUrl")?.toString(),
      website: formData.get("website")?.toString(),
    });

    const normalizedDomain = normalizeToDomain(parsed.website);
    const normalizedLinkedin = normalizeLinkedinUrl(parsed.linkedinUrl);

    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!recruiterProfile) {
      return {
        ok: false,
        message: "No se encontró el perfil del reclutador.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.recruiterProfile.update({
        where: { userId },
        data: {
          phone: parsed.phone ?? null,
          directPhone: parsed.directPhone ?? null,
          jobTitle: parsed.jobTitle ?? null,
          linkedinUrl: normalizedLinkedin ?? null,
        },
      });

      await tx.company.update({
        where: { id: recruiterProfile.companyId },
        data: {
          website: normalizedDomain ?? null,
        },
      });
    });

    revalidatePath("/dashboard/profile");

    return {
      ok: true,
      message: "Perfil actualizado",
      id: recruiterProfile.id,
    };
  } catch (err: any) {
    const message =
      err?.message ||
      err?.errors?.[0]?.message ||
      "Error al guardar el perfil";

    return { ok: false, message };
  }
}