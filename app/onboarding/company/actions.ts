"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  OnboardingCompanyStep1Schema,
  OnboardingCompanyStep2Schema,
  type OnboardingCompanyStep1Input,
  type OnboardingCompanyStep2Input,
} from "@/lib/shared/validation/recruiter/onboarding";

/**
 * Asegura que el usuario sea recruiter/admin
 */
async function requireRecruiter() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) throw new Error("No autenticado");
  if (!["RECRUITER", "ADMIN"].includes(String(user.role))) {
    throw new Error("No autorizado");
  }

  const recruiterProfile = await prisma.recruiterProfile.findUnique({
    where: { userId: user.id as string },
    select: { companyId: true },
  });

  return {
    userId: user.id as string,
    companyId: recruiterProfile?.companyId ?? null,
  };
}

/**
 * STEP 1: Crear o actualizar empresa
 */
export async function saveCompanyStep1(input: OnboardingCompanyStep1Input) {
  const { userId, companyId } = await requireRecruiter();
  const data = OnboardingCompanyStep1Schema.parse(input);

  let company: { id: string; name: string };

  if (companyId) {
    company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.companyName,
        size: data.size as any,
      },
      select: { id: true, name: true },
    });
  } else {
    company = await prisma.company.create({
      data: {
        name: data.companyName,
        size: data.size as any,
      },
      select: { id: true, name: true },
    });
  }

  // 🔴 CRÍTICO: sincronizar recruiterProfile SIEMPRE con companyName
  await prisma.recruiterProfile.upsert({
    where: { userId },
    update: {
      companyId: company.id,
      companyName: company.name,
    },
    create: {
      userId,
      companyId: company.id,
      companyName: company.name,
      phone: null,
      status: "PENDING",
    },
  });

  return { ok: true, companyId: company.id };
}

/**
 * STEP 2: Completar datos de empresa
 */
export async function saveCompanyStep2(input: OnboardingCompanyStep2Input) {
  const { companyId } = await requireRecruiter();

  if (!companyId) {
    throw new Error("No hay compañía vinculada");
  }

  const data = OnboardingCompanyStep2Schema.parse(input);

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      country: data.country,
      city: data.city,
      website: data.website || undefined,
      logoUrl: data.logoUrl || undefined,
    },
    select: { id: true },
  });

  return { ok: true, companyId: company.id };
}