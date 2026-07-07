// components/billing/CreditBalance.tsx
"use client";

import { useEffect, useState } from "react";
import { formatCredits } from "@/lib/assessments/pricing";

interface CreditBalanceData {
  available: number;
  reserved: number;
  used: number;
  effectiveBalance: number;
  plan: string | null;
  planCreditsPerMonth: number;
}

interface CreditBalanceProps {
  variant?: "card" | "compact" | "inline";
  showHistory?: boolean;
  className?: string;
}

export function CreditBalance({
  variant = "card",
  showHistory = false,
  className = "",
}: CreditBalanceProps) {
  const [balance, setBalance] = useState<CreditBalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch("/api/billing/credits");
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
      }
    } catch (error) {
      console.error("Error fetching credit balance:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  if (!balance) return null;

  const percentUsed = balance.used > 0
    ? Math.round((balance.used / (balance.available + balance.used)) * 100)
    : 0;

  const needsMoreCredits = balance.effectiveBalance < 5;

  if (variant === "inline") {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <svg
          className="w-5 h-5 text-teal-600 dark:text-teal-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
          />
        </svg>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {formatCredits(balance.effectiveBalance)} créditos disponibles
        </span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`p-4 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Créditos Disponibles
            </p>
            {balance.reserved > 0 && (
              <p className="text-xs text-zinc-500 mt-1">
                ({formatCredits(balance.reserved)} reservados)
              </p>
            )}
          </div>
          <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">
            {formatCredits(balance.effectiveBalance)}
          </p>
        </div>
        {needsMoreCredits && (
          <div className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            ⚠️ Créditos bajos.{" "}
            <a
              href="/dashboard/billing/credits"
              className="underline font-medium hover:text-amber-800 dark:hover:text-amber-200"
            >
              Comprar más
            </a>
          </div>
        )}
      </div>
    );
  }

  // card variant (default)
  return (
    <div
      className={`p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Balance de Créditos
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {balance.plan
              ? `Plan ${balance.plan} (${balance.planCreditsPerMonth}/mes)`
              : "Sin plan activo"}
          </p>
        </div>
        <a
          href="/dashboard/billing/credits"
          className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
        >
          Ver historial →
        </a>
      </div>

      {/* ✅ Responsive grid: 1 column on mobile, 3 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            Disponibles
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCredits(balance.available)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            Reservados
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCredits(balance.reserved)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            Usados
          </p>
          <p className="text-2xl font-bold text-zinc-400 dark:text-zinc-600">
            {formatCredits(balance.used)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-2">
          <span>Uso del mes</span>
          <span>{percentUsed}%</span>
        </div>
        <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 transition-all duration-500"
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {needsMoreCredits && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            ⚠️ <strong>Créditos bajos.</strong> Compra más créditos para seguir
            enviando evaluaciones.
          </p>
          <a
            href="/dashboard/billing/credits"
            className="inline-block mt-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
          >
            Comprar créditos →
          </a>
        </div>
      )}

      {!needsMoreCredits && balance.effectiveBalance >= 20 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          ✓ Tienes suficientes créditos para{" "}
          {Math.floor(balance.effectiveBalance / 3)} evaluaciones más
        </p>
      )}
    </div>
  );
}