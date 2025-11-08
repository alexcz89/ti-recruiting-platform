// app/dashboard/profile/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import ProfileForm from "./ProfileForm";
import CompanyInlineForm from "./CompanyInlineForm";

export default async function RecruiterProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const companyId = (session?.user as any)?.companyId as string | undefined;

  if (!userId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[900px] px-6 lg:px-10 py-10">
          <EmptyState
            title="No has iniciado sesión"
            body="Inicia sesión para editar tu perfil."
            ctaHref="/auth/signin?role=RECRUITER"
            ctaLabel="Ir a iniciar sesión"
          />
        </div>
      </main>
    );
  }

  const [user, profile, company] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    prisma.recruiterProfile.findUnique({
      where: { userId },
      select: { phone: true, website: true, status: true, updatedAt: true },
    }),
    companyId
      ? prisma.company.findUnique({
          where: { id: companyId },
          // 👇 añadimos logoUrl para el uploader
          select: { name: true, size: true, logoUrl: true },
        })
      : Promise.resolve(null),
  ]);

  const phoneOk = Boolean(profile?.phone && profile.phone.trim().length >= 6);
  const sizeOk = Boolean(company?.size && company.size.length > 0);
  const needsBanner = !phoneOk || !sizeOk;
  const done = [phoneOk, sizeOk].filter(Boolean).length;
  const pct = Math.round((done / 2) * 100);

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10 py-10 space-y-6">
        <header className="rounded-2xl border glass-card p-4 md:p-6">
          <h1 className="text-2xl font-bold leading-tight">Mi perfil</h1>
          <p className="text-sm text-zinc-600">
            Actualiza tus datos de contacto y la información básica de tu empresa.
          </p>
        </header>

        {/* ✅ Mini-checklist */}
        {needsBanner && (
          <section className="rounded-2xl border bg-amber-50 border-amber-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-amber-900">Completa tu configuración</p>
                <p className="text-xs text-amber-800">
                  Falta: {!phoneOk ? "Teléfono de contacto" : ""}
                  {!phoneOk && !sizeOk ? " y " : ""}
                  {!sizeOk ? "Tamaño de la empresa" : ""}
                </p>
              </div>
              <div className="text-sm font-semibold text-amber-900">{pct}%</div>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-amber-100 overflow-hidden">
              <div className="h-2 bg-amber-400" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex gap-2">
              {!phoneOk && (
                <a href="#contact" className="text-xs rounded-md border px-2 py-1 hover:bg-amber-100">
                  Ir a contacto
                </a>
              )}
              {!sizeOk && (
                <a href="#company" className="text-xs rounded-md border px-2 py-1 hover:bg-amber-100">
                  Elegir tamaño
                </a>
              )}
            </div>
          </section>
        )}

        {/* Tarjeta de vista rápida */}
        <section className="rounded-2xl border glass-card p-4 md:p-6">
          <h2 className="font-semibold">Tu cuenta</h2>
          <p className="mt-1 text-sm text-zinc-600">
            <span className="font-medium">{user?.name ?? "—"}</span> · {user?.email ?? "—"}
          </p>
          {profile?.status && (
            <p className="mt-1 text-xs">
              Estado:{" "}
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
              {profile?.updatedAt && (
                <span className="text-zinc-500">
                  {" "}
                  · actualizado {new Date(profile.updatedAt).toLocaleDateString()}
                </span>
              )}
            </p>
          )}
        </section>

        {/* Formulario de contacto (toasts) */}
        <section id="contact" className="rounded-2xl border glass-card p-4 md:p-6">
          <h2 className="font-semibold">Datos de contacto</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Estos datos ayudan a que te ubiquen y te contacten más rápido.
          </p>

          <div className="mt-4">
            <ProfileForm
              initial={{
                phone: profile?.phone ?? "",
                website: profile?.website ?? "",
              }}
            />
          </div>
        </section>

        {/* Mi empresa inline (nombre + tamaño + logo, con toasts) */}
        <section id="company" className="rounded-2xl border glass-card p-4 md:p-6">
          <h2 className="font-semibold">Mi empresa</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Empresa actual: <span className="font-medium">{company?.name ?? "—"}</span>
          </p>

          <div className="mt-4">
            <CompanyInlineForm
              initial={{
                name: company?.name ?? "",
                size: company?.size ?? null,
                logoUrl: company?.logoUrl ?? null, // 👈 pasamos el logo al formulario
              }}
            />
          </div>

          <div className="mt-4">
            <Link
              href="/dashboard/overview"
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Regresar al overview
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center glass-card p-4 md:p-6">
      <p className="text-base font-medium text-zinc-800">{title}</p>
      {body && <p className="mt-1 text-sm text-zinc-600">{body}</p>}
      {ctaHref && ctaLabel && (
        <div className="mt-4">
          <Link href={ctaHref} className="text-sm border rounded px-3 py-1 hover:bg-gray-50">
            {ctaLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
