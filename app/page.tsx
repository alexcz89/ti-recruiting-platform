import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Braces,
  CircleCheck,
  ClipboardCheck,
  Code2,
  Gauge,
  GitCompareArrows,
  ListChecks,
  TimerReset,
  UserRoundCheck,
} from "lucide-react";
import { authOptions } from "@/lib/server/auth";
import LogoTaskio from "@/components/LogoTaskio";
import CodeEditorStory from "@/components/landing/CodeEditorStory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Evalúa talento TI antes de contratarlo | TaskIO",
  description:
    "Valida habilidades técnicas con assessments, coding challenges y resultados claros antes de contratar talento TI.",
};

const problems = [
  "El CV no demuestra habilidad técnica real",
  "Las entrevistas técnicas consumen tiempo del equipo",
  "Comparar candidatos de forma objetiva sigue siendo difícil",
];

const solutions = [
  {
    icon: ClipboardCheck,
    title: "Assessments técnicos",
    description: "Evalúa fundamentos, conocimientos y criterios relevantes para cada rol.",
  },
  {
    icon: Code2,
    title: "Coding challenges",
    description: "Observa cómo una persona resuelve problemas con código ejecutable.",
  },
  {
    icon: GitCompareArrows,
    title: "Resultados comparables",
    description: "Usa la misma referencia para identificar fortalezas y brechas.",
  },
  {
    icon: UserRoundCheck,
    title: "Desempeño real",
    description: "Avanza candidatos con evidencia, no solo con buenas respuestas.",
  },
];

const steps = [
  { title: "Crea la vacante", description: "Define el rol y las habilidades que necesitas validar." },
  { title: "Invita al candidato", description: "Comparte la evaluación desde un solo flujo." },
  { title: "Completa la evaluación", description: "El candidato responde y programa en un entorno claro." },
  { title: "Revisa y decide", description: "Compara resultados, código y señales técnicas." },
];

