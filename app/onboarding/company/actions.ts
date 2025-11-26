// app/onboarding/company/actions.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  OnboardingCompanyStep1Schema,
  OnboardingCompanyStep2Schema,
  type OnboardingCompanyStep1Input,
  type OnboardingCompanyStep2Input,
} from "@/lib/validation/recruiter/onboarding";

/** Asegura que el usuario logueado sea RECRUITER/ADMIN y devuelve su id+companyId */
async function requireRecruiter() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) throw new Error("No autenticado");
  if (!["RECRUITER", "ADMIN"].includes(String(user.role))) {
    throw new Error("No autorizado");
  }
  return {
    userId: user.id as string,
    companyId: user.companyId as string | null,
  };
}

/** Crea/actualiza Company con los campos mínimos y vincula al usuario si no lo está */
export async function saveCompanyStep1(input: OnboardingCompanyStep1Input) {
  const { userId, companyId } = await requireRecruiter();
  const data = OnboardingCompanyStep1Schema.parse(input);

  let company = null as { id: string } | null;

  if (companyId) {
    company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.companyName,
        size: data.size as any,
      },
      select: { id: true },
    });
  } else {
    company = await prisma.company.create({
      data: {
        name: data.companyName,
        size: data.size as any,
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { companyId: company.id },
    });
  }

  // Crear/actualizar RecruiterProfile
  await prisma.recruiterProfile
    .upsert({
      where: { userId },
      update: { company: data.companyName },
      create: {
        userId,
        company: data.companyName,
        status: "ACTIVE" as any,
      },
    })
    .catch(() => {});

  return { ok: true, companyId: company!.id };
}

/** Completa metadatos de Company (ubicación, sitio, logo) */
export async function saveCompanyStep2(input: OnboardingCompanyStep2Input) {
  const { userId, companyId } = await requireRecruiter();
  if (!companyId) throw new Error("No hay compañía vinculada");

  const data = OnboardingCompanyStep2Schema.parse(input);

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      country: data.country,
      city: data.city,
      // Estos campos existen en tu modelo Company:
      website: data.website || undefined,
      logoUrl: data.logoUrl || undefined,
    },
    select: { id: true },
  });

  // Reflejar website también en RecruiterProfile
  await prisma.recruiterProfile
    .update({
      where: { userId },
      data: {
        website: data.website || undefined,
      },
    })
    .catch(() => {});

  return { ok: true, companyId: company.id };
}
