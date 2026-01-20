// app/page.tsx - VERSIÓN PRO
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import JobSearchBar from "@/components/JobSearchBar";
import PricingSection from "@/components/marketing/PricingSection";
import {
  Users,
  Briefcase,
  Zap,
  Target,
  Kanban,
  FileText,
  ChevronDown,
  Sparkles,
  Building2,
  UserCircle,
  CheckCircle,
  TrendingUp,
  Clock,
  Shield,
  Star,
  ArrowRight,
  Code,
  Rocket,
  Award,
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

  if (role === "RECRUITER" || role === "ADMIN") {
    redirect("/dashboard/overview");
  }

  if (role === "CANDIDATE") {
    redirect("/profile/summary");
  }

  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* ===== HERO SECTION - Ultra moderno ===== */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        {/* Animated gradient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/20 dark:bg-emerald-500/10 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/20 dark:bg-blue-500/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-20 lg:pt-20 lg:pb-24">
          <div className="flex flex-col items-center text-center">
            {/* Animated badge with pulse */}
            <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-emerald-500/30 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 backdrop-blur-sm shadow-sm ring-1 ring-emerald-500/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">
                +500 candidatos tech activos • 100+ empresas contratando
              </span>
              <span className="sm:hidden">500+ tech talents disponibles</span>
            </div>

            {/* Hero headline con animación mejorada */}
            <h1 className="animate-fade-in-up mt-8 max-w-5xl text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl lg:text-7xl">
              Conecta con tu{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent animate-gradient">
                  próximo proyecto
                </span>
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="12"
                  viewBox="0 0 300 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 10C50 5 100 2 150 2C200 2 250 5 298 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-emerald-500 dark:text-emerald-400"
                  />
                </svg>
              </span>{" "}
              en tech
            </h1>

            <p className="animate-fade-in-up animation-delay-200 mt-6 max-w-3xl text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed">
              La plataforma todo-en-uno para encontrar trabajo tech o contratar
              talento. CV profesional, postulaciones inteligentes y gestión
              completa de procesos.
            </p>

            {/* CTAs con animaciones y mejor jerarquía */}
            <div className="animate-fade-in-up animation-delay-300 mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/cv/builder"
                className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-500 px-10 py-5 text-lg font-semibold text-white shadow-2xl shadow-emerald-600/30 dark:shadow-emerald-500/20 transition-all duration-300 hover:shadow-emerald-600/40 dark:hover:shadow-emerald-500/30 hover:scale-105 active:scale-100"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Crear mi CV gratis
                </span>
                <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
              <Link
                href="/jobs"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 px-10 py-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100 backdrop-blur-sm transition-all duration-300 hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-white dark:hover:bg-zinc-900 hover:scale-105 active:scale-100"
              >
                Explorar vacantes
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Social proof */}
            <div className="animate-fade-in-up animation-delay-500 mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-white dark:border-zinc-950" />
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 border-2 border-white dark:border-zinc-950" />
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 border-2 border-white dark:border-zinc-950" />
                </div>
                <span className="font-medium">+500 candidatos activos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="font-medium">4.9/5 en satisfacción</span>
              </div>
            </div>
          </div>

          {/* Search bar mejorado con contexto */}
          <div className="animate-fade-in-up animation-delay-600 mt-16">
            <div className="mb-4 text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                O busca directamente entre{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  +200 vacantes activas
                </span>
              </p>
            </div>
            <Suspense
              fallback={
                <div className="h-20 w-full animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg" />
              }
            >
              <JobSearchBar />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ===== STATS SECTION - Credibilidad ===== */}
      <section className="relative border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                500+
              </div>
              <div className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Candidatos Tech
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                200+
              </div>
              <div className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Vacantes Activas
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-violet-600 dark:text-violet-400">
                100+
              </div>
              <div className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Empresas Activas
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-teal-600 dark:text-teal-400">
                95%
              </div>
              <div className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Tasa de Match
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURED RESUME BUILDER - Hero secundario ===== */}
      <section className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/10 p-12 shadow-2xl md:p-16">
          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-emerald-400/20 dark:bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-teal-400/20 dark:bg-teal-400/10 blur-3xl" />
          
          <div className="relative grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 dark:bg-emerald-500 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                <Sparkles className="h-4 w-4" />
                Herramienta destacada
              </div>
              <h2 className="mt-6 text-4xl font-bold text-zinc-900 dark:text-zinc-50 md:text-5xl">
                Tu CV profesional en
                <span className="text-emerald-600 dark:text-emerald-400"> 10 minutos</span>
              </h2>
              <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Constructor intuitivo con diseño moderno y optimizado para ATS.
                Sin plantillas genéricas, sin complicaciones.
              </p>
              
              <ul className="mt-8 space-y-4">
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500 text-white shrink-0">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                      Diseño profesional automático
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Formato limpio que pasa filtros ATS
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500 text-white shrink-0">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                      Exporta en segundos
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      PDF descargable o link para compartir
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500 text-white shrink-0">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                      Edita cuando quieras
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Mantén tu perfil siempre actualizado
                    </div>
                  </div>
                </li>
              </ul>

              <Link
                href="/cv/builder"
                className="group mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 dark:bg-emerald-500 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-emerald-600/25 dark:shadow-emerald-500/20 transition-all duration-300 hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:shadow-2xl hover:-translate-y-1"
              >
                <Rocket className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                Crear mi CV ahora
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Mock CV preview */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 blur-2xl" />
              <div className="relative rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-2xl">
                <div className="space-y-4">
                  <div className="h-4 w-32 rounded-full bg-emerald-200 dark:bg-emerald-900/50" />
                  <div className="h-3 w-48 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-6 space-y-2">
                    <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-2 w-5/6 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-2 w-4/6 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TWO PATHS - Rediseñado como hero cards ===== */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 md:text-5xl">
            Elige tu camino
          </h2>
          <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
            Herramientas diseñadas específicamente para tu objetivo
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Candidatos Card - Premium */}
          <div className="group relative overflow-hidden rounded-3xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-500 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-2">
            {/* Gradient overlay on hover */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/0 to-emerald-500/0 opacity-0 transition-opacity duration-500 group-hover:from-emerald-500/5 group-hover:via-transparent group-hover:to-emerald-500/5 group-hover:opacity-100" />
            
            <div className="relative p-10 md:p-12">
              {/* Icon with animated background */}
              <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/30 text-emerald-600 dark:text-emerald-400 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                <UserCircle className="h-10 w-10" />
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-xl opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              <h3 className="mt-6 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Para Candidatos
              </h3>
              <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Encuentra tu próximo trabajo tech. CV profesional, postulaciones
                con un clic y seguimiento completo.
              </p>

              {/* Features list */}
              <div className="mt-8 space-y-4">
                {[
                  { icon: FileText, text: "CV builder intuitivo y gratuito" },
                  { icon: Zap, text: "Postulación instantánea a vacantes" },
                  { icon: Kanban, text: "Dashboard de seguimiento" },
                  { icon: Target, text: "Alertas de vacantes relevantes" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 group/item">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 transition-transform group-hover/item:scale-110">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link
                href="/auth/signup"
                className="group/button mt-10 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-500 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/30"
              >
                Comenzar gratis
                <ArrowRight className="h-5 w-5 transition-transform group-hover/button:translate-x-1" />
              </Link>

              <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Sin tarjeta de crédito • Siempre gratis para candidatos
              </p>
            </div>
          </div>

          {/* Reclutadores Card - Premium */}
          <div className="group relative overflow-hidden rounded-3xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-500 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-2">
            {/* Gradient overlay on hover */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-violet-500/0 opacity-0 transition-opacity duration-500 group-hover:from-violet-500/5 group-hover:via-transparent group-hover:to-violet-500/5 group-hover:opacity-100" />
            
            <div className="relative p-10 md:p-12">
              {/* Icon with animated background */}
              <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-950/50 dark:to-purple-950/30 text-violet-600 dark:text-violet-400 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                <Building2 className="h-10 w-10" />
                <div className="absolute inset-0 rounded-2xl bg-violet-500/20 blur-xl opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              <h3 className="mt-6 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Para Empresas
              </h3>
              <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Contrata talento tech de calidad. Publica vacantes, gestiona
                candidatos y cierra contrataciones más rápido.
              </p>

              {/* Features list */}
              <div className="mt-8 space-y-4">
                {[
                  { icon: Briefcase, text: "Vacantes ilimitadas publicadas" },
                  { icon: Users, text: "Acceso a base de +500 candidatos" },
                  { icon: Kanban, text: "Pipeline Kanban interactivo" },
                  { icon: TrendingUp, text: "Analytics y reportes" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 group/item">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 transition-transform group-hover/item:scale-110">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link
                href="/auth/signup"
                className="group/button mt-10 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-500 dark:to-purple-500 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30"
              >
                Empezar prueba gratuita
                <ArrowRight className="h-5 w-5 transition-transform group-hover/button:translate-x-1" />
              </Link>

              <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                14 días gratis • Cancela cuando quieras
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID - Más detallado ===== */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 md:text-5xl">
              Todo lo que necesitas
            </h2>
            <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
              Una plataforma completa para tech recruiting
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "CV Profesional",
                description: "Constructor drag & drop con plantillas ATS-friendly. Descarga PDF o comparte con link único.",
                color: "emerald",
              },
              {
                icon: Target,
                title: "Búsqueda Inteligente",
                description: "Filtros avanzados por stack, experiencia, ubicación y modalidad. Encuentra el match perfecto.",
                color: "blue",
              },
              {
                icon: Kanban,
                title: "Pipeline Visual",
                description: "Gestión Kanban de candidatos. Arrastra entre etapas y mantén todo organizado.",
                color: "violet",
              },
              {
                icon: Zap,
                title: "Postulación Rápida",
                description: "Aplica a vacantes con un solo clic. Tu perfil se envía automáticamente al reclutador.",
                color: "yellow",
              },
              {
                icon: Shield,
                title: "Perfiles Verificados",
                description: "Candidatos verificados con skills validados. Reduce tiempo de screening.",
                color: "teal",
              },
              {
                icon: TrendingUp,
                title: "Analytics & Insights",
                description: "Métricas en tiempo real. Optimiza tu proceso de reclutamiento con data.",
                color: "indigo",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-8 transition-all duration-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xl hover:-translate-y-1"
              >
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl bg-${feature.color}-100 dark:bg-${feature.color}-950/50 text-${feature.color}-600 dark:text-${feature.color}-400 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  {feature.title}
                </h3>
                <p className="mt-3 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS - Nuevo ===== */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 md:text-5xl">
            Historias de éxito
          </h2>
          <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
            Lo que dicen quienes ya encontraron su match
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              name: "Ana García",
              role: "Frontend Developer",
              company: "Tech Startup",
              quote: "Encontré mi trabajo actual en 2 semanas. El CV builder es increíble y la postulación con un clic me ahorró mucho tiempo.",
              avatar: "AG",
            },
            {
              name: "Carlos Méndez",
              role: "Tech Recruiter",
              company: "Fintech Corp",
              quote: "El pipeline Kanban cambió completamente nuestro proceso. Ahora gestionamos 50+ candidatos sin perder el control.",
              avatar: "CM",
            },
            {
              name: "Laura Ruiz",
              role: "Full Stack Developer",
              company: "SaaS Company",
              quote: "La calidad de las vacantes es excelente. Solo tech roles bien pagados y empresas serias. Vale la pena 100%.",
              avatar: "LR",
            },
          ].map((testimonial, i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex items-center gap-1 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {testimonial.role} @ {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            Preguntas frecuentes
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Todo lo que necesitas saber
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "¿Es realmente gratis crear mi CV?",
              a: "Sí, completamente gratis. Puedes crear tu CV profesional, descargarlo en PDF y compartirlo online sin costo alguno. No hay trucos ni cargos ocultos.",
            },
            {
              q: "¿Necesito pagar para postularme a vacantes?",
              a: "No. Cualquier candidato puede registrarse gratis, crear su perfil y postularse a todas las vacantes que desee. Los planes de pago son solo para reclutadores.",
            },
            {
              q: "¿Cuánto tiempo toma crear un CV?",
              a: "Entre 5 y 15 minutos dependiendo de tu experiencia. El constructor te guía paso a paso y puedes guardar tu progreso.",
            },
            {
              q: "¿Puedo editar mi CV después de crearlo?",
              a: "Por supuesto. Tu CV se guarda en tu perfil y puedes editarlo cuando quieras. Los cambios se reflejan inmediatamente en tus postulaciones.",
            },
            {
              q: "¿Cómo funciona el proceso de postulación?",
              a: "Una vez que completes tu perfil, solo haz clic en \"Postularme\" en cualquier vacante. Tu información se envía automáticamente al reclutador.",
            },
            {
              q: "¿Qué incluyen los planes para reclutadores?",
              a: "Los planes permiten publicar vacantes, acceder a candidatos, gestionar postulaciones en el Pipeline y recibir notificaciones. Revisa los detalles en la sección de precios.",
            },
          ].map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-all duration-200 hover:border-emerald-400 dark:hover:border-emerald-600 open:border-emerald-400 dark:open:border-emerald-600"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-4 font-semibold text-zinc-900 dark:text-zinc-100">
                <span>{faq.q}</span>
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-zinc-500 dark:text-zinc-400 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
      <PricingSection />

      {/* ===== CTA FINAL - Nuevo ===== */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/10 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 md:text-5xl">
            ¿Listo para dar el siguiente paso?
          </h2>
          <p className="mt-6 text-xl text-zinc-700 dark:text-zinc-300">
            Únete a +500 profesionales tech que ya encontraron su próximo proyecto
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/cv/builder"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-500 px-10 py-5 text-lg font-semibold text-white shadow-2xl shadow-emerald-600/30 dark:shadow-emerald-500/20 transition-all duration-300 hover:scale-105"
            >
              <Sparkles className="h-5 w-5" />
              Comenzar gratis
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-10 py-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100 transition-all duration-300 hover:scale-105"
            >
              Ver vacantes disponibles
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                TaskIT
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Conectando talento tech con oportunidades
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <Link
                href="/about"
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Acerca de
              </Link>
              <Link
                href="/contact"
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Contacto
              </Link>
              <Link
                href="/privacy"
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Privacidad
              </Link>
              <Link
                href="/terms"
                className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Términos
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6 text-center">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              © {year} Bolsa TI. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}