const benefits = [
  { icon: TimerReset, text: "Reduce tiempo de filtrado" },
  { icon: UserRoundCheck, text: "Mejora la calidad del shortlist" },
  { icon: ListChecks, text: "Compara con criterios consistentes" },
  { icon: Braces, text: "Revisa código antes de avanzar" },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (role === "RECRUITER" || role === "ADMIN") redirect("/dashboard/overview");
  if (role === "CANDIDATE") redirect("/profile/summary");

  return (
    <div className="landing-shell -mx-4 -mb-10 overflow-x-clip text-zinc-950 dark:text-zinc-50 sm:-mx-6 lg:-mx-8">
      <section className="relative border-b border-zinc-200/80 bg-transparent dark:border-white/10">
        <div aria-hidden="true" className="landing-grid absolute inset-0 opacity-60 dark:opacity-25" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-16 xl:py-20">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 sm:mb-6">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="sm:hidden">Evaluación técnica para equipos TI</span>
              <span className="hidden sm:inline">Evaluación técnica para equipos de contratación</span>
            </div>
            <h1 className="max-w-[14ch] text-balance font-display text-[clamp(2.45rem,11vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-[#082B33] dark:text-white lg:text-[clamp(3.5rem,5.3vw,4.75rem)] lg:leading-[0.98]">
              Evalúa talento TI antes de contratarlo
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:mt-6 sm:text-lg sm:leading-8">
              Evalúa habilidades técnicas con assessments y coding challenges antes de avanzar a un candidato.
            </p>
            <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row sm:mt-8">
              <Link href="/contact" className="landing-button-primary group min-h-12 px-6">
                Solicitar demo
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link href="#como-funciona" className="landing-button-secondary min-h-12 px-6">
                Ver cómo funciona
              </Link>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Diseñado para recruiters, líderes técnicos y equipos de talento.
            </p>
          </div>

          <CodeEditorStory />
        </div>
      </section>

      <section id="problema" className="landing-problem scroll-mt-20 py-14 text-white sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-end lg:gap-20 lg:px-8">
          <div>
            <p className="font-mono text-sm text-emerald-300">La brecha de señal</p>
            <h2 className="mt-4 max-w-xl text-balance font-display text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-4xl lg:text-5xl">
              Contratar talento TI sin evidencia es arriesgado
            </h2>
          </div>
          <ul className="divide-y divide-white/15 border-y border-white/15">
            {problems.map((problem, index) => (
              <li key={problem} className="flex gap-4 py-5 sm:items-center">
                <span className="font-mono text-sm text-emerald-300">0{index + 1}</span>
                <span className="text-base leading-7 text-teal-50 sm:text-lg">{problem}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="solucion" className="scroll-mt-20 py-14 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-bold tracking-[-0.025em] text-[#082B33] dark:text-white sm:text-4xl lg:text-5xl">
              Decisiones técnicas con evidencia
            </h2>
            <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg">
              Una lectura clara de lo que cada candidato sabe hacer, antes de invertir horas del equipo técnico.
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/15 dark:bg-white/15">
            {solutions.map(({ icon: Icon, title, description }) => (
              <article key={title} className="landing-solution-card p-5 sm:p-7">
                <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                <h3 className="mt-6 text-lg font-extrabold text-zinc-950 dark:text-white sm:mt-7">{title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="landing-muted-section scroll-mt-20 border-y border-zinc-200 py-14 dark:border-white/10 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-balance font-display text-3xl font-bold tracking-[-0.025em] text-[#082B33] dark:text-white sm:text-4xl lg:text-5xl">
                De la vacante a la decisión
              </h2>
              <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg">
                Un flujo simple para que la evaluación acompañe al proceso, sin frenarlo.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
              <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Evidencia lista para revisar
            </div>
          </div>

          <ol className="relative mt-10 grid gap-3 sm:mt-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {steps.map((step, index) => (
              <li key={step.title} className="landing-step relative flex gap-4 rounded-xl p-4 ring-1 ring-zinc-200 md:block sm:p-5 lg:rounded-none lg:bg-transparent lg:p-0 lg:pr-7 lg:ring-0 dark:ring-white/15 lg:dark:bg-transparent">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#082B33] font-mono text-sm font-semibold text-white ring-4 ring-zinc-50 dark:bg-emerald-500 dark:text-[#082B33] dark:ring-zinc-900">
                  {index + 1}
                </div>
                {index < steps.length - 1 && <div aria-hidden="true" className="absolute left-10 right-0 top-5 hidden h-px bg-zinc-400 lg:block dark:bg-zinc-600" />}
                <div className="md:mt-5">
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="beneficios" className="scroll-mt-20 py-14 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20 lg:px-8">
          <div>
            <h2 className="text-balance font-display text-3xl font-bold tracking-[-0.025em] text-[#082B33] dark:text-white sm:text-4xl lg:text-5xl">
              Menos intuición. Más evidencia.
            </h2>
            <p className="mt-4 max-w-lg text-pretty text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg">
              Convierte señales técnicas dispersas en una decisión que recruiting y engineering pueden defender.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {benefits.map(({ icon: Icon, text }) => (
                <li key={text} className="flex min-h-12 items-center gap-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 sm:text-base">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-2xl bg-[#0b1f24] text-white shadow-[0_8px_0_#10B981]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
              <div>
                <p className="text-sm font-semibold">Reporte técnico</p>
                <p className="text-xs text-teal-200/70">Python Developer · Juan Pérez</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">Recomendado</span>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-7">
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-emerald-400/20 border-t-emerald-400 font-display text-3xl font-bold">87</div>
              <div className="space-y-4">
                {[["Resolución técnica", "92%"], ["Calidad de código", "86%"], ["Casos de prueba", "83%"]].map(([label, value]) => (
                  <div key={label}>
                    <div className="mb-1.5 flex justify-between text-xs text-teal-50"><span>{label}</span><span className="font-mono">{value}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: value }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-white/10 text-sm">
              <div className="border-r border-white/10 p-4 sm:px-6"><p className="text-xs text-teal-200/70">Tests aprobados</p><p className="mt-1 font-mono font-semibold">18 / 20</p></div>
              <div className="p-4 sm:px-6"><p className="text-xs text-teal-200/70">Tiempo</p><p className="mt-1 font-mono font-semibold">43 min</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <div className="landing-cta-panel mx-auto max-w-5xl overflow-hidden rounded-2xl px-5 py-9 text-center sm:px-10 sm:py-11 lg:py-12">
          <h2 className="mx-auto max-w-3xl text-balance font-display text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl lg:text-[2.75rem]">Evalúa a tu próximo candidato con TaskIO</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-[#073d36] sm:text-lg">Prueba el flujo completo antes de tomar tu próxima decisión de contratación.</p>
          <Link href="/contact" className="landing-button-inverse mt-7 min-h-12 px-6">
            Solicitar demo <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="landing-muted-section border-t border-zinc-200 py-10 dark:border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <LogoTaskio />
            <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">Evaluación técnica clara para contratar talento TI con mayor confianza.</p>
          </div>
          <nav aria-label="Enlaces del pie de página" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
            <Link href="/jobs" className="text-zinc-700 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-300">Vacantes</Link>
            <Link href="/privacy" className="text-zinc-700 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-300">Privacidad</Link>
            <Link href="/terms" className="text-zinc-700 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-300">Términos</Link>
            <Link href="/contact" className="text-zinc-700 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-300">Contacto</Link>
          </nav>
          <p className="text-sm text-zinc-500">© {new Date().getFullYear()} TaskIO</p>
        </div>
      </footer>
    </div>
  );
}
