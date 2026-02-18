// app/auth/verify/check-email/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/ui/toast";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // ✅ Obtener email desde query params o desde sessionStorage como fallback
  const emailParam = searchParams?.get("email") || "";
  const role = searchParams?.get("role") || "CANDIDATE";
  
  const [email, setEmail] = useState(emailParam);
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutos en segundos
  const [isResending, setIsResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  // Si no hay email en URL, intentar recuperar de sessionStorage
  useEffect(() => {
    if (!email && typeof window !== "undefined") {
      const stored = sessionStorage.getItem("verification_email");
      if (stored) setEmail(stored);
    }
  }, [email]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleResend = async () => {
    if (!email) {
      toastError("No se pudo identificar el email. Por favor, intenta registrarte de nuevo.");
      return;
    }

    if (resendCount >= 3) {
      toastError("Has alcanzado el límite de reenvíos. Contacta a soporte si sigues teniendo problemas.");
      return;
    }

    setIsResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al reenviar");
      }

      toastSuccess("✅ Email reenviado. Revisa tu bandeja de entrada y spam.");
      setResendCount((prev) => prev + 1);
      setTimeLeft(60 * 60); // Resetear timer
    } catch (error: any) {
      console.error("Resend error:", error);
      toastError(error.message || "No se pudo reenviar el email. Intenta más tarde.");
    } finally {
      setIsResending(false);
    }
  };

  const emailProviders = [
    { name: "Gmail", url: "https://mail.google.com/mail/u/0/#inbox", color: "bg-red-500 hover:bg-red-600" },
    { name: "Outlook", url: "https://outlook.live.com/mail/0/inbox", color: "bg-blue-500 hover:bg-blue-600" },
    { name: "Yahoo", url: "https://mail.yahoo.com/d/folders/1", color: "bg-purple-500 hover:bg-purple-600" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800">
      <div className="w-full max-w-lg">
        {/* Card principal */}
        <div className="glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-8 space-y-6 shadow-xl">
          
          {/* Icono animado */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-full p-6">
                <Mail className="h-12 w-12 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              </div>
            </div>
          </div>

          {/* Título */}
          <div className="text-center space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Revisa tu correo
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Te enviamos un enlace de verificación a:
            </p>
            {email ? (
              <p className="text-base md:text-lg font-semibold text-emerald-600 dark:text-emerald-400 break-all px-4">
                {email}
              </p>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                (Email no especificado - verifica tu bandeja de entrada)
              </p>
            )}
          </div>

          {/* Checklist de pasos */}
          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  1. Abre tu bandeja de entrada
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Revisa también <strong>Spam</strong> o <strong>Promociones</strong>
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  2. Busca el email de TaskIT
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Asunto: <strong>&quot;Confirma tu cuenta&quot;</strong>
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  3. Haz clic en el botón del email
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Te redirigiremos automáticamente a tu cuenta
                </p>
              </div>
            </div>
          </div>

          {/* Timer de expiración */}
          {timeLeft > 0 ? (
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg py-2 px-3">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>
                El enlace expira en: <strong className="text-blue-700 dark:text-blue-300">{formatTime(timeLeft)}</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg py-2 px-3">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">El enlace ha expirado. Solicita uno nuevo abajo.</span>
            </div>
          )}

          {/* Accesos rápidos a proveedores */}
          <div className="space-y-3">
            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 font-medium">
              Abrir correo en:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {emailProviders.map((provider) => (
                <a
                  key={provider.name}
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${provider.color} text-white text-xs font-semibold px-3 py-2.5 rounded-lg transition-all transform hover:scale-105 active:scale-95 text-center shadow-sm`}
                >
                  {provider.name}
                </a>
              ))}
            </div>
          </div>

          {/* Botón reenviar */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
              ¿No llegó el correo? Espera 1-2 minutos y revisa <strong>Spam</strong>.
            </p>
            
            <button
              onClick={handleResend}
              disabled={isResending || resendCount >= 3 || !email}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-300 dark:border-emerald-600 bg-white dark:bg-zinc-800 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Reenviando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Reenviar email de verificación
                  {resendCount > 0 && ` (${resendCount}/3)`}
                </>
              )}
            </button>

            {resendCount >= 3 && (
              <div className="text-xs text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                <p className="font-medium mb-1">Límite de reenvíos alcanzado</p>
                <p>
                  Si sigues teniendo problemas,{" "}
                  <a 
                    href="mailto:soporte@taskit.com.mx" 
                    className="underline hover:text-red-700 dark:hover:text-red-300 font-semibold"
                  >
                    contacta a soporte
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Link volver */}
          <div className="text-center pt-2">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 transition-colors"
            >
              ← Volver al inicio
            </button>
          </div>
        </div>

        {/* Info adicional */}
        <div className="mt-6 text-center space-y-2 px-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            ¿Problemas para verificar tu cuenta?
          </p>
          <a
            href="mailto:soporte@taskit.com.mx"
            className="inline-block text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold underline underline-offset-2"
          >
            📧 Contactar a soporte técnico
          </a>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    }>
      <CheckEmailContent />
    </Suspense>
  );
}