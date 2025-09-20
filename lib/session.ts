import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function getSessionOrThrow() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

export async function getSessionCompanyId() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new Error("Unauthorized")
  // si tipaste next-auth, esto ya no necesita ts-ignore
  // @ts-ignore
  return session.user.companyId as string | null
}
