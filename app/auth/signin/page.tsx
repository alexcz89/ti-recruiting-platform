// app/auth/signin/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInCandidateForm from "./SignInCandidateForm";
import SignInRecruiterForm from "./SignInRecruiterForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Role = "RECRUITER" | "CANDIDATE" | "ADMIN";

function getFirst(q: string | string[] | undefined): string | undefined {
  if (Array.isArray(q)) return q[0];
  return q;
}

/** Solo permitimos callbackUrls relativas para evitar open redirects */
function sanitizeCallbackUrl(cb?: string): string | undefined {
  if (!cb) return undefined;
  try {
    if (cb.startsWith("/")) return cb;
    return undefined;
  } catch {
    return undefined;
  }
}

function normalizeRole(raw?: string): Role {
  if (raw === "RECRUITER") return "RECRUITER";
  if (raw === "ADMIN") return "ADMIN";
  return "CANDIDATE";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);

  // Si ya hay sesión, redirige según rol o al callback permitido
  if (session?.user) {
    const role = (session.user as any).role as Role | undefined;
    const cbRaw = getFirst(searchParams?.callbackUrl);
    const cb = sanitizeCallbackUrl(cbRaw);
    if (cb) redirect(cb);

    if (role === "RECRUITER" || role === "ADMIN") redirect("/dashboard/overview");
    if (role === "CANDIDATE") redirect("/jobs");
    redirect("/");
  }

  // Normaliza params
  const roleFromQS = normalizeRole(getFirst(searchParams?.role));
  const isSignup = Boolean(getFirst(searchParams?.signup));
  const callbackUrl = sanitizeCallbackUrl(getFirst(searchParams?.callbackUrl));

  // Render: un formulario por rol
  if (roleFromQS === "RECRUITER" || roleFromQS === "ADMIN") {
    return (
      <SignInRecruiterForm
        callbackUrl={callbackUrl}
        // mostramos email + contraseña (no solo email)
        showEmailOnly={false}
      />
    );
  }

  // default -> candidato
  return (
    <SignInCandidateForm
      isSignup={isSignup}
      callbackUrl={callbackUrl}
    />
  );
}
