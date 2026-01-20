// app/dashboard/company/actions.ts
"use server";

import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** ✅ Guardar nombre/tamaño con toasts (sin redirect) */
export async function saveCompanyBasic(input: { name: string; size?: string | null }) {
  try {
    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId) return { ok: false, message: "Sin empresa asociada" };

    const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
    const Schema = z.object({
      name: z.string().trim().min(2, "Nombre requerido").max(120),
      size: z
        .enum(SIZES)
        .optional()
        .nullable()
        .transform((v) => (v ?? undefined)),
    });

    const data = Schema.parse(input);

    await prisma.company.update({
      where: { id: companyId },
      data: { name: data.name, size: data.size ?? null },
    });

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/profile");

    return { ok: true, message: "Datos de empresa guardados" };
  } catch (err: any) {
    const msg = err?.message || err?.errors?.[0]?.message || "Error al guardar";
    return { ok: false, message: msg };
  }
}

/** ✅ Sólo tamaño (con redirect clásico) */
export async function saveCompanySize(formData: FormData) {
  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) redirect("/dashboard/overview");

  const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
  const Schema = z
    .object({
      size: z
        .enum(SIZES, {
          errorMap: () => ({ message: "Selecciona un tamaño válido" }),
        })
        .optional()
        .transform((v) => (v ? v : undefined)),
    })
    .strict();

  const parsed = Schema.safeParse({
    size: formData.get("size")?.toString(),
  });
  if (!parsed.success) redirect("/dashboard/company?saved=0");

  await prisma.company.update({
    where: { id: companyId },
    data: { size: parsed.data.size ?? null },
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

/** ✅ Alias para compatibilidad con componentes existentes */
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

/** 🔥 Nuevo: Alias oficial para eliminar el warning */
export async function saveCompany(input: { name: string; size?: string | null }) {
  return saveCompanyBasic(input);
}
