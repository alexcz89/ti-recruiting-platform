// app/auth/verify/check-email/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Verifica tu correo | Bolsa TI",
};

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-lg py-16 px-6">
      <div className="rounded-2xl border glass-card p-4 md:p-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          ✉️
        </div>
        <h1 className="text-center text-2xl font-semibold">
          Revisa tu correo
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Te enviamos un enlace de verificación. Ábrelo para activar tu cuenta.
        </p>

        <div className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>• Si no lo ves, revisa tu carpeta de <b>Spam</b> o <b>Promociones</b>.</p>
          <p>• El enlace expira en ~60 minutos.</p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="rounded-xl border border-zinc-200 glass-card p-4 md:p-6"
          >
            Volver al inicio
          </Link>
          <Link
            href="/auth/signin"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Ir a iniciar sesión
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          ¿No llegó el correo? Espera 1–2 minutos y vuelve a intentar registrarte.
        </p>
      </div>
    </div>
  );
}
