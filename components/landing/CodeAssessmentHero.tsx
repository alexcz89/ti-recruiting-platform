import Link from "next/link";
import { ArrowDown } from "lucide-react";
import TaskioCodeEditor from "@/components/landing/TaskioCodeEditor";

export default function CodeAssessmentHero() {
  return (
    <section
      aria-labelledby="landing-hero-title"
      className="landing-assessment-hero border-b border-zinc-200/80 dark:border-white/10"
    >
      <div className="mx-auto flex w-full max-w-[96rem] flex-col justify-center px-4 py-6 sm:px-6 sm:py-8 lg:min-h-[calc(100svh-4rem)] lg:px-8 lg:py-9">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Technical recruiting, con evidencia
            </p>
            <h1
              id="landing-hero-title"
              className="mt-2 text-balance font-display text-2xl font-extrabold tracking-[-0.025em] text-[#082B33] dark:text-white sm:text-3xl lg:text-[2rem]"
            >
              Evalúa código antes de contratar
            </h1>
          </div>
          <Link
            href="#experiencia-candidato"
            className="group inline-flex min-h-11 w-fit items-center gap-2 text-sm font-bold text-[#082B33] underline-offset-4 hover:text-emerald-700 hover:underline dark:text-teal-50 dark:hover:text-emerald-300"
          >
            Ver cómo funciona
            <ArrowDown
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        <TaskioCodeEditor />
      </div>
    </section>
  );
}
