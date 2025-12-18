// app/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import JobSearchBar from "@/components/JobSearchBar";
import PricingSection from "@/components/marketing/PricingSection";
import {
  Users,
  Briefcase,
  Handshake,
  Zap,
  Target,
  Kanban,
  FileText,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import RegisterModal from "@/components/RegisterModal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-foreground">
      {/* Hero mejorado */}
      <section className="relative overflow-hidden border-b border-border/60 bg-white dark:bg-zinc-950">
        {/* Glow sutil y simple */}
        <div className="pointer-events-none absolute inset-0 flex justify-center opacity-20 dark:opacity-30">
          <div className="h-[400px] w-[600px] rounded-full bg-emerald-500/30 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pt-8 pb-12 lg:pt-12 lg:pb-16">
          <div className="flex flex-col items-center text-center">
            {/* Badge superior - fade in */}
            <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 backdrop-blur-sm shadow-sm">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">
                CV profesional en minutos • Pipeline visual • Postulación instantánea
              </span>
              <span className="sm:hidden">CV + Pipeline + Jobs</span>
            </div>

            {/* Headline más impactante - fade in delayed */}
            <h1 className="animate-fade-in-up mt-6 max-w-4xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Tu próximo trabajo en{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                tecnología
              </span>{" "}
              empieza aquí
            </h1>

            <p className="animate-fade-in-up animation-delay-200 mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Conecta talento tech con empresas. Crea tu CV profesional en minutos,
              postula con un clic y gestiona todo tu proceso en un solo lugar.
            </p>

            {/* CTAs principales - fade in delayed */}
            <div className="animate-fade-in-up animation-delay-300 mt-7 flex flex-col gap-4 sm:flex-row sm:gap-4">
              <Link
                href="/cv/builder"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5"
              >
                <Sparkles className="h-5 w-5" />
                Crea tu CV gratis
              </Link>
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-border bg-background/50 px-8 py-4 text-base font-semibold text-foreground backdrop-blur-sm transition-all duration-200 hover:border-emerald-500/50 hover:bg-emerald-500/5"
              >
                Ver vacantes
                <ChevronDown className="h-5 w-5 rotate-[-90deg]" />
              </Link>
            </div>

            {/* Enlaces secundarios muy discretos */}
            <RegisterModal />
          </div>

          {/* Buscador - más prominente */}
          <div className="animate-fade-in-up animation-delay-600 mt-10">
            <Suspense
              fallback={
                <div className="h-20 w-full animate-pulse rounded-2xl border border-border bg-card/70 shadow-lg" />
              }
            >
              <JobSearchBar />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Bloque promocional Resume Builder - más visual */}
      <section className="relative mx-auto max-w-7xl px-6 py-20 bg-white dark:bg-zinc-950">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-8 shadow-xl md:p-12">
          <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md">
                <FileText className="h-3.5 w-3.5" />
                Destacado
              </div>
              <h2 className="mt-4 text-3xl font-bold text-foreground md:text-4xl">
                Crea tu CV profesional en minutos
              </h2>
              <p className="mt-3 text-base text-muted-foreground md:text-lg">
                Sin plantillas aburridas. Diseño limpio y moderno, optimizado para ATS y
                listo para impresionar. Descarga en PDF o comparte online.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link
                href="/cv/builder"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-500 hover:shadow-xl hover:-translate-y-0.5"
              >
                <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                Comenzar ahora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dos caminos - mejorado */}
      <section className="mx-auto max-w-7xl px-6 pb-20 bg-white dark:bg-zinc-950">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            ¿Qué estás buscando?
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Elige tu camino y comienza en segundos
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Reclutadores - diseño mejorado */}
          <div className="group relative overflow-hidden rounded-2xl border-2 border-border bg-white dark:bg-zinc-900 p-8 shadow-lg transition-all duration-300 hover:border-violet-500/50 hover:shadow-2xl hover:-translate-y-1 md:p-10">
            {/* Glow hover effect */}
            <div className="pointer-events-none absolute inset-0 bg-violet-500/0 opacity-0 transition-opacity duration-300 group-hover:bg-violet-500/5 group-hover:opacity-100" />
            
            <div className="relative">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 ring-2 ring-violet-400/30 transition-transform duration-300 group-hover:scale-110">
                  <Briefcase className="h-7 w-7 text-violet-600 dark:text-violet-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">
                    Para reclutadores
                  </h3>
                  <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">
                    Encuentra talento más rápido
                  </p>
                </div>
              </div>
              
              <ul className="mt-6 space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300">
                    ✓
                  </span>
                  <span>Publica vacantes con descripción detallada</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300">
                    ✓
                  </span>
                  <span>Pipeline visual tipo Kanban para gestionar procesos</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300">
                    ✓
                  </span>
                  <span>Acceso a base de datos de candidatos calificados</span>
                </li>
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/auth/signup/recruiter"
                  className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-violet-500 hover:shadow-lg"
                >
                  Crear cuenta gratis
                </Link>
                <Link
                  href="/auth/signin?role=RECRUITER"
                  className="inline-flex items-center justify-center rounded-lg border-2 border-border px-6 py-3 font-semibold text-foreground transition-all duration-200 hover:border-violet-500/50 hover:bg-violet-500/5"
                >
                  Iniciar sesión
                </Link>
              </div>
            </div>
          </div>

          {/* Candidatos - diseño mejorado */}
          <div className="group relative overflow-hidden rounded-2xl border-2 border-border bg-white dark:bg-zinc-900 p-8 shadow-lg transition-all duration-300 hover:border-emerald-500/50 hover:shadow-2xl hover:-translate-y-1 md:p-10">
            {/* Glow hover effect */}
            <div className="pointer-events-none absolute inset-0 bg-emerald-500/0 opacity-0 transition-opacity duration-300 group-hover:bg-emerald-500/5 group-hover:opacity-100" />
            
            <div className="relative">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-2 ring-emerald-400/30 transition-transform duration-300 group-hover:scale-110">
                  <Users className="h-7 w-7 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">
                    Para candidatos
                  </h3>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    Consigue tu próximo trabajo
                  </p>
                </div>
              </div>
              
              <ul className="mt-6 space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    ✓
                  </span>
                  <span>Crea un CV profesional con nuestro constructor</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    ✓
                  </span>
                  <span>Postúlate a vacantes con un solo clic</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    ✓
                  </span>
                  <span>Recibe notificaciones sobre el estatus de tus aplicaciones</span>
                </li>
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/cv/builder"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-emerald-500 hover:shadow-lg"
                >
                  <Sparkles className="h-4 w-4" />
                  Crear mi CV
                </Link>
                <Link
                  href="/auth/signin?role=CANDIDATE"
                  className="inline-flex items-center justify-center rounded-lg border-2 border-border px-6 py-3 font-semibold text-foreground transition-all duration-200 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                >
                  Iniciar sesión
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights - rediseñados con íconos y mejor jerarquía */}
      <section className="mx-auto max-w-7xl px-6 pb-20 bg-white dark:bg-zinc-950">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            ¿Por qué Bolsa TI?
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Todo lo que necesitas para conectar talento con oportunidades
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="group rounded-2xl border border-border bg-white dark:bg-zinc-900 p-8 shadow-sm transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 transition-transform duration-300 group-hover:scale-110">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              Postulación instantánea
            </h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Aplica con un clic usando tu perfil. Sin formularios largos,
              sin repetir información. Tu tiempo vale.
            </p>
          </div>

          <div className="group rounded-2xl border border-border bg-white dark:bg-zinc-900 p-8 shadow-sm transition-all duration-300 hover:border-violet-500/30 hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300 transition-transform duration-300 group-hover:scale-110">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              Búsqueda inteligente
            </h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Filtra por stack tecnológico, nivel de experiencia, modalidad
              y ubicación. Encuentra exactamente lo que buscas.
            </p>
          </div>

          <div className="group rounded-2xl border border-border bg-white dark:bg-zinc-900 p-8 shadow-sm transition-all duration-300 hover:border-sky-500/30 hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300 transition-transform duration-300 group-hover:scale-110">
              <Kanban className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              Pipeline visual
            </h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Gestiona procesos de selección con tableros Kanban. Mueve
              candidatos entre etapas con drag & drop.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section - NUEVO */}
      <section className="mx-auto max-w-4xl px-6 pb-20 bg-white dark:bg-zinc-950">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            Preguntas frecuentes
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Todo lo que necesitas saber antes de empezar
          </p>
        </div>

        <div className="space-y-4">
          <details className="group rounded-xl border border-border bg-white dark:bg-zinc-900 p-6 transition-all duration-200 hover:border-emerald-500/30 open:border-emerald-500/30">
            <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold text-foreground">
              <span>¿Es realmente gratis crear mi CV?</span>
              <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Sí, completamente gratis. Puedes crear tu CV profesional, descargarlo en PDF
              y compartirlo online sin costo alguno. No hay trucos ni cargos ocultos.
            </p>
          </details>

          <details className="group rounded-xl border border-border bg-white dark:bg-zinc-900 p-6 transition-all duration-200 hover:border-emerald-500/30 open:border-emerald-500/30">
            <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold text-foreground">
              <span>¿Necesito pagar para postularme a vacantes?</span>
              <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              No. Cualquier candidato puede registrarse gratis, crear su perfil y postularse
              a todas las vacantes que desee. Los planes de pago son solo para reclutadores
              que publican vacantes.
            </p>
          </details>

          <details className="group rounded-xl border border-border bg-white dark:bg-zinc-900 p-6 transition-all duration-200 hover:border-emerald-500/30 open:border-emerald-500/30">
            <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold text-foreground">
              <span>¿Cuánto tiempo toma crear un CV?</span>
              <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Entre 5 y 15 minutos dependiendo de cuánta experiencia tengas. El constructor
              te guía paso a paso y puedes guardar tu progreso para completarlo después.
            </p>
          </details>

          <details className="group rounded-xl border border-border bg-white dark:bg-zinc-900 p-6 transition-all duration-200 hover:border-emerald-500/30 open:border-emerald-500/30">
            <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold text-foreground">
              <span>¿Puedo editar mi CV después de crearlo?</span>
              <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Por supuesto. Tu CV se guarda en tu perfil y puedes editarlo cuando quieras.
              Los cambios se reflejan inmediatamente en todas tus postulaciones activas.
            </p>
          </details>

          <details className="group rounded-xl border border-border bg-white dark:bg-zinc-900 p-6 transition-all duration-200 hover:border-emerald-500/30 open:border-emerald-500/30">
            <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold text-foreground">
              <span>¿Cómo funciona el proceso de postulación?</span>
              <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Una vez que completes tu perfil, solo haz clic en "Postularme" en cualquier
              vacante. Tu información se envía automáticamente al reclutador, quien puede
              ver tu CV y contactarte directamente.
            </p>
          </details>

          <details className="group rounded-xl border border-border bg-white dark:bg-zinc-900 p-6 transition-all duration-200 hover:border-emerald-500/30 open:border-emerald-500/30">
            <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold text-foreground">
              <span>¿Qué incluyen los planes para reclutadores?</span>
              <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Los planes permiten publicar vacantes, acceder a la base de candidatos,
              gestionar postulaciones en el Pipeline y recibir notificaciones. Revisa
              los detalles completos en la sección de precios más abajo.
            </p>
          </details>
        </div>
      </section>

      {/* Precios */}
      <PricingSection />

      {/* Footer mejorado */}
      <footer className="border-t border-border/60 bg-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-foreground">Bolsa TI</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Conectando talento tech con oportunidades
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <Link href="/about" className="transition-colors hover:text-foreground">
                Acerca de
              </Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">
                Contacto
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacidad
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                Términos
              </Link>
            </div>
          </div>
          
          <div className="mt-8 border-t border-border/60 pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              © {year} Bolsa TI. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}