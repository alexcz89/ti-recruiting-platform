// app/layout.tsx
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Bolsa TI | Starter",
  description: "Bolsa de trabajo TI minimal Next.js + PostgreSQL",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any | undefined;
  const isRecruiter = user?.role === "RECRUITER";
  const isCandidate = user?.role === "CANDIDATE";

  async function doSignOut() {
    "use server";
    await signOut();
	redirect("/");
  }

  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-zinc-800 antialiased">
        <div className="max-w-6xl mx-auto p-6">
          <header className="flex items-center justify-between py-4">
            <h1 className="text-2xl font-bold">Bolsa TI</h1>
            <nav className="flex items-center gap-4">
				<a href="/" className="hover:underline">Inicio</a>
				<a href="/jobs" className="hover:underline">Vacantes</a>

			  {!session && <a href="/signin" className="hover:underline">Ingresar</a>}

			  {isRecruiter && <a href="/dashboard" className="hover:underline">Panel</a>}
			  {isCandidate && <a href="/profile" className="hover:underline">Perfil</a>}

			  {session && (
				<>
				  <span className="text-sm text-zinc-600">{user?.email || "Sesión activa"}</span>
				  <form action={doSignOut}>
					<button className="border rounded px-3 py-1">Cerrar sesión</button>
				  </form>
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
