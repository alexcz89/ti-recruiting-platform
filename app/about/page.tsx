export const dynamic = "force-dynamic";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Acerca de TaskIO
        </h1>

        <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
          TaskIO es una plataforma enfocada en reclutamiento tech en México.
          Ayudamos a candidatos a crear un perfil profesional y conectar con
          vacantes reales, y a empresas a gestionar procesos de selección de
          manera más ágil.
        </p>

        <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
          Estamos construyendo la comunidad paso a paso, priorizando calidad de
          vacantes, experiencia del candidato y herramientas prácticas para
          reclutadores.
        </p>
      </div>
    </main>
  );
}