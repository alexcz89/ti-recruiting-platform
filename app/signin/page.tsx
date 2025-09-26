// app/signin/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInForm from "./SignInForm";

type Role = "RECRUITER" | "CANDIDATE";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string; role?: Role; signup?: string };
}) {
  const session = await getServerSession(authOptions);

  // Si ya hay sesión, redirige según el rol
  if (session?.user) {
    const role = (session.user as any).role as Role | undefined;
    const cb = searchParams?.callbackUrl;
    if (cb) redirect(cb);
    if (role === "RECRUITER" || role === "ADMIN") redirect("/dashboard/overview");
    if (role === "CANDIDATE") redirect("/jobs");
    redirect("/");
  }

  // Normaliza params
  const roleFromQS: Role = searchParams?.role === "RECRUITER" ? "RECRUITER" : "CANDIDATE";
  const isSignup = Boolean(searchParams?.signup);
  const callbackUrl = searchParams?.callbackUrl;

  return (
    <SignInForm
      initialRole={roleFromQS}
      isSignup={isSignup}
      callbackUrl={callbackUrl}
      // 👇 importante: cuando sea RECRUITER, oculta métodos OAuth y deja solo email
      showEmailOnly={roleFromQS === "RECRUITER"}
    />
  );
}
