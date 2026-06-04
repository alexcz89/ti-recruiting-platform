// components/marketing/PricingSection.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS, type PlanConfig } from "@/config/plans";

const USD_RATE = 17.5;
const ANNUAL_DISCOUNT = 0.8;

function formatPrice(
  mxn: number,
  currency: "MXN" | "USD",
  billing: "mensual" | "anual"
): string {
  if (mxn === 0) return "$0";
  const discounted = billing === "anual" ? Math.round(mxn * ANNUAL_DISCOUNT) : mxn;
  const amount = currency === "USD" ? Math.round(discounted / USD_RATE) : discounted;
  return new Intl.NumberFormat(currency === "MXN" ? "es-MX" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  FREE: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  STARTER: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  PRO: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  BUSINESS: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
};

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PricingCard({
  plan,
  billing,
  currency,
}: {
  plan: PlanConfig;
  billing: "mensual" | "anual";
  currency: "MXN" | "USD";
}) {
  const isHighlight = plan.highlight;
  const price = formatPrice(plan.priceMonthly, currency, billing);
  const credits = plan.assessments.monthlyCredits;
  const vacantes =
    plan.limits.maxActiveJobs === null ? "Ilimitadas" : plan.limits.maxActiveJobs;
  const reclutadores =
    plan.limits.maxRecruiters === null ? "Ilimitados" : plan.limits.maxRecruiters;

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm",
        "dark:bg-slate-900",
        isHighlight
          ? "border-emerald-500 ring-2 ring-emerald-500/25 dark:border-emerald-500"
          : "border-slate-200 dark:border-slate-700",
      ].join(" ")}
    >
      {isHighlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
            {plan.popularLabel ?? "Recomendado"}
          </span>
        </div>
      )}

      <div className="mb-5 flex items-start gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isHighlight
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
          ].join(" ")}
        >
          {PLAN_ICONS[plan.id]}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white">{plan.name}</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400 hyphens-none [word-break:keep-all]">
            {plan.tagline}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-slate-900 dark:text-white">
            {price}
          </span>
          {plan.priceMonthly > 0 && (
            <span className="text-sm text-slate-400">{currency}/mes</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {plan.priceMonthly === 0
            ? "Sin costo, para siempre"
            : billing === "anual"
            ? "Facturado anualmente - ahorras 20%"
            : "Facturado mensualmente"}
        </p>
      </div>

      <div className="my-5 border-t border-slate-100 dark:border-slate-800" />

      <ul className="flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 hyphens-none [word-break:keep-all]">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
        <div className="flex items-center justify-between py-0.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Coding tests/mes</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {credits.toLocaleString("es-MX")}
          </span>
        </div>
        <div className="flex items-center justify-between py-0.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Vacantes activas</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {vacantes}
          </span>
        </div>
        <div className="flex items-center justify-between py-0.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Reclutadores</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {reclutadores}
          </span>
        </div>
      </div>

      <Link
        href={plan.id === "FREE" ? "/signup" : `/signup?plan=${plan.slug}`}
        className={[
          "mt-5 inline-flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold transition-colors",
          isHighlight
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
        ].join(" ")}
      >
        {plan.ctaLabel}
      </Link>

      {plan.id === "FREE" && (
        <p className="mt-2 text-center text-xs text-slate-400">
          Sin tarjeta de credito
        </p>
      )}
    </div>
  );
}

function TogglePill<T extends string>({
  options,
  value,
  onChange,
  dark = false,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
      {options.map((opt) => (
        <button
          key={opt.value as string}
          onClick={() => onChange(opt.value)}
          className={[
            "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition",
            value === opt.value
              ? dark
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "bg-emerald-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function PricingSection() {
  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");

  return (
    <section
      id="precios"
      className="w-full border-t border-slate-100 bg-white py-16 dark:border-slate-800 dark:bg-slate-950 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            Precios transparentes
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Planes para cada etapa de tu equipo
          </h2>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
            Empieza gratis. Sin compromisos. Escala cuando estes listo.
          </p>
        </div>

        {/* Banner competitivo */}
        <div className="mt-8 mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-center text-sm text-emerald-800 dark:text-emerald-200">
            <span className="font-bold">HireLine cobra $1,090 MXN por 1 sola vacante</span>
            {" "}sin ATS, sin evaluaciones tecnicas.{" "}
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              Con Taskio Starter obtienes 5 vacantes + ATS + evaluaciones + AI Match por $999/mes.
            </span>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <TogglePill<"mensual" | "anual">
            value={billing}
            onChange={setBilling}
            options={[
              { value: "mensual", label: "Mensual" },
              {
                value: "anual",
                label: (
                  <>
                    Anual
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      -20%
                    </span>
                  </>
                ),
              },
            ]}
          />
          <TogglePill<"MXN" | "USD">
            value={currency}
            onChange={setCurrency}
            dark
            options={[
              { value: "MXN", label: "MXN" },
              { value: "USD", label: "USD" },
            ]}
          />
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billing={billing}
              currency={currency}
            />
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 dark:border-emerald-900/50 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">
              Tienes vacantes criticas de TI?
            </p>
            <p className="mt-0.5 text-sm text-emerald-800/80 dark:text-emerald-200/70">
              Servicio de headhunting especializado con success fee. 1.5 meses
              de sueldo. Sin costo si no contratamos.
            </p>
          </div>
          <Link
            href="/contact"
            className="shrink-0 rounded-xl border border-emerald-600 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white"
          >
            Agenda una llamada
          </Link>
        </div>

      </div>
    </section>
  );
}
