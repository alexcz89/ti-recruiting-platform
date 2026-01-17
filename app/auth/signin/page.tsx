// app/auth/signin/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import SignInUnified from "./SignInUnified";
import type { Role } from "@prisma/client";

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

export default function SignInPage({ searchParams }: PageProps) {
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
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-zinc-500">Cargando...</p>
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