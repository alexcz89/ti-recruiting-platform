// app/layout.tsx
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import SignInButton from "@/components/SignInButton";


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
  {(isRecruiter || isAdmin) && <Link href="/dashboard">Panel</Link>}

  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-zinc-800 antialiased">
        <div className="max-w-6xl mx-auto p-6">
          <header className="flex items-center justify-between py-4">
            <h1 className="text-2xl font-bold">Bolsa TI</h1>
            <nav className="flex items-center gap-4">
              <Link href="/" className="hover:underline">Inicio</Link>
              <Link href="/jobs" className="hover:underline">Vacantes</Link>

              {!session && <SignInButton />}

              {isRecruiter && <Link href="/dashboard" className="hover:underline">Panel</Link>}
              {isCandidate && <Link href="/profile" className="hover:underline">Perfil</Link>}

              {session && (
                <>
                  <span className="text-sm text-zinc-600">{user?.email || "Sesión activa"}</span>
                  <SignOutButton />
                </>
              )}
            </nav>
          </header>

          <main>{children}</main>

          <footer className="py-10 text-sm text-zinc-500">
            © {new Date().getFullYear()} Bolsa TI
          </footer>
        </div>
      </body>
    </html>
  );
}
