// components/Providers.tsx

"use client";

import { PropsWithChildren } from "react";
import { SessionProvider } from "next-auth/react";
import AppThemeProvider from "@/components/ThemeProvider";
import { Toaster } from "sonner";

/**
 * Providers globales de la app:
 * - SessionProvider: maneja el contexto de sesión de NextAuth en cliente
 * - AppThemeProvider: controla el tema (light/dark) en toda la UI
 * - Toaster (sonner): sistema global de notificaciones/toasts
 * 
 * Aquí puedes añadir más providers en el futuro:
 * - React Query / TanStack Query
 * - I18nProvider (traducciones)
 * - Redux / Zustand / Jotai
 */
export default function Providers({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <AppThemeProvider>
        {children}
        <Toaster
          position="top-right"
          richColors
          expand
          closeButton
          duration={3000}
          toastOptions={{
            classNames: {
              toast: "rounded-xl border",
              title: "font-medium",
              description: "text-sm",
              actionButton: "rounded-lg",
              cancelButton: "rounded-lg",
            },
          }}
        />
      </AppThemeProvider>
    </SessionProvider>
  );
}
