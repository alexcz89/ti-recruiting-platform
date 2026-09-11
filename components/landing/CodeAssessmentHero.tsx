import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CodeAssessmentDemo from "@/components/landing/CodeAssessmentDemo";

export default function CodeAssessmentHero() {
  return (
    <section
      aria-labelledby="landing-hero-title"
      className="landing-assessment-hero border-b border-zinc-200/80 dark:border-white/10"
    >
      <div className="mx-auto flex w-full max-w-[96rem] flex-col justify-center px-4 py-6 sm:px-6 sm:py-8 lg:min-h-[calc(100svh-4rem)] lg:px-8 lg:py-7">
        <CodeAssessmentDemo />

        <div className="mt-6 flex flex-col items-center gap-4 text-center sm:mt-7 lg:mt-6">
          <h1
            id="landing-hero-title"
            className="text-balance font-display text-2xl font-extrabold tracking-[-0.025em] text-[#082B33] dark:text-white sm:text-3xl lg:text-[2rem]"
          >
            Evidencia técnica antes de contratar.
          </h1>
          <div className="flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
            <Link href="/contact" className="landing-button-primary group min-h-12 px-6">
              Solicitar demo
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link href="#como-funciona" className="landing-button-secondary min-h-12 px-6">
              Ver cómo funciona
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
