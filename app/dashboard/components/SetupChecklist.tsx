// app/dashboard/components/SetupChecklist.tsx
import Link from "next/link";
import { resendVerificationEmailAction } from "./actions/profile";

type RecruiterStatus = "PENDING" | "APPROVED" | "REJECTED";

type Props = {
  user?: {
    name?: string | null;
    emailVerified?: Date | null; // 👈 NUEVO: para mostrar tarea de verificación
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

  // Tareas en orden recomendado: primero verificación de correo
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
      // Si NO está verificado, mostramos un botón para reenviar
      action: !emailVerifiedOk ? (
        <form action={resendVerificationEmailAction}>
          <button
            type="submit"
            className="shrink-0 rounded-md border px-2.5 py-1 text-xs hover:bg-gray-50"
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
      className={[
        "rounded-2xl border glass-card p-4 md:p-6",
        compact ? "p-4" : "p-6",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            Bienvenido{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Antes de publicar tu primera vacante, completa estos pasos rápidos.
          </p>
        </div>

        <Link
          href="/dashboard/profile"
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Completar perfil
        </Link>
      </div>

      {/* Barra de progreso */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-600">Progreso</span>
          <span className="font-medium">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden badge ">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lista de tareas */}
      <ul className="mt-4 space-y-2">
        {tasks.map((t) => (
          <li
            key={t.key}
            className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${
              t.ok ? "bg-emerald-50 border-emerald-200" : "glass-card p-4 md:p-6"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    t.ok ? "bg-emerald-500 text-white" : "glass-card p-4 md:p-6"
                  }`}
                  aria-hidden
                >
                  {t.ok ? "✓" : "•"}
                </span>
                <p className="font-medium">{t.label}</p>
              </div>
              {t.hint && <p className="mt-1 pl-7 text-xs text-zinc-600">{t.hint}</p>}
            </div>

            {!t.ok && (t.action ? (
              t.action
            ) : t.href ? (
              <Link
                href={t.href}
                className="shrink-0 rounded-md border px-2.5 py-1 text-xs hover:bg-gray-50"
              >
                Completar
              </Link>
            ) : null)}
          </li>
        ))}
      </ul>

      {/* Estado de aprobación (informativo) */}
      {profile?.status && (
        <p className="mt-4 text-xs text-zinc-500">
          Estado de tu perfil:{" "}
          <span
            className={
              profile.status === "APPROVED"
                ? "text-emerald-600"
                : profile.status === "REJECTED"
                ? "text-red-600"
                : "text-amber-600"
            }
          >
            {profile.status === "PENDING" ? "Pendiente" : profile.status}
          </span>
        </p>
      )}
    </section>
  );
}
