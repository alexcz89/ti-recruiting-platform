// app/auth/reset-password/ResetPasswordForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, Sparkles, Loader2 } from "lucide-react";
// CAMBIO: Importar directamente desde el archivo
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/password-reset";
import { verifyResetToken, resetPassword } from "../signin/password-reset-actions";

type PageStatus = "loading" | "valid" | "invalid" | "success" | "error";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");

  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Verificar el token al cargar
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setPageStatus("invalid");
        setErrorMessage("No se proporcionó un token válido.");
        return;
      }

      const result = await verifyResetToken(token);
      
      if (result.valid) {
        setPageStatus("valid");
        setErrorMessage(""); // Limpiar cualquier error previo
      } else {
        setPageStatus("invalid");
        setErrorMessage(result.message || "El enlace es inválido o ha expirado.");
      }
    };

    verifyToken();
  }, [token]);

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      setErrorMessage("Token no válido.");
      return;
    }

    try {
      const result = await resetPassword(token, data.password);

      if (result.success) {
        setPageStatus("success");
        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          router.push("/auth/signin");
        }, 3000);
      } else {
        // Mantener en valid pero mostrar error
        setErrorMessage(result.message || "No se pudo restablecer la contraseña.");
      }
    } catch (error) {
      // Mantener en valid pero mostrar error
      setErrorMessage("Ocurrió un error inesperado. Intenta nuevamente.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decoraciones de fondo */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-violet-400/10 to-blue-400/10 blur-3xl dark:from-violet-600/10 dark:to-blue-600/10" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-emerald-400/10 to-teal-400/10 blur-3xl dark:from-emerald-600/10 dark:to-teal-600/10" />
      
      {/* Grid pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-xl shadow-violet-500/30">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <span className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                TASK<span className="text-emerald-500">IT</span>
              </span>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-3xl border-2 border-zinc-200 bg-white/95 p-8 shadow-2xl backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
            {/* Loading State */}
            {pageStatus === "loading" && (
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-violet-600 dark:text-violet-400" />
                <h2 className="mb-2 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                  Verificando enlace...
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Por favor espera un momento
                </p>
              </div>
            )}

            {/* Invalid Token State */}
            {pageStatus === "invalid" && (
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="mb-3 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                  Enlace inválido
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {errorMessage}
                </p>
                <button
                  onClick={() => router.push("/auth/signin")}
                  className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/40 dark:from-violet-500 dark:to-blue-500"
                >
                  Volver al inicio
                </button>
              </div>
            )}

            {/* Success State */}
            {pageStatus === "success" && (
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="mb-3 text-2xl font-black text-zinc-900 dark:text-zinc-50">
                  ¡Contraseña actualizada!
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Tu contraseña ha sido restablecida exitosamente. Serás redirigido al inicio de sesión...
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirigiendo...
                </div>
              </div>
            )}

            {/* Form State */}
            {pageStatus === "valid" && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                    Nueva contraseña
                  </h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Ingresa tu nueva contraseña para acceder a tu cuenta
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Password */}
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Nueva contraseña
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
                        onClick={() => setShowPassword(!showPassword)}
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

                  {/* Confirm Password */}
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <input
                        {...register("confirmPassword")}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white/90 pl-12 pr-12 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-violet-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {/* Error Message */}
                  {errorMessage && (
                    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                      {errorMessage}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative h-12 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:from-violet-500 dark:to-blue-500"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Restableciendo...
                      </span>
                    ) : (
                      <span className="relative z-10">Restablecer contraseña</span>
                    )}
                    <div className="absolute inset-0 -z-0 bg-gradient-to-r from-violet-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Back to login link */}
          {(pageStatus === "valid" || pageStatus === "error") && (
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push("/auth/signin")}
                className="text-sm font-semibold text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}