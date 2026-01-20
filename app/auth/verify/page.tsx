// app/auth/verify/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Role = "RECRUITER" | "CANDIDATE" | "ADMIN";

function getFirst(q?: string | string[]) {
  return Array.isArray(q) ? q[0] : q;
}

/** Solo aceptamos rutas relativas para evitar open redirects */
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

  // Ya logueado → manda directo al destino más lógico
  if (session?.user) {
    const role = (session.user as any).role as Role | undefined;
    const cb = sanitizeCallbackUrl(getFirst(searchParams?.callbackUrl));
    if (cb) redirect(cb);

    if (role === "RECRUITER" || role === "ADMIN") redirect("/dashboard/overview");
    if (role === "CANDIDATE") redirect("/jobs");
    redirect("/");
  }

  const status = (getFirst(searchParams?.status) || "").toLowerCase(); // "ok" | "failed"
  const role = normalizeRole(getFirst(searchParams?.role));
  const callbackUrl = sanitizeCallbackUrl(getFirst(searchParams?.callbackUrl));

  const isOk = status === "ok";
  const title = isOk ? "Cuenta verificada" : "No se pudo verificar tu cuenta";
  const subtitle = isOk
    ? "Tu correo fue verificado correctamente. Ahora puedes iniciar sesión."
    : "El enlace es inválido o ha expirado. Vuelve a solicitarlo registrándote de nuevo.";

  // CTA principal según rol
  const signinHref =
    role === "RECRUITER"
      ? "/auth/signin?role=RECRUITER"
      : "/auth/signin?role=CANDIDATE";

  return (
    <div className="mx-auto max-w-lg py-16 px-6">
      <div className="rounded-2xl border glass-card p-4 md:p-6">
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            isOk
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
          }`}
        >
          {isOk ? "✅" : "⚠️"}
        </div>

        <h1 className="text-center text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href={signinHref}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {isOk ? "Iniciar sesión" : "Volver a iniciar/registrar"}
          </Link>

          <Link
            href={callbackUrl || "/"}
            className="rounded-xl border border-zinc-200 glass-card p-4 md:p-6"
          >
            {callbackUrl ? "Continuar" : "Volver al inicio"}
          </Link>
        </div>

        {!isOk && (
          <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Si el problema persiste, intenta registrarte nuevamente para recibir un nuevo enlace.
          </p>
        )}
      </div>
    </div>
  );
}
