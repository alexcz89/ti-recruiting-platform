import Link from "next/link";
import { ArrowRight, CalendarClock, Code2, Trophy } from "lucide-react";

const languages = ["Python", "JavaScript", "TypeScript", "Java"];

export default function ContestPromo() {
  return (
    <section
      aria-labelledby="contest-promo-title"
      className="relative isolate overflow-hidden bg-[#061f25] text-white"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_62%)]"
      />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-8 lg:py-12">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-emerald-300">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/12 px-3 py-1.5 ring-1 ring-inset ring-emerald-300/25">
              <Code2 className="h-4 w-4" aria-hidden="true" />
              Primer concurso TaskIO
            </span>
            <span className="inline-flex items-center gap-1.5 text-teal-100/80">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Inscripciones hasta el 30 de septiembre
            </span>
          </div>

          <h2
            id="contest-promo-title"
            className="mt-5 max-w-xl text-3xl font-black leading-tight tracking-[-0.03em] text-white [text-wrap:balance] sm:text-4xl"
          >
            Tu código puede llevarte al Top 10.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-teal-100/80 [text-wrap:pretty]">
            Resuelve un reto real de recruiting en 60 minutos, compite por
            <strong className="font-bold text-white"> $9,000 MXN en premios</strong> y demuestra tu talento ante empresas de tecnología.
          </p>

          <ul aria-label="Lenguajes disponibles" className="mt-5 flex flex-wrap gap-2">
            {languages.map((language) => (
              <li key={language} className="rounded-md bg-white/8 px-2.5 py-1 text-xs font-semibold text-teal-50 ring-1 ring-inset ring-white/10">
                {language}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
          <div className="flex items-center gap-3 px-1 sm:min-w-44">
            <Trophy className="h-9 w-9 text-amber-300" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-teal-100/70">Bolsa de premios</p>
              <p className="text-xl font-black text-white">$9,000 MXN</p>
            </div>
          </div>
          <Link
            href="/concursos/taskio-coding-challenge-2026#registro"
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-[#061f25] transition duration-200 hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 active:translate-y-px"
          >
            Asegurar mi lugar
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link
            href="/concursos/taskio-coding-challenge-2026"
            className="text-center text-sm font-semibold text-teal-100 underline decoration-teal-400/60 underline-offset-4 transition hover:text-white"
          >
            Ver reto, reglas y ranking
          </Link>
        </div>
      </div>
    </section>
  );
}