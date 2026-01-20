import 'server-only';

// lib/server/session.ts
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';

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
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  // si tipaste next-auth, esto ya no necesita ts-ignore
  // @ts-ignore
  return session.user.companyId as string | null;
}
