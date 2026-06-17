// app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import Footer from "@/components/Footer";
import TechMarquee from "@/components/landing/TechMarquee";
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
  Code2,
  Brain,
  LayoutDashboard,
  ClipboardCheck,
  Search,
  Send,
  PlayCircle,
  BadgeCheck,
  ChevronRight,
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

  return (
    // -mx y -mb cancelan el max-w-7xl / px / pb-10 que inyecta layout.tsx
    // así la landing puede tener secciones full-width sin una franja de fondo
    // debajo del footer que parezca un segundo footer.
    <div className="min-h-screen bg-white dark:bg-zinc-950 -mx-4 sm:-mx-6 lg:-mx-8 -mb-10">

      {/* ══════════════════════════════════════════════
          HERO — Dual audience, diferenciado
      ══════════════════════════════════════════════ */}
      <section className="relative bg-[#082B33] overflow-hidden">
        {/* Subtle dot texture */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(16,185,129,0.07)_1px,transparent_1px)] bg-[size:28px_28px]" />
        {/* Center glow */}
        <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-500/6 blur-[120px] rounded-full" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center pt-16 pb-20 text-center sm:pt-20 lg:pt-32 lg:pb-28">

            {/* Headline */}
            <h1 className="font-display max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-[5.5rem] lg:leading-[0.95] animate-fade-in-up" style={{textWrap: "balance" as never}}>
              El reclutamiento TI
              <br className="hidden sm:block" />
              {" "}<span className="text-emerald-400">que sí funciona.</span>
            </h1>

            <p className="mt-8 max-w-xl text-base text-[#7ab5bf] leading-relaxed sm:text-lg animate-fade-in-up animation-delay-200">
              Evaluaciones técnicas con <strong className="text-white font-semibold">código real</strong>, AI Match inteligente y ATS con pipeline Kanban.
              La plataforma completa para talento TI en México.
            </p>

            {/* Dual CTAs */}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row w-full max-w-md animate-fade-in-up animation-delay-300">
              <Link
                href="/unete"
                className="group flex flex-1 flex-col items-center gap-0.5 rounded-2xl bg-emerald-400 px-6 py-4 text-[#082B33] shadow-xl shadow-emerald-400/20 transition-all duration-200 hover:bg-emerald-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="flex items-center gap-2 font-bold text-base">
                  <UserCircle className="h-5 w-5" />
                  Soy candidato
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
                <span className="text-xs text-[#082B33]/60 font-normal">Siempre gratis</span>
              </Link>

              <Link
                href="/auth/signup/recruiter"
                className="group flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 py-4 text-white shadow-sm transition-all duration-200 hover:bg-white/15 hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="flex items-center gap-2 font-bold text-base">
                  <Building2 className="h-5 w-5" />
                  Soy empresa
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
                <span className="text-xs text-white/50 font-normal">14 días gratis · Sin tarjeta</span>
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-xs text-[#4a8a96] animate-fade-in-up animation-delay-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                <span>Código en sandbox real</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                <span>AI Match con GPT-4</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                <span>Hecho para México</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TECH MARQUEE
      ══════════════════════════════════════════════ */}
      <TechMarquee />

      {/* ══════════════════════════════════════════════
          DIFERENCIADORES — No somos un job board genérico
      ══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              No somos otro job board.
            </h2>
            <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400 sm:text-lg max-w-xl mx-auto">
              OCC y LinkedIn te dan currículums. Taskio te da certeza técnica.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {/* Diferenciador 1 — Código real */}
            <div className="group relative overflow-hidden rounded-3xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-zinc-900 p-8 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30">
                <Code2 className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                Código real, no palabras clave
              </h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Los candidatos escriben y ejecutan código en un entorno seguro. Ves el output real, no solo si "saben React".
              </p>
              <div className="mt-5 rounded-xl bg-zinc-900 dark:bg-zinc-800 p-3 font-mono text-xs">
                <span className="text-emerald-400">✓ Tests pasados:</span>
                <span className="text-zinc-300"> 8/10</span>
                <br />
                <span className="text-zinc-500">Runtime: 42ms · Python 3.11</span>
              </div>
            </div>

            {/* Diferenciador 2 — AI Match */}
            <div className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-8 transition-all duration-300 hover:shadow-xl hover:shadow-zinc-500/10 hover:-translate-y-1">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#082B33] shadow-lg shadow-[#082B33]/30">
                <Brain className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                AI Match, no sorteo
              </h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                GPT-4 analiza skills, experiencia y seniority del candidato contra los requerimientos de la vacante. Ranking objetivo.
              </p>
              <div className="mt-5 space-y-2">
                {[
                  { name: "Ana García", match: 94, color: "bg-emerald-500" },
                  { name: "Luis Torres", match: 81, color: "bg-teal-500" },
                  { name: "María Ruiz", match: 73, color: "bg-blue-500" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <div className="h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-300 flex-1 truncate">{c.name}</span>
                    <div className="w-16 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.match}%` }} />
                    </div>
                    <span className="font-bold text-zinc-700 dark:text-zinc-200 w-7">{c.match}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Diferenciador 3 — ATS Completo */}
            <div className="group relative overflow-hidden rounded-3xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-zinc-900 p-8 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/30">
                <LayoutDashboard className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                ATS real, no una lista
              </h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Pipeline Kanban de candidatos, notificaciones automáticas, seguimiento por etapa y analytics de reclutamiento.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-1.5 text-[10px]">
                {["Postulados", "En revisión", "Entrevista"].map((col, ci) => (
                  <div key={col} className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-2">
                    <div className="font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 truncate">{col}</div>
                    {[1, ci < 2 ? 2 : null].filter(Boolean).map((_, i) => (
                      <div key={i} className="mb-1 h-5 rounded bg-white dark:bg-zinc-700 shadow-sm" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CÓMO FUNCIONA — Flujo por audiencia
      ══════════════════════════════════════════════ */}
      <section className="border-y border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Simple para todos
            </h2>
            <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
              Candidatos y empresas. Cada uno con su flujo optimizado.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">

            {/* Flujo Candidatos */}
            <div>
              <div className="mb-8 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/25">
                  <UserCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Para candidatos</h3>
                  <p className="text-xs text-zinc-400">Siempre gratis</p>
                </div>
              </div>
              <div className="space-y-5">
                {[
                  { step: "01", icon: FileText, title: "Crea tu perfil profesional", desc: "CV Builder guiado: experiencia, skills, certificaciones. Descargable en PDF con un clic.", color: "emerald" },
                  { step: "02", icon: Search, title: "Encuentra vacantes relevantes", desc: "Filtros por stack, seniority, modalidad y ciudad. Solo vacantes TI verificadas.", color: "emerald" },
                  { step: "03", icon: Send, title: "Aplica con un clic", desc: "Tu perfil se envía automáticamente. Sigue el estado de cada aplicación en tiempo real.", color: "emerald" },
                  { step: "04", icon: Code2, title: "Demuestra tu nivel técnico", desc: "Realiza evaluaciones de código reales. Destaca frente a candidatos que solo dicen que saben.", color: "emerald" },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                        <item.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="mt-2 w-px flex-1 bg-emerald-100 dark:bg-emerald-900/40" />
                    </div>
                    <div className="pb-5">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</h4>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/unete"
                className="group mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-500 hover:-translate-y-0.5"
              >
                Empezar gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Flujo Empresas */}
            <div>
              <div className="mb-8 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#082B33] shadow-lg shadow-[#082B33]/30">
                  <Building2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Para empresas</h3>
                  <p className="text-xs text-zinc-400">14 días gratis</p>
                </div>
              </div>
              <div className="space-y-5">
                {[
                  { step: "01", icon: Briefcase, title: "Publica tu vacante en 2 minutos", desc: "Wizard guiado con skills requeridas, seniority y modalidad. La vacante aparece en la bolsa pública TI." },
                  { step: "02", icon: Brain, title: "AI filtra automáticamente", desc: "GPT-4 rankea candidatos por compatibilidad real. No más revisar 200 CVs irrelevantes." },
                  { step: "03", icon: ClipboardCheck, title: "Evalúa técnicamente antes de entrevistar", desc: "Envía assessments MCQ o de código con un link. El sistema califica automáticamente." },
                  { step: "04", icon: BadgeCheck, title: "Contrata con certeza", desc: "Pipeline Kanban completo: de postulación a oferta. Analytics y reportes de todo el proceso." },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#082B33]/10 dark:bg-emerald-900/30">
                        <item.icon className="h-5 w-5 text-[#082B33] dark:text-emerald-400" />
                      </div>
                      <div className="mt-2 w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                    <div className="pb-5">
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</h4>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/auth/signup/recruiter"
                className="group mt-2 inline-flex items-center gap-2 rounded-xl bg-[#082B33] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#082B33]/25 transition-all duration-200 hover:bg-[#0a3840] hover:-translate-y-0.5"
              >
                Ver demo gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          DEMO MOCKUP — Plataforma en acción
      ══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Mira Taskio por dentro
            </h2>
            <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500 max-w-lg mx-auto">
              Dashboard de reclutador — candidatos rankeados por AI, estado del pipeline y evaluaciones en un solo lugar.
            </p>
          </div>

          {/* Browser mockup */}
          <div className="relative mx-auto max-w-5xl">
            {/* Glow */}
            <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-emerald-400/10 dark:bg-emerald-500/8 blur-3xl" />

            {/* Browser chrome */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl dark:shadow-zinc-900">
              {/* Top bar */}
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <div className="mx-4 flex flex-1 items-center gap-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 px-3 py-1.5">
                  <Shield className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="text-xs text-zinc-400 truncate">app.taskio.mx/dashboard/jobs/123/applications</span>
                </div>
              </div>

              {/* App UI mockup */}
              <div className="flex h-[460px] sm:h-[520px]">

                {/* Sidebar */}
                <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-zinc-100 dark:border-zinc-800 py-6 sm:flex">
                  {[LayoutDashboard, Briefcase, Users, ClipboardCheck, TrendingUp].map((Icon, i) => (
                    <div key={i} className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${i === 1 ? "bg-emerald-600 text-white" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  ))}
                </div>

                {/* Main content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Senior Frontend Developer</h4>
                      <p className="text-xs text-zinc-400">React · TypeScript · Next.js · Remoto</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                        23 candidatos
                      </div>
                      <div className="rounded-full bg-[#082B33]/10 dark:bg-emerald-900/40 px-2.5 py-1 text-[10px] font-bold text-[#082B33] dark:text-emerald-300">
                        AI Match activo
                      </div>
                    </div>
                  </div>

                  {/* Kanban */}
                  <div className="flex flex-1 gap-3 overflow-x-auto p-4">
                    {[
                      {
                        col: "Postulados", count: 12, color: "zinc",
                        cards: [
                          { name: "Ana García", role: "5 años · CDMX", match: 94, tags: ["React", "TS"] },
                          { name: "Luis Torres", role: "3 años · Remoto", match: 81, tags: ["Next.js"] },
                          { name: "María Ruiz", role: "4 años · GDL", match: 73, tags: ["Vue", "React"] },
                        ]
                      },
                      {
                        col: "Evaluación", count: 6, color: "amber",
                        cards: [
                          { name: "Carlos Vega", role: "6 años · MTY", match: 89, tags: ["React", "Node"] },
                          { name: "Sofia Luna", role: "4 años · CDMX", match: 85, tags: ["TS", "AWS"] },
                        ]
                      },
                      {
                        col: "Entrevista", count: 3, color: "emerald",
                        cards: [
                          { name: "Diego Mora", role: "7 años · Remoto", match: 97, tags: ["React", "TS", "AWS"] },
                        ]
                      },
                    ].map((column) => (
                      <div key={column.col} className="flex w-52 shrink-0 flex-col gap-2 sm:w-56">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{column.col}</span>
                          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">{column.count}</span>
                        </div>
                        {column.cards.map((card) => (
                          <div key={card.name} className="group cursor-pointer rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">{card.name}</p>
                                <p className="text-[10px] text-zinc-400">{card.role}</p>
                              </div>
                              <div className="shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 text-center">
                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{card.match}%</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {card.tags.map((t) => (
                                <span key={t} className="rounded-md bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 dark:text-zinc-300">{t}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-4 hidden rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-zinc-900 p-4 shadow-xl sm:block">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
                  <Code2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-50">Evaluación completada</p>
                  <p className="text-[10px] text-zinc-400">Ana García · 8/10 tests · Python</p>
                </div>
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              </div>
            </div>
          </div>

          {/* CTA below mockup */}
          <div className="mt-12 text-center">
            <Link
              href="/auth/signup/recruiter"
              className="group inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 shadow-sm transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-md hover:-translate-y-0.5"
            >
              <PlayCircle className="h-4 w-4 text-emerald-500" />
              Ver demo completa — es gratis
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          DOS CAMINOS — Candidatos vs Empresas
      ══════════════════════════════════════════════ */}
      <section className="border-y border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/80 dark:bg-zinc-900/50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Card Candidatos ── */}
            <div className="relative overflow-hidden rounded-3xl border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-zinc-900 p-8 shadow-lg sm:p-10">
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
                    <UserCircle className="h-7 w-7 text-white" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <Star className="h-3 w-3 fill-current" />
                    Siempre gratis
                  </div>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  Soy candidato
                </h3>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Crea tu CV, postula con un clic y destaca con evaluaciones técnicas reales que prueban lo que sabes.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "CV profesional descargable en PDF",
                    "Postulación instantánea a vacantes TI",
                    "Evaluaciones técnicas que validan tus skills",
                    "Seguimiento en tiempo real de tus aplicaciones",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/unete"
                  className="group mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:bg-emerald-500 hover:-translate-y-0.5 active:translate-y-0"
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
            <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-700/60 bg-[#082B33] p-8 shadow-lg sm:p-10">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(16,185,129,0.06)_1px,transparent_1px)] bg-[size:24px_24px]" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
                    <Building2 className="h-7 w-7 text-white" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white">
                    14 días gratis
                  </div>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
                  Soy empresa
                </h3>
                <p className="mt-2 text-[#7ab5bf] leading-relaxed">
                  Publica vacantes, evalúa con código real y gestiona todo tu pipeline de reclutamiento TI en un solo lugar.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Publica vacantes en minutos con wizard guiado",
                    "AI Match rankea candidatos automáticamente",
                    "Evaluaciones de código real en entorno seguro",
                    "Pipeline Kanban + analytics de reclutamiento",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-white/80">
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/signup/recruiter"
                  className="group mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-6 py-4 text-base font-bold text-[#082B33] shadow-lg shadow-emerald-400/20 transition-all duration-200 hover:bg-emerald-300 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Building2 className="h-5 w-5" />
                  Empezar prueba gratuita
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <p className="mt-3 text-center text-xs text-white/40">
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
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:32px_32px]" />

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
                  Constructor intuitivo con diseño moderno y optimizado para ATS. Sin plantillas genéricas — tu CV, tu historia.
                </p>
                <ul className="mt-8 space-y-3">
                  {[
                    "Diseño profesional que pasa filtros ATS automáticamente",
                    "Exporta en PDF o comparte con link único",
                    "Edita desde cualquier dispositivo en cualquier momento",
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
            <h2 className="font-display text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Todo lo que necesitas
            </h2>
            <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400 sm:text-lg">
              Una plataforma completa para reclutamiento tecnológico
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: FileText, title: "CV Profesional", description: "Constructor drag & drop con plantillas ATS-friendly. Descarga PDF o comparte con link único.", color: "emerald" },
              { icon: Brain, title: "AI Match Score", description: "GPT-4 analiza compatibilidad candidato ↔ vacante. Top candidatos en segundos, no en horas.", color: "violet" },
              { icon: Code2, title: "Evaluaciones de Código", description: "Código real ejecutado en entorno seguro. El candidato demuestra lo que dice saber, no solo lo que escribe en el CV.", color: "blue" },
              { icon: Kanban, title: "Pipeline Kanban", description: "Gestión visual de candidatos por etapa. Arrastra, comenta y colabora con tu equipo.", color: "amber" },
              { icon: Shield, title: "Perfiles Verificados", description: "Skills validados con evaluaciones reales. Reduce el 60% del tiempo de screening.", color: "teal" },
              { icon: TrendingUp, title: "Analytics & Insights", description: "Métricas de tiempo de contratación, fuentes de candidatos y eficiencia del proceso.", color: "rose" },
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
          <h2 className="font-display text-3xl font-black text-zinc-900 dark:text-zinc-50 sm:text-4xl lg:text-5xl">
            ¿Listo para el siguiente paso?
          </h2>
          <p className="mt-4 text-base text-zinc-500 dark:text-zinc-400 sm:text-lg">
            Únete a miles de profesionales TI y empresas que ya reclutan mejor con Taskio.
          </p>
          <div className="mt-10 flex flex-col w-full gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Link
              href="/unete"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 dark:bg-emerald-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-500 hover:shadow-2xl hover:-translate-y-0.5 sm:px-10 sm:py-5 sm:text-lg"
            >
              <UserCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/auth/signup/recruiter"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-8 py-4 text-base font-semibold text-zinc-700 dark:text-zinc-200 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 hover:-translate-y-0.5 sm:px-10 sm:py-5 sm:text-lg"
            >
              <Building2 className="h-5 w-5" />
              Demo para empresas
            </Link>
          </div>
          <p className="mt-6 text-sm text-zinc-400 dark:text-zinc-500">
            Candidatos: siempre gratis · Empresas: 14 días de prueba sin tarjeta
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
