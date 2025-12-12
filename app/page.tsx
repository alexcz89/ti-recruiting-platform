// app/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import JobSearchBar from "@/components/JobSearchBar";
import PricingSection from "@/components/marketing/PricingSection";
import { Users, Briefcase, Handshake } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      "bg-emerald-500/10 ring-emerald-400/40 text-emerald-600 dark:text-emerald-300",
    violet:
      "bg-violet-500/10 ring-violet-400/40 text-violet-600 dark:text-violet-300",
    sky: "bg-sky-500/10 ring-sky-400/40 text-sky-600 dark:text-sky-300",
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full ring-2 shadow-sm transition-transform duration-200 hover:scale-[1.03] ${tones[tone]}`}
      >
        {children}
      </div>
      <span className="mt-2 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default async function Home() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as
    | "ADMIN"
    | "RECRUITER"
    | "CANDIDATE"
    | undefined;

  // Reclutador / Admin -> dashboard
  if (role === "RECRUITER" || role === "ADMIN") {
    redirect("/dashboard/overview");
  }

  // Candidato logeado -> resumen de perfil
  if (role === "CANDIDATE") {
    redirect("/profile/summary");
  }

  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        {/* Glow suave atrás, funciona en light/dark */}
        <div className="pointer-events-none absolute inset-x-0 top-[-160px] flex justify-center opacity-70 dark:opacity-90">
          <div className="h-64 w-[480px] rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-500/25" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-10 lg:pt-20">
          <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:gap-14">
            {/* Copy */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs sm:text-sm text-muted-foreground backdrop-blur">
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                  Nuevo
                </span>
                <span className="hidden sm:inline">
                  Postula con un clic, gestiona en el Pipeline y crea tu CV
                  profesional
                </span>
                <span className="sm:hidden">Crea tu CV y postula fácil</span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Plataforma de Reclutamiento TI
              </h1>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground">
                Conecta talento con empresas. Publica vacantes, busca
                candidatos y lleva tus procesos en un Pipeline visual y
                simple.
              </p>

              {/* CTAs rápidos */}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/cv/builder" className="btn btn-primary">
                  ✨ Crea tu CV
                </Link>
                <Link href="/jobs" className="btn btn-ghost">
                  Ver vacantes
                </Link>
                <Link href="/auth/signup/candidate" className="btn btn-ghost">
                  Crear cuenta (Candidato)
                </Link>
                <Link href="/auth/signup/recruiter" className="btn btn-ghost">
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
              <IconBadge label="Match" tone="sky" className="hidden sm:flex">
                <Handshake className="h-8 w-8" />
              </IconBadge>
            </div>
          </div>

          {/* Buscador envuelto en Suspense */}
          <div className="mt-8">
            <Suspense
              fallback={
                <div className="h-16 w-full animate-pulse rounded-xl border border-border bg-card/70" />
              }
            >
              <JobSearchBar />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Bloque promocional Resume Builder */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-8">
        <div className="rounded-xl border border-emerald-400/30 bg-card/70 p-4 backdrop-blur md:p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Creador de CV profesional
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Completa tu perfil en minutos y genera un CV con diseño limpio,
                optimizado para reclutadores y listo para descargar en PDF.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* solo queda este botón */}
              <Link href="/cv/builder" className="btn btn-primary">
                Comenzar ahora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dos caminos */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Reclutadores */}
          <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 ring-2 ring-violet-400/30">
                <Briefcase className="h-5 w-5 text-violet-600 dark:text-violet-300" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Soy reclutador
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Publica vacantes, gestiona postulaciones y avanza candidatos en
              tu Pipeline con un flujo visual tipo Kanban.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/auth/signin?role=RECRUITER"
                className="btn btn-ghost"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/auth/signup/recruiter"
                className="btn btn-primary"
              >
                Crear cuenta
              </Link>
            </div>
          </div>

          {/* Candidatos */}
          <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/30">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Soy talento
              </h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea tu perfil, sube o genera tu CV con nuestro constructor y
              postúlate a vacantes en segundos, sin formularios eternos.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/cv/builder" className="btn btn-primary">
                ✨ Crea tu CV
              </Link>
              <Link
                href="/auth/signin?role=CANDIDATE"
                className="btn btn-ghost"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/auth/signup/candidate"
                className="btn btn-ghost"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur md:p-6">
            <div className="text-2xl">⚡</div>
            <h3 className="mt-2 font-semibold text-foreground">
              Postulación rápida
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Aplica con un clic y mantén tu información centralizada para
              futuras vacantes.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur md:p-6">
            <div className="text-2xl">🎯</div>
            <h3 className="mt-2 font-semibold text-foreground">
              Búsqueda precisa
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Filtra por título, tecnología, seniority y ubicación para
              encontrar el mejor match.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur md:p-6">
            <div className="text-2xl">📊</div>
            <h3 className="mt-2 font-semibold text-foreground">
              Kanban de procesos
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Visualiza cada etapa del proceso y avanza candidatos sin
              fricción, con estatus claros.
            </p>
          </div>
        </div>
      </section>

      {/* Precios */}
      <PricingSection />

      {/* Footer */}
      <footer className="border-t border-border bg-background/95 py-8 text-center text-xs text-muted-foreground">
        © {year} Bolsa TI — Todos los derechos reservados.
      </footer>
    </main>
  );
}
