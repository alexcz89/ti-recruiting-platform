// app/auth/signin/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import SignInUnified from "./SignInUnified";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { authOptions } from "@/lib/server/auth";
import { authenticatedSigninDestination } from "@/lib/auth/login";

type SearchParams = {
  role?: string;
  callbackUrl?: string;
  signup?: string;
};

type PageProps = {
  searchParams: SearchParams;
};

export const metadata = {
  title: "Iniciar sesión | Bolsa TI",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignInPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(authenticatedSigninDestination(session.user.role));
  }

  const roleParam = searchParams?.role?.toUpperCase();
  const callbackUrl = searchParams?.callbackUrl || "/";
  const isSignup = searchParams?.signup === "true";

  // Validar y normalizar el rol
  let roleFromQS: "RECRUITER" | "CANDIDATE" | undefined = undefined;
  
  if (roleParam === "RECRUITER" || roleParam === "CANDIDATE") {
    roleFromQS = roleParam;
  } else if (roleParam === "ADMIN") {
    // Los ADMIN usan el mismo flujo que RECRUITER
    roleFromQS = "RECRUITER";
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <FormSkeleton fields={3} />
          </div>
        </div>
      }
    >
      <SignInUnified
        initialRole={roleFromQS}
        isSignup={isSignup}
        callbackUrl={callbackUrl}
      />
    </Suspense>
  );
}
