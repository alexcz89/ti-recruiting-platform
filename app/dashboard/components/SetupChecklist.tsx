// app/dashboard/components/SetupChecklist.tsx
import Link from "next/link";
import { CheckCircle2, Circle, Mail, Phone, Globe, Building2, ArrowRight } from "lucide-react";
import { resendVerificationAction } from "./actions";

type RecruiterStatus = "PENDING" | "APPROVED" | "REJECTED";

type Props = {
  user?: {
    name?: string | null;
    emailVerified?: Date | null;
  } | null;
  profile?: {
    status: RecruiterStatus;
    phone?: string | null;
  } | null;
  company?: {
    id: string;
    name: string;
    size?: string | null;
    website?: string | null;
  } | null;
  compact?: boolean;
};

export default function SetupChecklist({
  user,
  profile,
  company,
  compact = false,
}: Props) {
  const emailVerifiedOk = Boolean(user?.emailVerified);
  const phoneOk = Boolean(profile?.phone && profile.phone.trim().length >= 6);
  const websiteOk = Boolean(company?.website && company.website.trim().length >= 4);
  const sizeOk = Boolean(company?.size && company.size.trim().length > 0);

  const tasks: {
    key: string;
    label: string;
    ok: boolean;
    href?: string;
    hint?: string;
    icon: React.ReactNode;
    action?: React.ReactNode;
  }[] = [
    {
      key: "verifyEmail",
      label: "Verificar tu correo",
      ok: emailVerifiedOk,
      hint: "Asegura tu cuenta y habilita funciones clave.",
      icon: <Mail className="h-4 w-4" />,
      action: !emailVerifiedOk ? (
        <form action={resendVerificationAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Reenviar verificación
          </button>
        </form>
      ) : undefined,
    },
    {
      key: "phone",
      label: "Agregar teléfono de contacto",
      ok: phoneOk,
      href: "/dashboard/profile",
      hint: "Para que candidatos o colegas te ubiquen fácilmente.",
      icon: <Phone className="h-4 w-4" />,
    },
    {
      key: "website",
      label: "Agregar sitio web de la empresa",
      ok: websiteOk,
      href: "/dashboard/profile",
      hint: "Da confianza mostrando el dominio corporativo.",
      icon: <Globe className="h-4 w-4" />,
    },
    {
      key: "size",
      label: "Elegir tamaño de la empresa",
      ok: sizeOk,
      href: "/dashboard/company",
      hint: "Ayuda a clasificar tus vacantes y reportes.",
      icon: <Building2 className="h-4 w-4" />,
    },
  ];

  const total = tasks.length;
  const done = tasks.filter((t) => t.ok).length;
  const pct = Math.round((done / total) * 100);

  if (done === total) return null;

  return (
    <section
      aria-labelledby="setup-checklist-title"
      className={[
        "overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90",
        compact ? "p-4" : "p-4 sm:p-5 lg:p-6",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300">
            Configuración inicial
          </div>

          <h2
            id="setup-checklist-title"
            className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-xl"
          >
            Bienvenido{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h2>

          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Completa estos pasos para dejar listo tu panel y mejorar la confianza de candidatos.
          </p>
        </div>

        <Link
          href="/dashboard/profile"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Completar perfil
        </Link>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Progreso</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {done}/{total} · {pct}%
          </span>
        </div>

        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de configuración"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="mt-5 grid gap-3">
        {tasks.map((task) => {
          const content = (
            <div
              className={[
                "group flex w-full items-start gap-3 rounded-2xl border p-3 sm:p-4 transition",
                task.ok
                  ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-900/15"
                  : "border-zinc-200 bg-zinc-50/70 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
              ].join(" ")}
            >
              <div
                className={[
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  task.ok
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-white text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300",
                ].join(" ")}
              >
                {task.ok ? <CheckCircle2 className="h-5 w-5" /> : task.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {task.label}
                    </p>
                    {task.hint ? (
                      <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                        {task.hint}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    {task.ok ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Completado
                      </span>
                    ) : task.action ? (
                      task.action
                    ) : task.href ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Completar
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );

          return (
            <li key={task.key}>
              {task.ok || !task.href || task.action ? (
                content
              ) : (
                <Link href={task.href} className="block">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}