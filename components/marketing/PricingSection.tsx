// components/marketing/PricingSection.tsx
"use client";

import Link from "next/link";
import { PLANS } from "@/config/plans";

export default function PricingSection() {
  return (
    <section className="w-full border-t border-slate-200 bg-slate-50 py-16 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Monetiza tu flujo de vacantes
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Precios simples, pensados para reclutamiento de TI
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
            Empieza gratis, publica tus primeras vacantes y cuando estés listo
            escala con planes que incluyen ATS, base de talento y automatización.
          </p>
        </div>

        {/* Toggle mensual/anual (por ahora solo UI) */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button className="rounded-full bg-slate-900 px-3 py-1 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
              Mensual
            </button>
            <button className="rounded-full px-3 py-1 text-slate-500 dark:text-slate-400">
              Anual (próximamente)
            </button>
          </div>
        </div>

        {/* Grid de planes */}
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={[
                "relative flex flex-col rounded-2xl border p-5 sm:p-6",
                "bg-white/80 text-slate-900 shadow-sm backdrop-blur dark:bg-slate-900/70 dark:text-slate-50",
                "border-slate-200 dark:border-slate-800",
                plan.highlight
                  ? "ring-2 ring-emerald-500/70 shadow-emerald-500/20"
                  : "",
              ].join(" ")}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 shadow">
                    {plan.popularLabel ?? "Recomendado"}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-base font-semibold">{plan.name}</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {plan.tagline}
                </p>
              </div>

              <div className="mb-4">
                <span className="text-2xl font-semibold">
                  {plan.priceMonthly === 0
                    ? "$0"
                    : new Intl.NumberFormat("es-MX", {
                        style: "currency",
                        currency: plan.currency,
                        maximumFractionDigits: 0,
                      }).format(plan.priceMonthly)}
                </span>
                {plan.priceMonthly > 0 && (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {" "}
                    {plan.periodLabel}
                  </span>
                )}
              </div>

              <ul className="mb-6 flex-1 space-y-2 text-xs text-slate-800 dark:text-slate-200">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-300">
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div>
                <Link
                  href="/signup" // TODO: ajusta esta ruta a tu flujo real
                  className={[
                    "inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-xs font-semibold transition",
                    plan.highlight
                      ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                      : "bg-slate-900 text-slate-50 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200",
                  ].join(" ")}
                >
                  {plan.ctaLabel}
                </Link>
                {plan.id === "FREE" && (
                  <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                    No se requiere tarjeta de crédito.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Nota de headhunting */}
        <div className="mt-10 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-4 text-xs text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100 sm:text-sm">
          <p className="mb-1 font-medium">¿Eres empresa con vacantes críticas?</p>
          <p className="text-emerald-900/90 dark:text-emerald-100/90">
            Además de la plataforma, ofrecemos servicio de headhunting especializado
            en TI. Podemos trabajar con esquema de success fee (1.5 meses de sueldo)
            para posiciones clave.{" "}
            <Link
              href="/contact"
              className="underline decoration-emerald-400 underline-offset-2"
            >
              Agenda una llamada
            </Link>{" "}
            para revisar tu caso.
          </p>
        </div>
      </div>
    </section>
  );
}
