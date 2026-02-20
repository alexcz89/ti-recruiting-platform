// app/auth/verify/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Role = "RECRUITER" | "CANDIDATE" | "ADMIN";

function getFirst(q?: string | string[]) {
  return Array.isArray(q) ? q[0] : q;
}

function sanitizeCallbackUrl(cb?: string | null): string | undefined {
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

export default async function VerifyResultPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const role = (session.user as any).role as Role | undefined;
    const cb = sanitizeCallbackUrl(getFirst(searchParams?.callbackUrl));
    if (cb) redirect(cb);
    if (role === "RECRUITER" || role === "ADMIN") redirect("/dashboard/overview");
    if (role === "CANDIDATE") redirect("/jobs");
    redirect("/");
  }

  const status = (getFirst(searchParams?.status) || "").toLowerCase();
  const role = normalizeRole(getFirst(searchParams?.role));
  const callbackUrl = sanitizeCallbackUrl(getFirst(searchParams?.callbackUrl));

  const isOk = status === "ok";

  const signinHref =
    role === "RECRUITER"
      ? "/auth/signin?role=RECRUITER"
      : "/auth/signin?role=CANDIDATE";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-8 shadow-xl space-y-6">
          
          {/* Ícono */}
          <div className="flex justify-center">
            <div className="relative">
              <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${isOk ? "bg-emerald-500/20" : "bg-rose-500/20"}`} />
              <div className={`relative rounded-full p-5 ${
                isOk
                  ? "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20"
                  : "bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/20"
              }`}>
                {isOk
                  ? <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                  : <AlertTriangle className="h-12 w-12 text-rose-600 dark:text-rose-400" />
                }
              </div>
            </div>
          </div>

          {/* Título */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {isOk ? "¡Cuenta verificada!" : "No se pudo verificar tu cuenta"}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {isOk
                ? "Tu correo fue verificado correctamente. Ya puedes iniciar sesión."
                : "El enlace es inválido o ha expirado. Vuelve a solicitarlo registrándote de nuevo."}
            </p>
          </div>

          {/* Botones */}
          <div className="grid gap-3 pt-2">
            <Link
              href={signinHref}
              className="w-full flex items-center justify-center h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98]"
            >
              {isOk ? "Iniciar sesión" : "Volver a iniciar sesión"}
            </Link>

            <Link
              href={callbackUrl || "/"}
              className="w-full flex items-center justify-center h-12 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-all hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              {callbackUrl ? "Continuar" : "Volver al inicio"}
            </Link>
          </div>

          {!isOk && (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              Si el problema persiste, intenta registrarte nuevamente para recibir un nuevo enlace.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}