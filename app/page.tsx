// app/page.tsx
import Link from "next/link";
import JobSearchBar from "@/components/JobSearchBar";
import PricingSection from "@/components/marketing/PricingSection";
import {
  Users,
  Briefcase,
  Handshake,
} from "lucide-react";

/** Badge redondo para el hero */
function IconBadge({
  children,
  tone = "emerald",
  label,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "emerald" | "violet" | "sky";
  label: string;
  className?: string;
}) {
  const tones: Record<string, string> = {
    emerald:
      "bg-emerald-500/12 ring-emerald-400/30 text-emerald-600 dark:text-emerald-300",
    violet:
      "bg-violet-500/12 ring-violet-400/30 text-violet-600 dark:text-violet-300",
    sky: "bg-sky-500/12 ring-sky-400/30 text-sky-600 dark:text-sky-300",
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full ring-2 ${tones[tone]} shadow-sm transition-transform duration-200 hover:scale-[1.03]`}
        aria-hidden="true"
      >
        {children}
      </div>
      <span className="mt-2 text-xs text-muted">{label}</span>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 lg:pt-20">
          <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:gap-14">
            {/* Copy */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 badge">
                <span className="text-emerald-600 dark:text-emerald-300">Nuevo</span>
                <span className="text-muted">
                  Postula con un clic, gestiona en el Pipeline y crea tu CV profesional
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-default sm:text-5xl">
                Plataforma de Reclutamiento TI
              </h1>
              <p className="mt-3 text-sm sm:text-base text-muted">
                Conecta talento con empresas. Publica vacantes, busca candidatos y lleva tus procesos
                en un Pipeline.
              </p>

              {/* CTAs rápidos */}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/candidate/resume" className="btn btn-primary">
                  ✨ Crea tu CV
                </Link>
                <Link href="/jobs" className="btn-ghost">
                  Ver vacantes
                </Link>
                <Link href="/auth/signup/candidate" className="btn-ghost">
                  Crear cuenta (Candidato)
                </Link>
                <Link href="/auth/signup/recruiter" className="btn-ghost">
                  Crear cuenta (Reclutador)
                </Link>
              </div>
            </div>

            {/* Íconos hero */}
            <div className="flex w-full flex-1 justify-center gap-6 lg:justify-end">
              <IconBadge label="Talento TI" tone="emerald">
                <Users className="h-8 w-8" />
              </IconBadge>
              <IconBadge label="Reclutador" tone="violet">
                <Briefcase className="h-8 w-8" />
              </IconBadge>
              <IconBadge
                label="Match"
                tone="sky"
                className="hidden sm:flex"
              >
                <Handshake className="h-8 w-8" />
              </IconBadge>
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
        <div className="glass-card p-4 md:p-6 border-emerald-400/30">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-default">Creador de CV profesional</h2>
              <p className="mt-1 text-sm text-muted">
                Completa tu perfil en minutos, genera tu CV con diseño limpio y listo para descargar PDF.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/candidate/resume" className="btn btn-primary">
                Comenzar ahora
              </Link>
              <Link href="/resume/builder" className="btn-ghost">
                Ver detalles
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dos caminos */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Reclutadores */}
          <div className="glass-card p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 ring-2 ring-violet-400/30">
                <Briefcase className="h-5 w-5 text-violet-600 dark:text-violet-300" />
              </div>
              <h2 className="text-lg font-semibold text-default">Soy reclutador</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Publica vacantes, gestiona postulaciones en el Pipeline y contacta talento de forma directa.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/auth/signin?role=RECRUITER" className="btn-ghost">
                Iniciar sesión
              </Link>
              <Link href="/auth/signup/recruiter" className="btn btn-primary">
                Crear cuenta
              </Link>
            </div>
          </div>

          {/* Candidatos */}
          <div className="glass-card p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/30">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <h2 className="text-lg font-semibold text-default">Soy talento</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Crea tu perfil, sube tu CV con nuestro constructor y postúlate a vacantes en segundos.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/candidate/resume" className="btn btn-primary">
                ✨ Crea tu CV
              </Link>
              <Link href="/auth/signin?role=CANDIDATE" className="btn-ghost">
                Iniciar sesión
              </Link>
              <Link href="/auth/signup/candidate" className="btn-ghost">
                Crear cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="glass-card p-4 md:p-6">
            <div className="text-2xl">⚡</div>
            <h3 className="mt-2 font-semibold text-default">Postulación rápida</h3>
            <p className="mt-1 text-sm text-muted">
              Aplica con un clic y gestiona tu perfil con skills buscables.
            </p>
          </div>
          <div className="glass-card p-4 md:p-6">
            <div className="text-2xl">🎯</div>
            <h3 className="mt-2 font-semibold text-default">Búsqueda precisa</h3>
            <p className="mt-1 text-sm text-muted">
              Filtra por título, tecnología y ubicación. Encuentra el mejor match.
            </p>
          </div>
          <div className="glass-card p-4 md:p-6">
            <div className="text-2xl">📊</div>
            <h3 className="mt-2 font-semibold text-default">Kanban de procesos</h3>
            <p className="mt-1 text-sm text-muted">
              Visualiza el pipeline de cada vacante y avanza candidatos sin fricción.
            </p>
          </div>
        </div>
      </section>

      {/* ⭐ SECCIÓN DE PRECIOS INSERTADA AQUÍ ⭐ */}
      <PricingSection />

      {/* Footer mínimo */}
      <footer className="border-t border-[rgb(var(--border))] py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} Bolsa TI — Todos los derechos reservados.
      </footer>
    </main>
  );
}
