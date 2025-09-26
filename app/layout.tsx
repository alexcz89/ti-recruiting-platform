// app/layout.tsx
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import Providers from "@/components/Providers"; // ✅ usamos Providers centralizados

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Bolsa TI | Starter",
  description: "Bolsa de trabajo TI minimal Next.js + PostgreSQL",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;

  const isRecruiter = user?.role === "RECRUITER";
  const isCandidate = user?.role === "CANDIDATE";
  const isAdmin = user?.role === "ADMIN";

  return (
    <html lang="es" className={`${inter.className} h-full`}>
      <body
        className="
          min-h-screen antialiased 
          bg-gradient-to-b from-white via-zinc-50 to-zinc-100 text-zinc-800
          dark:bg-gradient-to-b dark:from-[#041B1F] dark:via-[#06262C] dark:to-[#082B33] dark:text-zinc-100
        "
      >
        {/* ✅ Providers globales */}
        <Providers>
          <div className="mx-auto max-w-6xl px-6">
            {/* Header sticky con blur y soporte dark */}
            <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
              <div className="flex items-center justify-between py-4">
                {/* Logo */}
                <h1 className="text-2xl font-bold">
                  <Link href="/" className="hover:opacity-90">
                    Bolsa TI
                  </Link>
                </h1>

                {/* Nav principal */}
                <nav className="flex items-center gap-4 sm:gap-6">
                  <Link href="/" className="hover:underline">
                    Inicio
                  </Link>
                  <Link href="/jobs" className="hover:underline">
                    Vacantes
                  </Link>

                  {/* Estado sin sesión → Dropdown accesible */}
                  {!session ? (
                    <div className="relative group">
                      <button
                        className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                        aria-haspopup="menu"
                        aria-expanded="false"
                      >
                        Login / Signup
                      </button>

                      {/* Panel accesible con hover y focus */}
                      <div
                        className="
                          invisible absolute right-0 top-full z-50 w-56
                          translate-y-1 rounded-md border bg-white shadow-lg ring-1 ring-black/5 opacity-0
                          transition
                          group-hover:visible group-hover:translate-y-0 group-hover:opacity-100
                          focus-within:visible focus-within:translate-y-0 focus-within:opacity-100
                          dark:border-zinc-800 dark:bg-zinc-900
                        "
                        role="menu"
                      >
                        <div className="p-1">
                          <Link
                            href="/signin?role=CANDIDATE"
                            className="block rounded px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                            role="menuitem"
                          >
                            Login Candidato
                          </Link>
                          <Link
                            href="/signin?role=CANDIDATE&signup=1"
                            className="block rounded px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                            role="menuitem"
                          >
                            Signup Candidato
                          </Link>
                          <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                          <Link
                            href="/signin?role=RECRUITER"
                            className="block rounded px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                            role="menuitem"
                          >
                            Employers Login
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(isAdmin || isRecruiter) && (
                        <Link href="/dashboard" className="hover:underline">
                          Panel
                        </Link>
                      )}
                      {isCandidate && (
                        <Link href="/profile/summary" className="hover:underline">
                          Perfil
                        </Link>
                      )}
                      <span className="hidden sm:inline text-sm text-zinc-600 dark:text-zinc-400">
                        {user?.email || "Sesión activa"}
                      </span>
                      <SignOutButton />
                    </>
                  )}

                  {/* Toggle de tema */}
                  <ThemeToggle />
                </nav>
              </div>
            </header>

            <main>{children}</main>

            <footer className="py-10 text-sm text-zinc-500 dark:text-zinc-400">
              © {new Date().getFullYear()} Bolsa TI
            </footer>
          </div>
        </Providers>

        {/* ✅ Toaster global */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
