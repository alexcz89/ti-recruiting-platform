// app/dashboard/billing/taxdata/page.tsx
import { redirect } from "next/navigation";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import TaxDataForm from "./TaxDataForm";

export default async function TaxDataPage() {
  const companyId = await getSessionCompanyId().catch(() => null);

  if (!companyId) {
    redirect("/auth/signin");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId! },
    select: {
      name: true,
      taxLegalName: true,
      taxRfc: true,
      taxRegime: true,
      taxZip: true,
      taxAddressLine1: true,
      taxAddressLine2: true,
      taxEmail: true,
      cfdiUseDefault: true,
      taxDataCompleted: true,
    },
  });

  if (!company) {
    redirect("/auth/signin");
  }

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[800px] px-6 lg:px-10 py-4 space-y-6">
        {/* Header */}
        <header className="rounded-2xl border glass-card p-4 md:p-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
              Datos fiscales
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight text-default">
                Datos fiscales de la empresa
              </h1>
              <p className="mt-1 text-sm text-muted">
                Captura la información fiscal que se usará para emitir tus CFDI
                (facturas) a través del sistema.
              </p>
            </div>
            <div className="text-xs text-muted">
              <span className="font-medium text-default">
                {company.name ?? "Tu empresa"}
              </span>
              {company.taxDataCompleted ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                  Datos completos
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Información pendiente
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Formulario */}
        <section className="rounded-2xl border glass-card p-4 md:p-6">
          <TaxDataForm
            initial={{
              taxLegalName: company.taxLegalName ?? "",
              taxRfc: company.taxRfc ?? "",
              taxRegime: company.taxRegime ?? "",
              taxZip: company.taxZip ?? "",
              taxAddressLine1: company.taxAddressLine1 ?? "",
              taxAddressLine2: company.taxAddressLine2 ?? "",
              taxEmail: company.taxEmail ?? "",
              cfdiUseDefault: company.cfdiUseDefault ?? "",
            }}
          />
        </section>
      </div>
    </main>
  );
}
