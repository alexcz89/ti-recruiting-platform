// app/dashboard/billing/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import { PLANS, type PlanId } from "@/config/plans";
import { JobStatus } from "@prisma/client";
import ChangePlanButton from "./ChangePlanButton";

function formatCurrency(amount: number, currency: "MXN" | "USD" | string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function BillingPage() {
  const companyId = await getSessionCompanyId();

  if (!companyId) {
    redirect("/auth/signin");
  }

  // Compañía + vacantes abiertas
  const [company, activeJobsCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        billingPlan: true,
        createdAt: true,
      },
    }),
    prisma.job.count({
      where: {
        companyId,
        status: JobStatus.OPEN,
      },
    }),
  ]);

  if (!company) {
    redirect("/auth/signin");
  }

  // Si no tiene plan asignado, asumimos FREE
  const billingPlan = (company.billingPlan as PlanId | undefined) ?? "FREE";

  const currentPlan =
    PLANS.find((p) => p.id === billingPlan) ??
    PLANS.find((p) => p.id === "FREE") ??
    PLANS[0];

  const maxActiveJobs = currentPlan.limits.maxActiveJobs; // null = ilimitado

  const activeJobsLabel =
    maxActiveJobs === null
      ? `${activeJobsCount} activas (sin límite)`
      : `${activeJobsCount} / ${maxActiveJobs} vacantes activas`;

  const usagePct =
    maxActiveJobs && maxActiveJobs > 0
      ? Math.min(100, (activeJobsCount / maxActiveJobs) * 100)
      : 100;

  const createdAt = company.createdAt
    ? new Date(company.createdAt).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : null;

  return (
    <main className="min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6 space-y-6">
        {/* Encabezado */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500 mb-2">
              Facturación & límites de plan
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Facturación y plan
            </h1>
            <p className="mt-1 text-sm text-muted max-w-xl">
              Administra tu suscripción, revisa tu plan actual y el límite de
              vacantes activas de tu empresa.
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            {company.name && (
              <p className="font-medium text-default">{company.name}</p>
            )}
            {createdAt && (
              <p>
                Cliente desde <span className="font-medium">{createdAt}</span>
              </p>
            )}
          </div>
        </header>

        {/* Plan actual */}
        <section className="rounded-2xl border glass-card p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">
                Plan actual
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{currentPlan.name}</h2>
                {currentPlan.highlight && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                    {currentPlan.popularLabel ?? "Más popular"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{currentPlan.tagline}</p>

              <div className="mt-3 flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-lg font-semibold">
                  {currentPlan.priceMonthly === 0
                    ? "Gratis"
                    : formatCurrency(
                        currentPlan.priceMonthly,
                        currentPlan.currency
                      )}
                </span>
                {currentPlan.priceMonthly > 0 && (
                  <span className="text-muted">
                    {currentPlan.periodLabel || "/mes"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 text-sm sm:items-end w-full sm:w-auto max-w-xs sm:max-w-sm">
              <div className="w-full rounded-xl soft-panel px-3 py-2 text-xs sm:text-sm border border-[rgb(var(--border))]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-default">Vacantes activas</p>
                  <p className="text-muted">{activeJobsLabel}</p>
                </div>

                {maxActiveJobs !== null && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-[rgb(var(--muted))]">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botón que baja a la sección de planes */}
              <a
                href="#plans"
                className="inline-flex items-center justify-center rounded-md border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                Mejorar plan
              </a>
            </div>
          </div>
        </section>

        {/* Otros planes */}
        <section id="plans" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-default">
              Otros planes disponibles
            </h3>
            <p className="text-xs text-muted">
              Cambia de plan en cualquier momento. El cobro será proporcional
              al periodo actual.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan.id;
              const isHighlighted = plan.highlight && !isCurrent;

              const cardClasses = [
                "flex flex-col rounded-2xl border glass-card p-4 text-sm shadow-sm transition hover:shadow-md",
                isCurrent
                  ? "ring-2 ring-emerald-500/60 border-emerald-500/70"
                  : isHighlighted
                  ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/5 to-transparent"
                  : "border-[rgb(var(--border))]",
              ].join(" ");

              return (
                <div key={plan.id} className={cardClasses}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-default">
                        {plan.name}
                      </p>
                      <p className="text-xs text-muted">{plan.tagline}</p>
                    </div>
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                        Actual
                      </span>
                    )}
                    {!isCurrent && isHighlighted && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                        Recomendado
                      </span>
                    )}
                  </div>

                  <div className="mb-3 flex items-baseline gap-2">
                    <span className="text-lg font-semibold">
                      {plan.priceMonthly === 0
                        ? "Gratis"
                        : formatCurrency(plan.priceMonthly, plan.currency)}
                    </span>
                    {plan.priceMonthly > 0 && (
                      <span className="text-xs text-muted">
                        {plan.periodLabel || "/mes"}
                      </span>
                    )}
                  </div>

                  <ul className="mb-4 space-y-1.5 text-xs text-muted">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="mt-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] text-emerald-500">
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.features.length > 4 && (
                      <li className="pl-5 text-[11px] text-muted/80">
                        +{plan.features.length - 4} beneficios más
                      </li>
                    )}
                  </ul>

                  {/* Aquí usamos el botón que SÍ hace la llamada a la API */}
                  <ChangePlanButton
                    planId={plan.id as PlanId}
                    isCurrent={isCurrent}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
