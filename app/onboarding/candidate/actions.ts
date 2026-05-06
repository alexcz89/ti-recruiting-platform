"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  OnboardingCandidateStep2Schema,
  OnboardingCandidateStep3Schema,
  type OnboardingCandidateStep2Input,
  type OnboardingCandidateStep3Input,
} from "@/lib/shared/validation/candidate/onboarding";

async function requireCandidate() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) throw new Error("No autenticado");
  if (user.role !== "CANDIDATE") throw new Error("No autorizado");
  return { userId: user.id as string };
}

function toSlug(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function findOrCreateTerm(kind: "SKILL" | "CERTIFICATION", label: string) {
  const slug = toSlug(label);
  const existing = await prisma.taxonomyTerm.findUnique({
    where: { kind_slug: { kind, slug } },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.taxonomyTerm.create({
    data: { kind, slug, label },
    select: { id: true },
  });
}

export async function saveCandidateStep1() {
  const { userId } = await requireCandidate();
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingStep: 1 },
  });
  return { ok: true };
}

export async function saveCandidateStep2(input: OnboardingCandidateStep2Input) {
  const { userId } = await requireCandidate();
  const { skills } = OnboardingCandidateStep2Schema.parse(input);

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingStep: 2 },
  });

  if (skills.length > 0) {
    await prisma.candidateSkill.deleteMany({ where: { userId } });

    for (const label of skills) {
      const term = await findOrCreateTerm("SKILL", label);
      await prisma.candidateSkill.upsert({
        where: { userId_termId: { userId, termId: term.id } },
        create: { userId, termId: term.id },
        update: {},
      });
    }
  }

  return { ok: true };
}

export async function saveCandidateStep3(input: OnboardingCandidateStep3Input) {
  const { userId } = await requireCandidate();
  const { phone, certs } = OnboardingCandidateStep3Schema.parse(input);

  await prisma.user.update({
    where: { id: userId },
    data: {
      phone: phone || null,
      onboardingStep: 3,
      profileCompleted: true,
      profileLastUpdated: new Date(),
    },
  });

  if (certs.length > 0) {
    await prisma.candidateCredential.deleteMany({ where: { userId } });

    for (const label of certs) {
      const term = await findOrCreateTerm("CERTIFICATION", label);

      // CandidateCredential no tiene @@unique — usar findFirst + create
      const exists = await prisma.candidateCredential.findFirst({
        where: { userId, termId: term.id },
        select: { id: true },
      });

      if (!exists) {
        await prisma.candidateCredential.create({
          data: { userId, termId: term.id },
        });
      }
    }
  }

  return { ok: true };
}