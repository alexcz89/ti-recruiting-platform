// app/dashboard/invoices/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import { InvoiceStatus } from "@prisma/client";
import IssueInvoiceButton from "./IssueInvoiceButton";

const nfCurrency = (amount: number, currency: string | null | undefined) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "MXN",
    maximumFractionDigits: 2,
  }).format(amount);

const formatDateTime = (value: Date | null) =>
  value
    ? new Date(value).toLocaleString("es-MX", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function statusLabel(status: InvoiceStatus) {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "ISSUED":
      return "Timbrada";
    case "CANCELED":
      return "Cancelada";
    case "ERROR":
      return "Error";
    default:
      return status;
  }
}

function statusClasses(status: InvoiceStatus) {
  switch (status) {
    case "PENDING":
      return "bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:text-amber-300";
    case "ISSUED":
      return "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 dark:text-emerald-300";
    case "CANCELED":
      return "bg-zinc-500/10 text-zinc-600 border border-zinc-400/40 dark:text-zinc-300";
    case "ERROR":
      return "bg-rose-500/10 text-rose-700 border border-rose-500/30 dark:text-rose-300";
    default:
      return "bg-zinc-500/10 text-zinc-700 border border-zinc-400/30 dark:text-zinc-200";
  }
}

export default async function InvoicesPage() {
  const companyId = await getSessionCompanyId().catch(() => null);

  if (!companyId) {
    redirect("/auth/signin");
  }

  const [company, invoices] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId! },
      select: { name: true },
    }),
    prisma.invoice.findMany({
      where: { companyId: companyId! },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        customerName: true,
        customerRfc: true,
        customerEmail: true,
        subtotal: true,
        tax: true,
        total: true,
        currency: true,
        status: true,
        uuid: true,
        series: true,
        folio: true,
        pdfUrl: true,
        xmlUrl: true,
        createdAt: true,
        issuedAt: true,
      },
    }),
  ]);

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1600px] 2xl:max-w-[1800px] px-6 lg:px-10 py-4 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border glass-card p-4 md:p-6">
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-default">
              Facturas
            </h1>
            <p className="mt-1 text-sm text-muted max-w-xl">
              Historial de CFDI emitidos y pendientes para{" "}
              <span className="font-medium text-default">
                {company?.name ?? "tu empresa"}
              </span>
              . Aquí podrás timbrar, cancelar y descargar XML/PDF usando tu
              cuenta de factura.com.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
              Integrado con factura.com (sandbox)
            </span>
          </div>
        </header>

        {/* Tabla de facturas */}
        <section className="rounded-2xl border glass-card p-4 md:p-6">
          {invoices.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-base font-medium text-default">
                Aún no tienes facturas registradas.
              </p>
              <p className="mt-1 text-sm text-muted max-w-md mx-auto">
                Cuando generes cargos por cambio de plan o emitas CFDI desde la
                plataforma, aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl soft-panel p-0 border-0">
              <table className="w-full min-w-[1040px] text-sm align-middle">
                <thead className="text-left">
                  <tr className="text-xs text-muted border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      Serie / Folio
                    </th>
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      Cliente
                    </th>
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      RFC
                    </th>
                    <th className="py-2.5 px-3.5 font-medium text-right whitespace-nowrap">
                      Total
                    </th>
                    <th className="py-2.5 px-3.5 font-medium text-center whitespace-nowrap">
                      Estado
                    </th>
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      UUID
                    </th>
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      Creada
                    </th>
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      Timbrada
                    </th>
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      Archivos
                    </th>
                    <th className="py-2.5 px-3.5 font-medium text-right whitespace-nowrap">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {invoices.map((inv, idx) => {
                    const showIssueButton =
                      inv.status === "PENDING" || inv.status === "ERROR";

                    return (
                      <tr
                        key={inv.id}
                        className={`transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                          idx % 2 === 1
                            ? "bg-zinc-50/50 dark:bg-zinc-900/30"
                            : ""
                        }`}
                      >
                        <td className="py-2.5 px-3.5 text-default whitespace-nowrap">
                          {inv.series || "-"}
                          {inv.folio ? `-${inv.folio}` : ""}
                        </td>

                        <td className="py-2.5 px-3.5 text-default">
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[220px]">
                              {inv.customerName}
                            </span>
                            {inv.customerEmail && (
                              <span className="text-xs text-muted truncate max-w-[220px]">
                                {inv.customerEmail}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3.5 text-default whitespace-nowrap">
                          {inv.customerRfc}
                        </td>

                        <td className="py-2.5 px-3.5 text-default whitespace-nowrap text-right">
                          {nfCurrency(
                            Number(inv.total),
                            inv.currency || "MXN"
                          )}
                        </td>

                        <td className="py-2.5 px-3.5 text-center">
                          <span
                            className={
                              "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-medium " +
                              statusClasses(inv.status)
                            }
                          >
                            {statusLabel(inv.status)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3.5 text-xs text-default max-w-[220px] truncate">
                          {inv.uuid || "—"}
                        </td>

                        <td className="py-2.5 px-3.5 text-xs text-default whitespace-nowrap">
                          {formatDateTime(inv.createdAt)}
                        </td>

                        <td className="py-2.5 px-3.5 text-xs text-default whitespace-nowrap">
                          {formatDateTime(inv.issuedAt)}
                        </td>

                        <td className="py-2.5 px-3.5 text-xs">
                          <div className="inline-flex gap-2">
                            {inv.pdfUrl ? (
                              <a
                                href={inv.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-[11px] text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                              >
                                PDF
                              </a>
                            ) : (
                              <span className="text-muted text-[11px]">
                                PDF
                              </span>
                            )}
                            {inv.xmlUrl ? (
                              <a
                                href={inv.xmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-[11px] text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                              >
                                XML
                              </a>
                            ) : (
                              <span className="text-muted text-[11px]">
                                XML
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3.5 text-right text-xs whitespace-nowrap">
                          {showIssueButton ? (
                            <IssueInvoiceButton
                              invoiceId={inv.id}
                              status={inv.status}
                            />
                          ) : (
                            <span className="text-muted">Sin acciones</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
