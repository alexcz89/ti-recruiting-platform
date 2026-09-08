import Link from "next/link";

export const metadata = { title: "Acceso de reclutadores | TaskIO" };

export default function RecruiterSignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="glass-card w-full max-w-lg rounded-2xl border p-6 text-center md:p-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Acceso para pilotos
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Las cuentas de reclutador se habilitan manualmente para las empresas
          participantes. Contacta al fundador para solicitar acceso.
        </p>
        <Link
          href="/auth/signin?role=RECRUITER"
          className="mt-6 inline-flex rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Iniciar sesión
        </Link>
      </section>
    </main>
  );
}
