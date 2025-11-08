// app/dashboard/company/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import Link from "next/link";
import CompanyForm from "./CompanyForm";

export default async function CompanyPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const companyId = await getSessionCompanyId().catch(() => null);

  if (!companyId) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[900px] px-6 lg:px-10 py-10">
          <EmptyState
            title="Sin empresa asociada"
            body="No hay empresa vinculada a tu sesión."
            ctaHref="/"
            ctaLabel="Volver al inicio"
          />
        </div>
      </main>
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, size: true },
  });

  const saved = searchParams?.saved === "1";

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10 py-10 space-y-6">
        <header className="rounded-2xl border glass-card p-4 md:p-6">
          <h1 className="text-2xl font-bold leading-tight">Configuración de la empresa</h1>
          <p className="text-sm text-zinc-600">
            Define información básica para clasificar tus vacantes y reportes.
          </p>
        </header>

        {saved && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Cambios guardados correctamente.
          </div>
        )}

        <section className="rounded-2xl border glass-card p-4 md:p-6">
          <h2 className="font-semibold">Datos básicos</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Empresa actual: <span className="font-medium">{company?.name ?? "—"}</span>
          </p>

          <div className="mt-4">
            <CompanyForm
              initial={{
                id: company!.id,
                name: company?.name ?? "",
                size: company?.size ?? null,
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

/* =============== UI helpers mínimos =============== */
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
