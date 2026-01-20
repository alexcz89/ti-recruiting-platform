// app/auth/signin/SignInUnified.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Mail, Lock, Eye, EyeOff, Sparkles, Users, Briefcase } from "lucide-react";
import { SignInSchema } from "@/lib/validation";
import ForgotPasswordModal from "./ForgotPasswordModal";

type FormData = z.infer<typeof SignInSchema> & { remember?: boolean };
type Role = "CANDIDATE" | "RECRUITER";

const CV_DRAFT_KEY = "cv_builder_draft_v1";
const CV_DRAFT_SYNC_KEY = "cv_builder_synced_v1";

const DEMO_CREDENTIALS = {
  CANDIDATE: { email: "candidate@demo.local", password: "demo", label: "Candidato" },
  RECRUITER: { email: "recruiter@demo.local", password: "demo", label: "Reclutador" },
  ADMIN: { email: "admin@demo.local", password: "demo", label: "Admin" },
} as const;

export default function SignInUnified({
  initialRole = "CANDIDATE",
  isSignup,
  callbackUrl,
}: {
  initialRole?: Role;
  isSignup?: boolean;
  callbackUrl?: string;
}) {
  const [activeRole, setActiveRole] = useState<Role>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: DEMO_CREDENTIALS[activeRole].email,
      password: DEMO_CREDENTIALS[activeRole].password,
    },
  });

  const onSubmit = async (data: FormData) => {
    const res = await signIn("credentials", {
      redirect: false,
      email: data.email,
      password: data.password,
      role: activeRole,
      callbackUrl: callbackUrl || (activeRole === "RECRUITER" ? "/dashboard/overview" : "/jobs"),
      ...(rememberMe ? { remember: "true" } : {}),
    });

    if (res?.error) {
      setError("root", {
        type: "auth",
        message: "No se pudo iniciar sesión. Verifica tus datos.",
      });
      return;
    }

    // CV draft sync para candidatos
    if (activeRole === "CANDIDATE" && typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const fromCvBuilder = params.get("from") === "cv-builder";
        const alreadySynced = window.localStorage.getItem(CV_DRAFT_SYNC_KEY);
        const rawDraft = window.localStorage.getItem(CV_DRAFT_KEY);

        if (fromCvBuilder && rawDraft && !alreadySynced) {
          const draft = JSON.parse(rawDraft);
          const resp = await fetch("/api/cv/import-from-draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draft }),
          });

          if (resp.ok) window.localStorage.setItem(CV_DRAFT_SYNC_KEY, "1");
        }
      } catch (err) {
        console.error("Error al sincronizar CV", err);
      }
    }

    const redirectTo =
      res?.url || callbackUrl || (activeRole === "RECRUITER" ? "/dashboard/overview" : "/jobs");

    window.location.href = redirectTo;
  };

  const fillDemo = (role: keyof typeof DEMO_CREDENTIALS) => {
    setValue("email", DEMO_CREDENTIALS[role].email);
    setValue("password", DEMO_CREDENTIALS[role].password);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decoraciones de fondo */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-violet-400/10 to-blue-400/10 blur-3xl dark:from-violet-600/10 dark:to-blue-600/10" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-emerald-400/10 to-teal-400/10 blur-3xl dark:from-emerald-600/10 dark:to-teal-600/10" />

      {/* Grid pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Lado izquierdo */}
        <div className="hidden lg:flex lg:px-12 xl:px-20">
          <div className="flex min-h-screen w-full items-center py-12">
            <div className="w-full space-y-10">
              {/* Logo/Brand */}
              <div>
                <div className="mb-6 inline-flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-xl shadow-violet-500/30 transition-transform hover:scale-105">
                    <Sparkles className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                    TASK<span className="text-emerald-500">IT</span>
                  </span>
                </div>

                <h1 className="mt-8 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 bg-clip-text text-6xl font-black leading-[1.1] tracking-tight text-transparent dark:from-white dark:via-zinc-100 dark:to-white">
                  Conectamos
                  <br />
                  talento con
                  <br />
                  oportunidades
                </h1>

                <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
                  La plataforma de reclutamiento tecnológico más moderna de México.
                </p>
              </div>

              {/* Features */}
              <div className="space-y-5">
                <div className="group flex items-start gap-5 rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-white p-6 backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-violet-300 hover:shadow-lg dark:border-violet-900/30 dark:from-violet-950/20 dark:to-zinc-900/50 dark:hover:border-violet-800">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/30 transition-transform group-hover:scale-110">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                      Para Candidatos
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Encuentra tu próximo reto profesional en las mejores empresas tech
                    </p>
                  </div>
                </div>

                <div className="group flex items-start gap-5 rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-white p-6 backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-emerald-300 hover:shadow-lg dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-zinc-900/50 dark:hover:border-emerald-800">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30 transition-transform group-hover:scale-110">
                    <Briefcase className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                      Para Reclutadores
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Gestiona tus vacantes y candidatos de forma eficiente
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lado derecho */}
        <div className="flex items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-md">
            {/* Tabs role */}
            <div className="mb-8 inline-flex w-full overflow-hidden rounded-2xl border-2 border-zinc-200 bg-zinc-100/90 p-1.5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <button
                type="button"
                onClick={() => setActiveRole("CANDIDATE")}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  activeRole === "CANDIDATE"
                    ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/30 dark:from-violet-500 dark:to-blue-500"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  Candidato
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveRole("RECRUITER")}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  activeRole === "RECRUITER"
                    ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/30 dark:from-violet-500 dark:to-blue-500"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Reclutador
                </div>
              </button>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                {isSignup ? "Crear cuenta" : "Iniciar sesión"}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {activeRole === "RECRUITER"
                  ? "Gestiona tus vacantes y candidatos"
                  : "Encuentra vacantes y postúlate en minutos"}
              </p>
            </div>

            {/* OAuth Buttons (solo candidatos) */}
            <div className="mb-6 space-y-3">
              {activeRole === "CANDIDATE" && (
                <>
                  <div className="grid gap-3">
                    <button
                      type="button"
                      disabled
                      className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border-2 border-zinc-200 bg-white/90 text-sm font-bold text-zinc-900 transition-all hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/90"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Continuar con Google
                    </button>

                    <button
                      type="button"
                      disabled
                      className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border-2 border-zinc-200 bg-white/90 text-sm font-bold text-zinc-900 transition-all hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/90"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      Continuar con GitHub
                    </button>
                  </div>

                  <div className="relative mb-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white/90 px-4 font-semibold text-zinc-500 dark:bg-zinc-900/90 dark:text-zinc-400">
                        o con tu correo
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="tu@email.com"
                    className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white/90 pl-12 pr-4 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-violet-400"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white/90 pl-12 pr-12 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-violet-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="group flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-2 border-zinc-300 text-violet-600 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-600 dark:bg-zinc-900"
                  />
                  <span className="text-sm font-medium text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">
                    Recordarme
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="text-sm font-semibold text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {errors.root?.message && (
                <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                  {errors.root.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative h-12 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:from-violet-500 dark:to-blue-500"
              >
                <span className="relative z-10">
                  {isSubmitting ? "Iniciando sesión..." : isSignup ? "Crear cuenta" : "Iniciar sesión"}
                </span>
                <div className="absolute inset-0 -z-0 bg-gradient-to-r from-violet-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-8 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Credenciales de demo
              </p>

              {activeRole === "CANDIDATE" ? (
                <div className="space-y-2">
                  <DemoCredentialRow
                    label="Candidato"
                    email={DEMO_CREDENTIALS.CANDIDATE.email}
                    password={DEMO_CREDENTIALS.CANDIDATE.password}
                    onFill={() => fillDemo("CANDIDATE")}
                  />
                  <DemoCredentialRow
                    label="Admin"
                    email={DEMO_CREDENTIALS.ADMIN.email}
                    password={DEMO_CREDENTIALS.ADMIN.password}
                    onFill={() => fillDemo("ADMIN")}
                  />
                </div>
              ) : (
                <DemoCredentialRow
                  label="Reclutador"
                  email={DEMO_CREDENTIALS.RECRUITER.email}
                  password={DEMO_CREDENTIALS.RECRUITER.password}
                  onFill={() => fillDemo("RECRUITER")}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </div>
  );
}

function DemoCredentialRow({
  label,
  email,
  password,
  onFill,
}: {
  label: string;
  email: string;
  password: string;
  onFill: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/95 p-3 backdrop-blur-sm dark:bg-zinc-950/90">
      <div className="flex-1">
        <div className="mb-1 text-xs font-bold text-zinc-700 dark:text-zinc-300">{label}</div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <code className="font-mono">{email}</code>
          <span>·</span>
          <code className="font-mono">{password}</code>
        </div>
      </div>
      <button
        type="button"
        onClick={onFill}
        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-105 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
      >
        Auto-llenar
      </button>
    </div>
  );
}
