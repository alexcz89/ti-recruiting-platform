import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function getSessionOrThrow() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id ? String((session?.user as any).id) : null;
}

export async function getSessionUserIdOrThrow() {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function getSessionCompanyId() {
  const userId = await getSessionUserIdOrThrow();

  const recruiterProfile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    select: { companyId: true },
  });

  return recruiterProfile?.companyId ?? null;
}

export async function getSessionCompanyIdOrThrow() {
  const companyId = await getSessionCompanyId();
  if (!companyId) throw new Error("No company associated");
  return companyId;
}