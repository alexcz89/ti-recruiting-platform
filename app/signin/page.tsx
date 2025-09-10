// app/signin/page.tsx (Server Component)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInForm from "./SignInForm";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const role = (session.user as any).role;
    if (role === "RECRUITER" || role === "ADMIN") {
      redirect("/dashboard");
    }
    if (role === "CANDIDATE") {
      redirect("/profile");
    }
    // fallback genérico
    redirect("/");
  }

  // Si no hay sesión → renderiza el formulario
  return <SignInForm />;
}
