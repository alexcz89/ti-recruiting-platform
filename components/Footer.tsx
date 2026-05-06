// components/Footer.tsx
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              TaskIO
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Conectando talento TI con oportunidades en México
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/about" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Acerca de</Link>
            <Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Contacto</Link>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Privacidad</Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Términos</Link>
            <Link href="/unete" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
              Únete gratis →
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-100 dark:border-zinc-800 pt-6 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            © {year} TaskIO. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}