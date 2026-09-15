import Footer from "@/components/Footer";
import ContactForm from "./ContactForm";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <>
      <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <section className="border-b border-zinc-200 bg-[radial-gradient(circle_at_top_left,_#e2e8f0_0,_transparent_52%)] dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_#1f2937_0,_transparent_52%)]">
          <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-600 dark:text-zinc-400">
                Demo para empresas
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Solicita una demo de TaskIO
              </h1>
              <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                Cuéntanos un poco sobre tu proceso de contratación y te contactamos para mostrarte cómo TaskIO puede ayudarte a evaluar talento técnico.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <h2 className="text-xl font-semibold">Conoce la plataforma</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                <li className="flex gap-2"><span className="font-semibold text-emerald-600 dark:text-emerald-400" aria-hidden="true">✓</span><span>Evalúa código antes de entrevistar</span></li>
                <li className="flex gap-2"><span className="font-semibold text-emerald-600 dark:text-emerald-400" aria-hidden="true">✓</span><span>Compara candidatos con la misma evidencia</span></li>
                <li className="flex gap-2"><span className="font-semibold text-emerald-600 dark:text-emerald-400" aria-hidden="true">✓</span><span>Reduce tiempo del equipo técnico</span></li>
              </ul>
              <p className="mt-6 text-sm leading-6 text-zinc-500">
                Los campos marcados con * son obligatorios.
              </p>
            </div>
            <ContactForm />
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
