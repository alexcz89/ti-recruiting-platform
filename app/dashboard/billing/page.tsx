// app/dashboard/billing/page.tsx
import { redirect } from "next/navigation";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import { PLANS, type PlanId } from "@/config/plans";
import { JobStatus } from "@prisma/client";
import ChangePlanButton from "./ChangePlanButton";
import { Sparkles, Lock, BarChart2, UserCheck } from "lucide-react";

function formatCurrency(amount: number, currency: "MXN" | "USD" | string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function BillingPage() {
  const companyId = await getSessionCompanyId();
  if (!companyId) redirect("/auth/signin");

  const [company, activeJobsCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, billingPlan: true, createdAt: true },
    }),
    prisma.job.count({ where: { companyId, status: JobStatus.OPEN } }),
  ]);

  if (!company) redirect("/auth/signin");

  const billingPlan = (company.billingPlan as PlanId | undefined) ?? "FREE";
  const currentPlan =
    PLANS.find((p) => p.id === billingPlan) ??
    PLANS.find((p) => p.id === "FREE") ??
    PLANS[0];

  const maxActiveJobs = currentPlan.limits.maxActiveJobs;
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

  // ¿Puede ver AI Match?
  const hasAiMatch = billingPlan === "STARTER" || billingPlan === "PRO";
  const hasFullAiMatch = billingPlan === "PRO";

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
              Administra tu suscripción, revisa tu plan actual y el límite de vacantes activas de tu empresa.
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            {company.name && <p className="font-medium text-default">{company.name}</p>}
            {createdAt && <p>Cliente desde <span className="font-medium">{createdAt}</span></p>}
          </div>
        </header>

        {/* Plan actual */}
        <section className="rounded-2xl border glass-card p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Plan actual</p>
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
                    : formatCurrency(currentPlan.priceMonthly, currentPlan.currency)}
                </span>
                {currentPlan.priceMonthly > 0 && (
                  <span className="text-muted">{currentPlan.periodLabel || "/mes"}</span>
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
              <a
                href="#plans"
                className="inline-flex items-center justify-center rounded-md border border-emerald-500/70 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                Mejorar plan
              </a>
            </div>
          </div>
        </section>

        {/* ✅ NUEVO: Banner de AI Match según plan */}
        {!hasFullAiMatch && (
          <section className={`rounded-2xl border p-5 sm:p-6 ${
            !hasAiMatch
              ? "border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/20"
              : "border-sky-200 bg-sky-50 dark:border-sky-700/40 dark:bg-sky-950/20"
          }`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  !hasAiMatch
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-sky-100 dark:bg-sky-900/30"
                }`}>
                  {!hasAiMatch
                    ? <Lock className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                    : <Sparkles className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
                  }
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    !hasAiMatch
                      ? "text-amber-900 dark:text-amber-100"
                      : "text-sky-900 dark:text-sky-100"
                  }`}>
                    {!hasAiMatch
                      ? "AI Match no disponible en tu plan"
                      : "AI Match activo — top 5 por vacante"}
                  </p>
                  <p className={`mt-1 text-xs ${
                    !hasAiMatch
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-sky-700 dark:text-sky-300"
                  }`}>
                    {!hasAiMatch
                      ? "Con AI Match, TaskIO compara automáticamente las skills de cada candidato contra los requisitos de tu vacante y calcula un score de compatibilidad 0–100. Identifica al mejor candidato en segundos."
                      : "Puedes ver el score de los 5 candidatos con mejor match por vacante. Actualiza a Pro para ver el score de todos los candidatos sin límite."}
                  </p>

                  {/* Features de AI Match */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      { icon: BarChart2, label: "Score 0–100", desc: "Comparación automática de skills vs. requisitos de la vacante" },
                      { icon: UserCheck, label: "Breakdown por skill", desc: "Ve qué skills tiene y cuáles le faltan a cada candidato" },
                      { icon: Sparkles, label: "Prioriza candidatos", desc: "Ordena tu lista por match para revisar primero los mejores perfiles" },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className={`rounded-xl border p-3 text-xs ${
                        !hasAiMatch
                          ? "border-amber-200 bg-white/60 dark:border-amber-700/30 dark:bg-amber-950/20"
                          : "border-sky-200 bg-white/60 dark:border-sky-700/30 dark:bg-sky-950/20"
                      }`}>
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {label}
                        </div>
                        <p className="mt-1 text-zinc-500 dark:text-zinc-400">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <a
                  href="#plans"
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors ${
                    !hasAiMatch
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {!hasAiMatch ? "Activar AI Match" : "Ver plan Pro"}
                </a>
                {!hasAiMatch && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Desde $499 MXN/mes
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Si ya tiene PRO: confirmación de que tiene todo */}
        {hasFullAiMatch && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-700/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  AI Match activo — todos los candidatos
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Tu plan Pro incluye AI Match ilimitado. Puedes ver el score de todos tus candidatos en cada vacante.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Comparativa AI Match entre planes */}
        <section className="rounded-2xl border glass-card p-5 sm:p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-default">Comparativa de AI Match por plan</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgb(var(--border))]">
                  <th className="pb-2 pr-4 text-left font-medium text-muted">Feature</th>
                  <th className="pb-2 px-4 text-center font-medium text-muted">Gratis</th>
                  <th className="pb-2 px-4 text-center font-semibold text-emerald-600 dark:text-emerald-400">Starter</th>
                  <th className="pb-2 pl-4 text-center font-semibold text-zinc-800 dark:text-zinc-100">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {[
                  { feature: "Score AI Match (0–100%)", free: "—", starter: "Top 5 por vacante", pro: "Ilimitado" },
                  { feature: "Breakdown de skills (tiene / le falta)", free: "—", starter: "✓", pro: "✓" },
                  { feature: "Nivel de skill del candidato (L1–L5)", free: "—", starter: "✓", pro: "✓" },
                  { feature: "Ordenar candidatos por match", free: "—", starter: "✓", pro: "✓" },
                  { feature: "Perfil detallado con match breakdown", free: "—", starter: "✓", pro: "✓" },
                  { feature: "Skills requeridas vs. deseables", free: "—", starter: "✓", pro: "✓" },
                ].map(({ feature, free, starter, pro }) => (
                  <tr key={feature}>
                    <td className="py-2 pr-4 text-default">{feature}</td>
                    <td className="py-2 px-4 text-center text-zinc-400">{free}</td>
                    <td className={`py-2 px-4 text-center font-medium ${billingPlan === "STARTER" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-300"}`}>{starter}</td>
                    <td className={`py-2 pl-4 text-center font-medium ${billingPlan === "PRO" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-300"}`}>{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Otros planes */}
        <section id="plans" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-default">Otros planes disponibles</h3>
            <p className="text-xs text-muted">
              Cambia de plan en cualquier momento. El cobro será proporcional al periodo actual.
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
                      <p className="text-sm font-semibold text-default">{plan.name}</p>
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
                      <span className="text-xs text-muted">{plan.periodLabel || "/mes"}</span>
                    )}
                  </div>

                  <ul className="mb-4 space-y-1.5 text-xs text-muted">
                    {plan.features.slice(0, 5).map((f) => {
                      const isAiFeature = f.toLowerCase().startsWith("ai match");
                      return (
                        <li key={f} className="flex gap-2">
                          <span className={`mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[9px] ${
                            isAiFeature
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-emerald-500/15 text-emerald-500"
                          }`}>
                            {isAiFeature ? "✦" : "✓"}
                          </span>
                          <span className={isAiFeature ? "font-medium text-emerald-700 dark:text-emerald-300" : ""}>
                            {f}
                          </span>
                        </li>
                      );
                    })}
                    {plan.features.length > 5 && (
                      <li className="pl-5 text-[11px] text-muted/80">
                        +{plan.features.length - 5} beneficios más
                      </li>
                    )}
                  </ul>

                  <ChangePlanButton planId={plan.id as PlanId} isCurrent={isCurrent} />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}