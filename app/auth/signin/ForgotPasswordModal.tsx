// app/auth/signin/ForgotPasswordModal.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Mail, CheckCircle2, Loader2 } from "lucide-react";
// CAMBIO: Importar directamente desde el archivo
import { requestPasswordResetSchema, type RequestPasswordResetInput } from "@/lib/shared/validation/password-reset";
import { requestPasswordReset } from "./password-reset-actions";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
  });

  const onSubmit = async (data: RequestPasswordResetInput) => {
    try {
      const result = await requestPasswordReset(data.email);
      
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(result.message || "Ocurrió un error. Intenta nuevamente.");
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("Ocurrió un error inesperado. Intenta nuevamente.");
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setErrorMessage("");
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-3xl border-2 border-zinc-200 bg-white/95 p-8 shadow-2xl backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "success" ? (
          // Success State
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="mb-3 text-2xl font-black text-zinc-900 dark:text-zinc-50">
              ¡Correo enviado!
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Te hemos enviado un correo con las instrucciones para restablecer tu contraseña. 
              Revisa tu bandeja de entrada y tu carpeta de spam.
            </p>
            <button
              onClick={handleClose}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/40 dark:from-violet-500 dark:to-blue-500"
            >
              Entendido
            </button>
          </div>
        ) : (
          // Form State
          <>
            <div className="mb-6">
              <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                ¿Olvidaste tu contraseña?
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Input */}
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

              {/* Error Message */}
              {status === "error" && (
                <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                  {errorMessage}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-12 flex-1 rounded-2xl border-2 border-zinc-200 bg-white/90 text-sm font-bold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative h-12 flex-1 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:from-violet-500 dark:to-blue-500"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    <span className="relative z-10">Enviar enlace</span>
                  )}
                  <div className="absolute inset-0 -z-0 bg-gradient-to-r from-violet-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}