import Link from "next/link";
import { resendVerificationEmailAction } from "./actions/profile";

type RecruiterStatus = "PENDING" | "APPROVED" | "REJECTED";

type Props = {
  user?: {
    name?: string | null;
    emailVerified?: Date | null;
  } | null;
  profile?: {
    status: RecruiterStatus;
    phone?: string | null;
    website?: string | null;
  } | null;
  company?: {
    id: string;
    name: string;
    size?: string | null;
  } | null;
  compact?: boolean;
};

export default function SetupChecklist({ user, profile, company, compact = false }: Props) {
  const emailVerifiedOk = Boolean(user?.emailVerified);
  const phoneOk = Boolean(profile?.phone && profile.phone.trim().length >= 6);
  const websiteOk = Boolean(profile?.website && profile.website.trim().length >= 4);
  const sizeOk = Boolean(company?.size && company.size.trim().length > 0);

  const tasks: {
    key: string;
    label: string;
    ok: boolean;
    href?: string;
    hint?: string;
    action?: React.ReactNode;
  }[] = [
    {
      key: "verifyEmail",
      label: "Verificar tu correo",
      ok: emailVerifiedOk,
      hint: "Asegura tu cuenta y habilita funciones clave.",
      action: !emailVerifiedOk ? (
        <form action={resendVerificationEmailAction}>
          <button
            type="submit"
            className="
              btn-ghost h-8 px-3 text-xs
              hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70
            "
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
    },
    {
      key: "website",
      label: "Agregar sitio web de la empresa",
      ok: websiteOk,
      href: "/dashboard/profile",
      hint: "Da confianza mostrando el dominio corporativo.",
    },
    {
      key: "size",
      label: "Elegir tamaño de la empresa",
      ok: sizeOk,
      href: "/dashboard/company",
      hint: "Ayuda a clasificar tus vacantes y reportes.",
    },
  ];

  const total = tasks.length;
  const done = tasks.filter((t) => t.ok).length;
  const pct = Math.round((done / total) * 100);

  if (done === total) return null;

  return (
    <section
      className={`
        glass-card rounded-2xl border
        ${compact ? "p-4" : "p-5 md:p-6"}
      `}
      aria-labelledby="setup-checklist-title"
    >
      {/* Header checklist */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="setup-checklist-title" className="text-lg font-semibold text-default">
            Bienvenido{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h2>
          <p className="mt-1 text-sm text-muted">
            Antes de publicar tu primera vacante, completa estos pasos rápidos.
          </p>
        </div>

        <Link href="/dashboard/profile" className="btn-ghost h-8 px-3 text-sm">
          Completar perfil
        </Link>
      </div>

      {/* Barra de progreso */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Progreso</span>
          <span className="font-medium text-default">{pct}%</span>
        </div>
        <div
          className="
            mt-2 h-2 w-full rounded-full
            bg-zinc-200 dark:bg-zinc-800
          "
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de configuración"
        >
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lista de tareas */}
      <ul className="mt-4 space-y-2">
        {tasks.map((t) => {
          const base =
            "flex items-start justify-between gap-3 rounded-xl border px-3 py-2";
          const okCls =
            "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-200";
          const pendingCls =
            "bg-white/60 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800";

          return (
            <li key={t.key} className={`${base} ${t.ok ? okCls : pendingCls}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]
                      ${t.ok ? "bg-emerald-500 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-100"}
                    `}
                    aria-hidden
                  >
                    {t.ok ? "✓" : "•"}
                  </span>
                  <p className="font-medium text-default">{t.label}</p>
                </div>
                {t.hint && <p className="mt-1 pl-7 text-xs text-muted">{t.hint}</p>}
              </div>

              {!t.ok &&
                (t.action ? (
                  t.action
                ) : t.href ? (
                  <Link href={t.href} className="btn-ghost h-8 px-3 text-xs">
                    Completar
                  </Link>
                ) : null)}
            </li>
          );
        })}
      </ul>

      {/* Estado de aprobación */}
      {profile?.status && (
        <p className="mt-4 text-xs text-muted">
          Estado de tu perfil:{" "}
          <span
            className={
              profile.status === "APPROVED"
                ? "text-emerald-600 dark:text-emerald-300"
                : profile.status === "REJECTED"
                ? "text-red-600 dark:text-red-300"
                : "text-amber-600 dark:text-amber-300"
            }
          >
            {profile.status === "PENDING" ? "Pendiente" : profile.status}
          </span>
        </p>
      )}
    </section>
  );
}
