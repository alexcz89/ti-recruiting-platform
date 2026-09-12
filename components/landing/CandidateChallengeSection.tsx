import CodeAssessmentDemo from "@/components/landing/CodeAssessmentDemo";

export default function CandidateChallengeSection() {
  return (
    <section
      id="experiencia-candidato"
      aria-labelledby="candidate-challenge-title"
      className="landing-muted-section scroll-mt-20 border-b border-zinc-200 py-14 dark:border-white/10 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
        <div className="mb-9 max-w-3xl sm:mb-11">
          <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Experiencia del candidato
          </p>
          <h2
            id="candidate-challenge-title"
            className="mt-3 text-balance font-display text-3xl font-bold tracking-[-0.025em] text-[#082B33] dark:text-white sm:text-4xl lg:text-5xl"
          >
            Así vive un candidato la evaluación
          </h2>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg">
            Un problema claro, un entorno familiar para programar y resultados objetivos al terminar.
          </p>
        </div>

        <CodeAssessmentDemo />
      </div>
    </section>
  );
}
