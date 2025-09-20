// app/signin/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import SignInForm from "./SignInForm"

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string; role?: "RECRUITER" | "CANDIDATE"; signup?: string }
}) {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const role = (session.user as any).role
    if (role === "RECRUITER" || role === "ADMIN") redirect("/dashboard/overview")
    if (role === "CANDIDATE") redirect("/jobs")
    redirect("/")
  }

  return <SignInForm initialRole={searchParams?.role} isSignup={!!searchParams?.signup} />
}
