// app/page.tsx
import Link from "next/link"

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-8">Plataforma de Reclutamiento TI</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Reclutadores */}
        <section className="border rounded-2xl p-6 bg-white">
          <h2 className="text-xl font-semibold">Soy reclutador</h2>
          <p className="text-sm text-zinc-600 mt-2">
            Publica vacantes, gestiona postulaciones en Kanban y contacta talento.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/signin?role=RECRUITER"
              className="border rounded-xl px-4 py-2 hover:bg-gray-50"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/signin?role=RECRUITER&signup=1"
              className="border rounded-xl px-4 py-2 hover:bg-gray-50"
            >
              Crear cuenta
            </Link>
          </div>
        </section>

        {/* Talento / Candidatos */}
        <section className="border rounded-2xl p-6 bg-white">
          <h2 className="text-xl font-semibold">Soy talento</h2>
          <p className="text-sm text-zinc-600 mt-2">
            Crea tu perfil, sube tu CV y postúlate a vacantes.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/signin?role=CANDIDATE"
              className="border rounded-xl px-4 py-2 hover:bg-gray-50"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/signin?role=CANDIDATE&signup=1"
              className="border rounded-xl px-4 py-2 hover:bg-gray-50"
            >
              Crear cuenta
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
