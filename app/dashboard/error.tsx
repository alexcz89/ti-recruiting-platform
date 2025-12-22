"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-white dark:bg-zinc-900 p-8 shadow-lg">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>

          {/* Title */}
          <h1 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Algo salió mal
          </h1>

          {/* Description */}
          <p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Ocurrió un error inesperado. Intenta recargar la página o volver al inicio.
          </p>

          {/* Error Details (dev mode only) */}
          {process.env.NODE_ENV === "development" && (
            <div className="mb-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-4">
              <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Error Details (dev only):
              </p>
              <p className="text-xs font-mono text-red-600 dark:text-red-400 break-words">
                {error.message}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <RefreshCcw className="h-4 w-4" />
              Intentar de nuevo
            </button>

            <a
              href="/dashboard/overview"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Home className="h-4 w-4" />
              Volver al inicio
            </a>
          </div>
        </div>

        {/* Support Link */}
        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
          Si el problema persiste, contacta a{" "}
          <a
            href="mailto:support@taskit.com"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            soporte técnico
          </a>
        </p>
      </div>
    </div>
  );
}
