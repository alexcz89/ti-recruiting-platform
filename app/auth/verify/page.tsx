"use client";

// app/auth/verify/page.tsx
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";

type State = "loading" | "success" | "failed";

// ✅ Export default envuelto en Suspense (requerido por Next.js 14 con useSearchParams)
export default function VerifyResultPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <VerifyContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-10 shadow-xl text-center space-y-4 max-w-sm w-full">
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando…</span>
        </div>
      </div>
    </div>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const attempted = useRef(false);

  const status = searchParams.get("status") || "";
  const role = searchParams.get("role") || "CANDIDATE";
  const alt = searchParams.get("alt") || "";
  const callbackUrl = searchParams.get("callbackUrl") || "";

  const isOk = status === "ok";

  const dashboardUrl =
    role === "RECRUITER" || role === "ADMIN"
      ? "/dashboard/overview"
      : "/jobs";

  const signinHref =
    role === "RECRUITER"
      ? "/auth/signin?role=RECRUITER"
      : "/auth/signin?role=CANDIDATE";

  useEffect(() => {
    if (attempted.current) return;

    if (!isOk) {
      setState("failed");
      return;
    }

    if (!alt) {
      setState("success");
      return;
    }

    attempted.current = true;

    async function doAutoLogin() {
      try {
        const result = await signIn("auto-login-token", {
          token: alt,
          redirect: false,
        });

        if (result?.ok) {
          await new Promise((r) => setTimeout(r, 400));
          router.replace(callbackUrl || dashboardUrl);
        } else {
          setState("success");
        }
      } catch {
        setErrorMsg("No se pudo iniciar sesión automáticamente.");
        setState("success");
      }
    }

    doAutoLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargando / auto-login en curso ─────────────────────────
  if (state === "loading" && isOk) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-10 shadow-xl text-center space-y-4 max-w-sm w-full">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl animate-pulse bg-emerald-500/20" />
              <div className="relative rounded-full p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">¡Cuenta verificada!</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Iniciando sesión automáticamente…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Verificado (auto-login ok redirige, si falló muestra botón) ─
  if (isOk) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="w-full max-w-md">
          <div className="glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-8 shadow-xl space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-2xl animate-pulse bg-emerald-500/20" />
                <div className="relative rounded-full p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">¡Cuenta verificada!</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Tu correo fue verificado correctamente. Ya puedes iniciar sesión.
              </p>
              {errorMsg && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{errorMsg}</p>
              )}
            </div>
            <div className="grid gap-3 pt-2">
              <Link
                href={signinHref}
                className="w-full flex items-center justify-center h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98]"
              >
                Iniciar sesión
              </Link>
              <Link
                href={callbackUrl || "/"}
                className="w-full flex items-center justify-center h-12 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-all hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                {callbackUrl ? "Continuar" : "Volver al inicio"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Enlace inválido o expirado ─────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-8 shadow-xl space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl animate-pulse bg-rose-500/20" />
              <div className="relative rounded-full p-5 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/20">
                <AlertTriangle className="h-12 w-12 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              No se pudo verificar tu cuenta
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              El enlace es inválido o ha expirado. Vuelve a solicitarlo registrándote de nuevo.
            </p>
          </div>
          <div className="grid gap-3 pt-2">
            <Link
              href={signinHref}
              className="w-full flex items-center justify-center h-12 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Volver a iniciar sesión
            </Link>
            <Link
              href="/"
              className="w-full flex items-center justify-center h-12 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-all hover:border-zinc-300 hover:bg-zinc-50"
            >
              Volver al inicio
            </Link>
          </div>
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            Si el problema persiste, intenta registrarte nuevamente para recibir un nuevo enlace.
          </p>
        </div>
      </div>
    </div>
  );
}