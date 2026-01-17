// app/layout.tsx
import "./globals.css";
import "react-phone-input-2/lib/style.css";

import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import { ThemeScript } from "@/components/ThemeProvider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Bolsa TI | Starter",
  description: "Bolsa de trabajo TI minimal Next.js + PostgreSQL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.className} h-full`}>
      <head>
        <ThemeScript />
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
            © {new Date().getFullYear()} Bolsa TI. Todos los derechos reservados.
          </footer>

          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}