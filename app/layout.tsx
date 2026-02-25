// app/layout.tsx
import "./globals.css";
import "react-phone-input-2/lib/style.css";
import type { Metadata } from "next";

import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import { ThemeScript } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL), // ✅ CRÍTICO: normaliza todas las URLs de OG tags
  title: {
    default: "TaskIO — Bolsa de trabajo TI en México",
    template: "%s | TaskIO",
  },
  description: "Encuentra las mejores vacantes de tecnología en México. Conectamos talento TI con empresas líderes.",
  openGraph: {
    siteName: "TaskIO",
    locale: "es_MX",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.className} h-full`}>
      <head>
        <ThemeScript />
        <meta name="apple-mobile-web-app-title" content="TaskIO" />
      </head>

      <body className="min-h-screen antialiased bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <Providers>
          <Header />

          <main
            id="main-content"
            className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 pt-4 pb-10"
          >
            {children}
          </main>

          <footer className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8 text-sm text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/60 dark:border-zinc-800/60">
            © {new Date().getFullYear()} TaskIO. Todos los derechos reservados.
          </footer>
        </Providers>
      </body>
    </html>
  );
}