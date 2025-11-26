// app/dashboard/components/actions/company.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionCompanyId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ----------------------------------------------
 * VALIDACIONES ZOD
 * ---------------------------------------------- */
const sizeValues = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
const sizeSchema = z.enum(sizeValues);

const websiteSchema = z
  .string()
  .trim()
  .min(1, "Sitio requerido")
  .url("Formato inválido, ejemplo: https://miempresa.com")
  .transform((v) => (v.startsWith("http") ? v : `https://${v}`));

/* ----------------------------------------------
 * ACTUALIZA TAMAÑO DE EMPRESA (Company.size)
 * ---------------------------------------------- */
export async function updateCompanySize(formData: FormData) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) {
    throw new Error("No hay empresa asociada en la sesión");
  }

  const raw = String(formData.get("size") || "");
  const size = sizeSchema.parse(raw);

  await prisma.company.update({
    where: { id: companyId },
    data: { size },
  });

  revalidatePath("/dashboard/overview");
  return { ok: true };
}

/* ----------------------------------------------
 * ACTUALIZA SITIO WEB EN RecruiterProfile.website
 * ---------------------------------------------- */
export async function updateRecruiterWebsite(formData: FormData) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;
  if (!userId) throw new Error("No autenticado");

  const raw = String(formData.get("website") || "");
  const website = websiteSchema.parse(raw);

  await prisma.recruiterProfile.upsert({
    where: { userId },
    update: { website },
    create: { userId, company: "", website },
  });

  revalidatePath("/dashboard/overview");
  return { ok: true };
}
