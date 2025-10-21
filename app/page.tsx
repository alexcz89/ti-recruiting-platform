// app/page.tsx
import Link from "next/link"
import JobSearchBar from "@/components/JobSearchBar"
import AvatarBubble from "@/components/AvatarBubble"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#071A1F] via-[#08252C] to-[#0A2F38] text-white">
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 lg:pt-20">
          <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:gap-14">
            {/* Copy */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/15">
                <span className="text-emerald-300">Nuevo</span>
                <span className="text-white/70">
                  Postula con un clic, gestiona en Kanban y crea tu CV profesional
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Plataforma de Reclutamiento TI
              </h1>
              <p className="mt-3 text-white/80">
                Conecta talento con empresas. Publica vacantes, busca candidatos y lleva tus procesos
                en un tablero Kanban simple y potente.
              </p>

              {/* CTAs rápidos */}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/candidate/resume"
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#042229] hover:bg-emerald-300"
                >
                  ✨ Crea tu CV
                </Link>
                <Link
                  href="/jobs"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Ver vacantes
                </Link>
                <Link
                  href="/signin?role=CANDIDATE&signup=1"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Crear cuenta (Candidato)
                </Link>
                <Link
                  href="/signin?role=RECRUITER&signup=1"
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Crear cuenta (Reclutador)
                </Link>
              </div>
            </div>

            {/* Avatares hero */}
            <div className="flex w-full flex-1 justify-center gap-6 lg:justify-end">
              <AvatarBubble emoji="🧑‍💻" label="Talento TI" color="emerald" />
              <AvatarBubble emoji="🧑‍💼" label="Reclutador" color="violet" />
              <AvatarBubble emoji="🤝" label="Match" color="sky" className="hidden sm:block" />
            </div>
          </div>

          {/* Buscador */}
          <div className="mt-8">
            <JobSearchBar />
          </div>
        </div>
      </section>

      {/* Bloque promocional Resume Builder */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 backdrop-blur">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Creador de CV profesional</h2>
              <p className="mt-1 text-sm text-white/80">
                Completa tu perfil en minutos, genera tu CV con diseño limpio y listo para descargar PDF.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/candidate/resume"
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#042229] hover:bg-emerald-300"
              >
                Comenzar ahora
              </Link>
              <Link
                href="/resume/builder"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Ver detalles
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dos caminos: Soy reclutador / Soy talento */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Reclutadores */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-400/90 text-[#081F26]">
                👔
              </div>
              <h2 className="text-lg font-semibold">Soy reclutador</h2>
            </div>
            <p className="mt-2 text-sm text-white/80">
              Publica vacantes, gestiona postulaciones en Kanban y contacta talento de forma directa.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/signin?role=RECRUITER"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/signin?role=RECRUITER&signup=1"
                className="rounded-xl bg-violet-400 px-4 py-2 text-sm font-semibold text-[#082B33] hover:bg-violet-300"
              >
                Crear cuenta
              </Link>
            </div>
          </div>

          {/* Candidatos */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/90 text-[#081F26]">
                💼
              </div>
              <h2 className="text-lg font-semibold">Soy talento</h2>
            </div>
            <p className="mt-2 text-sm text-white/80">
              Crea tu perfil, sube tu CV con nuestro constructor y postúlate a vacantes en segundos.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/candidate/resume"
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#042229] hover:bg-emerald-300"
              >
                ✨ Crea tu CV
              </Link>
              <Link
                href="/signin?role=CANDIDATE"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/signin?role=CANDIDATE&signup=1"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights cortos */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl">⚡</div>
            <h3 className="mt-2 font-semibold">Postulación rápida</h3>
            <p className="mt-1 text-sm text-white/75">
              Aplica con un clic y gestiona tu perfil con skills buscables.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl">🎯</div>
            <h3 className="mt-2 font-semibold">Búsqueda precisa</h3>
            <p className="mt-1 text-sm text-white/75">
              Filtra por título, tecnología y ubicación. Encuentra el mejor match.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl">📊</div>
            <h3 className="mt-2 font-semibold">Kanban de procesos</h3>
            <p className="mt-1 text-sm text-white/75">
              Visualiza el pipeline de cada vacante y avanza candidatos sin fricción.
            </p>
          </div>
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Bolsa TI — Todos los derechos reservados.
      </footer>
    </main>
  )
}
