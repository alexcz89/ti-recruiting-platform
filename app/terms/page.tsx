export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Términos y Condiciones
        </h1>

        <p className="mt-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
          Al usar TaskIO aceptas utilizar la plataforma de manera responsable y
          proporcionar información veraz. TaskIO actúa como intermediario para
          conectar candidatos y empresas, y no garantiza contratación.
        </p>

        <ul className="mt-6 list-disc pl-6 text-zinc-700 dark:text-zinc-300 space-y-2">
          <li>El usuario es responsable del contenido de su perfil y CV.</li>
          <li>Las empresas son responsables del contenido y condiciones de sus vacantes.</li>
          <li>Podemos suspender cuentas por uso indebido o fraude.</li>
        </ul>

        <p className="mt-6 text-zinc-700 dark:text-zinc-300">
          Para dudas, contáctanos en{" "}
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