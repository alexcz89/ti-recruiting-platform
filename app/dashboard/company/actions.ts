// app/dashboard/company/actions.ts
"use server";

import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CompanySize } from "@prisma/client";

/** ✅ Guardar nombre/tamaño con toasts (sin redirect) */
export async function saveCompanyBasic(input: {
  name: string;
  size?: string | null;
}) {
  try {
    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId) return { ok: false, message: "Sin empresa asociada" };

    const Schema = z.object({
      name: z.string().trim().min(2, "Nombre requerido").max(120),
      size: z.nativeEnum(CompanySize).nullable().optional(),
    });

    const data = Schema.parse({
      name: input.name,
      size: input.size ?? null,
    });

    await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name,
        size: data.size ?? null,
      },
    });

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/profile");

    return { ok: true, message: "Datos de empresa guardados" };
  } catch (err: any) {
    const msg =
      err?.message || err?.errors?.[0]?.message || "Error al guardar";
    return { ok: false, message: msg };
  }
}

/** ✅ Sólo tamaño (con redirect clásico) */
export async function saveCompanySize(formData: FormData) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) redirect("/dashboard/overview");

  const Schema = z.object({
    size: z.nativeEnum(CompanySize).optional().nullable(),
  });

  const parsed = Schema.safeParse({
    size: formData.get("size")?.toString(),
  });

  if (!parsed.success) redirect("/dashboard/company?saved=0");

  await prisma.company.update({
    where: { id: companyId },
    data: {
      size: parsed.data.size ?? null,
    },
  });

  revalidatePath("/dashboard/overview");
  revalidatePath("/dashboard/company");

  redirect("/dashboard/company?saved=1");
}

/** ✅ Validación simple para URL */
const UrlLike = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .refine(
    (v) =>
      /^https?:\/\/.+/i.test(v) ||
      /^[a-z0-9-]+(\.[a-z0-9-]+)+([:/].*)?$/i.test(v),
    "URL de logo no válida"
  );

/** ✅ Establecer logo de empresa */
export async function setCompanyLogo(url: string | null) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) return { ok: false, message: "Sin empresa asociada" };

  if (url !== null) {
    const _ = UrlLike.safeParse(url);
    if (!_.success) return { ok: false, message: "URL de logo no válida" };
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { logoUrl: url },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/overview");

  return { ok: true };
}

/** ✅ Alias */
export async function updateCompanyLogo(input: { logoUrl: string }) {
  return setCompanyLogo(input.logoUrl ?? null);
}

/** ✅ Eliminar logo */
export async function removeCompanyLogo() {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) return { ok: false, message: "Sin empresa asociada" };

  await prisma.company.update({
    where: { id: companyId },
    data: { logoUrl: null },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/overview");

  return { ok: true };
}

/** 🔥 Alias principal */
export async function saveCompany(input: {
  name: string;
  size?: string | null;
}) {
  return saveCompanyBasic(input);
}