// app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import {
  Users,
  Briefcase,
  Zap,
  Target,
  Kanban,
  FileText,
  Sparkles,
  Building2,
  UserCircle,
  CheckCircle,
  TrendingUp,
  Shield,
  ArrowRight,
  Rocket,
  MapPin,
  Star,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as
    | "ADMIN"
    | "RECRUITER"
    | "CANDIDATE"
    | undefined;

  if (role === "RECRUITER" || role === "ADMIN") redirect("/dashboard/overview");
  if (role === "CANDIDATE") redirect("/profile/summary");

  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">

      {/* ══════════════════════════════════════════════
          HERO — Enfoque total en el candidato
      ══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Fondo con gradiente mesh */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-60 -right-60 h-[600px] w-[600px] rounded-full bg-emerald-400/15 dark:bg-emerald-500/10 blur-3xl" />
          <div className="absolute top-40 -left-40 h-[400px] w-[400px] rounded-full bg-teal-400/10 dark:bg-teal-500/8 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-[300px] w-[300px] rounded-full bg-blue-400/10 dark:bg-blue-500/8 blur-3xl" />
          {/* Grid pattern sutil */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98108_1px,transparent_1px),linear-gradient(to_bottom,#10b98108_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center pt-16 pb-20 text-center sm:pt-20 lg:pt-28 lg:pb-28">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-sm mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Bolsa de trabajo TI en México
            </div>

            {/* Headline */}
            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl lg:text-7xl leading-[1.05]">
              Tu próximo trabajo{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
                  en TI
                </span>
                <svg
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 w-full text-emerald-300 dark:text-emerald-700"
                  height="10"
                  viewBox="0 0 200 10"
                  preserveAspectRatio="none"
                >
                  <path d="M0 8 Q100 0 200 8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
                </svg>
              </span>{" "}
              está aquí
            </h1>

            <p className="mt-6 max-w-2xl text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed sm:text-xl">
              Conectamos talento tecnológico con las mejores empresas de México.
              Crea tu perfil, aplica a vacantes y da el siguiente paso en tu carrera.
            </p>

            {/* ── CTAs principales ── */}
            <div className="mt-10 flex flex-col w-full max-w-sm gap-3 sm:flex-row sm:max-w-none sm:w-auto sm:gap-4">
              {/* Botón primario — MUY visible */}
              <Link
                href="/unete"
                className="group relative inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 dark:bg-emerald-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-emerald-600/30 dark:shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:shadow-2xl hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:translate-y-0 sm:px-10 sm:py-5 sm:text-lg"
              >
                <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-1" />
              </Link>

              {/* Botón secundario */}
              <Link
                href="/jobs"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 px-8 py-4 text-base font-semibold text-zinc-700 dark:text-zinc-200 backdrop-blur-sm transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-white dark:hover:bg-zinc-900 hover:-translate-y-0.5 active:translate-y-0 sm:px-10 sm:py-5 sm:text-lg"
              >
                Ver vacantes
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-400 dark:text-zinc-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Siempre gratis para candidatos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Sin tarjeta de crédito</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-500" />
                <span>Enfocado en México</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          DOS CAMINOS — Candidatos vs Empresas
      ══════════════════════════════════════════════ */}
      <section className="border-y border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/80 dark:bg-zinc-900/50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              ¿Quién eres?
            </h2>
            <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400 sm:text-lg">
              Tenemos la herramienta correcta para ti
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Card Candidatos — destacada ── */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-zinc-900 p-8 shadow-xl shadow-emerald-500/5 sm:p-10">
              {/* Accent top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-t-3xl" />
              {/* Glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />

              <div className="relative">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
                  <UserCircle className="h-7 w-7 text-white" />
                </div>

                <div className="mt-1 inline-flex ml-3 align-middle items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                  <Star className="h-3 w-3 fill-current" />
                  Gratis
                </div>

                <h3 className="mt-5 text-2xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  Soy candidato
                </h3>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Encuentra tu próximo reto profesional. Crea tu CV, postula con un clic y lleva seguimiento de tus aplicaciones.
                </p>

                <ul className="mt-6 space-y-3">
                  {[
                    "CV profesional y descargable en PDF",
                    "Postulación instantánea a vacantes",
                    "Seguimiento de tus aplicaciones",
                    "Alertas de vacantes relevantes",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/unete"
                  className="group mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 dark:bg-emerald-500 px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <UserCircle className="h-5 w-5" />
                  Crear cuenta gratis
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <p className="mt-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  Sin tarjeta de crédito · Siempre gratis
                </p>
              </div>
            </div>

            {/* ── Card Empresas ── */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-10">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-400 rounded-t-3xl" />
              <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-violet-400/8 blur-3xl" />

              <div className="relative">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                  <Building2 className="h-7 w-7 text-white" />
                </div>

                <h3 className="mt-5 text-2xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  Soy empresa
                </h3>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Publica vacantes, evalúa candidatos y gestiona tu pipeline de reclutamiento en un solo lugar.
                </p>

                <ul className="mt-6 space-y-3">
                  {[
                    "Publica vacantes en minutos",
                    "Pipeline Kanban de candidatos",
                    "Evaluaciones técnicas integradas",
                    "Analytics y reportes en tiempo real",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <div className="h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth/signup/recruiter"
                  className="group mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-violet-200 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-950/30 px-6 py-4 text-base font-bold text-violet-700 dark:text-violet-300 transition-all duration-200 hover:bg-violet-100 dark:hover:bg-violet-950/50 hover:border-violet-300 dark:hover:border-violet-700 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Building2 className="h-5 w-5" />
                  Empezar prueba gratuita
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <p className="mt-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  14 días gratis · Cancela cuando quieras
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CV BUILDER — Feature destacada
      ══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 dark:from-emerald-700 dark:to-teal-700 p-8 shadow-2xl sm:p-12 lg:p-16">
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />

            <div className="relative grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white uppercase tracking-wide mb-6">
                  <Sparkles className="h-3.5 w-3.5" />
                  Herramienta gratuita
                </div>

                <h2 className="text-3xl font-black text-white sm:text-4xl lg:text-5xl leading-tight">
                  Tu CV profesional
                  <br />
                  <span className="text-emerald-200">en 10 minutos</span>
                </h2>
                <p className="mt-4 text-base text-emerald-100 leading-relaxed sm:text-lg">
                  Constructor intuitivo con diseño moderno y optimizado para ATS. Sin plantillas genéricas.
                </p>

                <ul className="mt-8 space-y-3">
                  {[
                    "Diseño profesional automático que pasa filtros ATS",
                    "Exporta en PDF o comparte con link único",
                    "Edita cuando quieras desde cualquier dispositivo",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-emerald-100">
                      <CheckCircle className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/cv/builder"
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-emerald-700 shadow-lg transition-all duration-200 hover:bg-emerald-50 hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <Rocket className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                    Crear mi CV ahora
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/unete"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:-translate-y-0.5"
                  >
                    O crea tu cuenta
                  </Link>
                </div>
              </div>

              {/* Mock CV preview */}
              <div className="relative hidden lg:block">
                <div className="absolute inset-0 rounded-2xl bg-black/20 blur-2xl translate-y-4" />
                <div className="relative rounded-2xl border border-white/20 bg-white/95 dark:bg-zinc-900/95 p-8 shadow-2xl">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-200 dark:bg-emerald-900" />
                      <div className="space-y-1.5">
                        <div className="h-3 w-28 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                        <div className="h-2 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    </div>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
                      <div className="h-2 w-16 rounded-full bg-emerald-200 dark:bg-emerald-900" />
                      <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-2 w-5/6 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-2 w-4/6 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
                      <div className="h-2 w-20 rounded-full bg-emerald-200 dark:bg-emerald-900" />
                      <div className="flex flex-wrap gap-1.5">
                        {["React", "TypeScript", "Node.js", "AWS"].map((s) => (
                          <span key={s} className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Checkmark verde de "listo" */}
                  <div className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FEATURES GRID
      ══════════════════════════════════════════════ */}
      <section className="border-y border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Todo lo que necesitas
            </h2>
            <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400 sm:text-lg">
              Una plataforma completa para reclutamiento tecnológico
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: FileText, title: "CV Profesional", description: "Constructor drag & drop con plantillas ATS-friendly. Descarga PDF o comparte con link único.", color: "emerald" },
              { icon: Target, title: "Búsqueda Inteligente", description: "Filtros avanzados por experiencia, ubicación y modalidad. Encuentra el match perfecto.", color: "blue" },
              { icon: Kanban, title: "Pipeline Visual", description: "Gestión Kanban de candidatos. Arrastra entre etapas y mantén todo organizado.", color: "violet" },
              { icon: Zap, title: "Postulación Rápida", description: "Aplica a vacantes con un solo clic. Tu perfil se envía automáticamente al reclutador.", color: "amber" },
              { icon: Shield, title: "Perfiles Verificados", description: "Candidatos verificados con skills validados. Reduce tiempo de screening.", color: "teal" },
              { icon: TrendingUp, title: "Analytics & Insights", description: "Métricas en tiempo real. Optimiza tu proceso de reclutamiento con data.", color: "rose" },
            ].map((feature, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-transform duration-300 group-hover:scale-110">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 mb-6">
            <Rocket className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 sm:text-4xl lg:text-5xl">
            ¿Listo para el siguiente paso?
          </h2>
          <p className="mt-4 text-base text-zinc-500 dark:text-zinc-400 sm:text-lg">
            Únete a cientos de profesionales TI que ya encontraron su próximo proyecto en TaskIO.
          </p>

          <div className="mt-10 flex flex-col w-full gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link
              href="/unete"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 dark:bg-emerald-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:shadow-2xl hover:-translate-y-0.5 sm:px-10 sm:py-5 sm:text-lg"
            >
              <UserCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-8 py-4 text-base font-semibold text-zinc-700 dark:text-zinc-200 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 hover:-translate-y-0.5 sm:px-10 sm:py-5 sm:text-lg"
            >
              Explorar vacantes
            </Link>
          </div>

          <p className="mt-6 text-sm text-zinc-400 dark:text-zinc-500">
            Gratis para candidatos · Sin tarjeta de crédito · Cancela cuando quieras
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                TaskIO
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Conectando talento TI con oportunidades en México
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Link href="/about" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Acerca de</Link>
              <Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Contacto</Link>
              <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Privacidad</Link>
              <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Términos</Link>
              <Link href="/unete" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">Únete gratis →</Link>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-100 dark:border-zinc-800 pt-6 text-center">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              © {year} TaskIO. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}