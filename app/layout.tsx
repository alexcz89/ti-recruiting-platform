// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import { ThemeScript } from "@/components/ThemeProvider"; // ⬅️ Script anti-flash de tema

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Bolsa TI | Starter",
  description: "Bolsa de trabajo TI minimal Next.js + PostgreSQL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.className} h-full`}
    >
      <head>
        <ThemeScript />
      </head>

      <body
        className="
          min-h-screen antialiased 
          bg-gradient-to-b from-white via-zinc-50 to-zinc-100 text-zinc-800
          dark:bg-gradient-to-b dark:from-[#041B1F] dark:via-[#06262C] dark:to-[#082B33] dark:text-zinc-100
        "
      >
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
        </Providers>
      </body>
    </html>
  );
}
