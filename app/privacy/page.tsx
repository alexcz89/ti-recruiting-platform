export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Aviso de Privacidad
        </h1>

        <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
          En TaskIO utilizamos tu información para operar la plataforma, crear tu
          perfil, postularte a vacantes y facilitar la comunicación entre
          candidatos y reclutadores.
        </p>

        <ul className="mt-6 list-disc pl-6 text-zinc-700 dark:text-zinc-300 space-y-2">
          <li>Solo solicitamos datos necesarios para el servicio.</li>
          <li>No vendemos tu información personal a terceros.</li>
          <li>Puedes solicitar actualización o eliminación de tu cuenta.</li>
        </ul>

        <p className="mt-6 text-zinc-700 dark:text-zinc-300">
          Para cualquier solicitud, contáctanos en{" "}
          <a
            className="text-emerald-700 dark:text-emerald-400 hover:underline"
            href="mailto:alejandro@taskio.com.mx"
          >
            alejandro@taskio.com.mx
          </a>
          .
        </p>

        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          Última actualización: {new Date().toLocaleDateString("es-MX")}
        </p>
      </div>
    </main>
  );
}