// app/dashboard/billing/credits/page.tsx
"use client";

import { useEffect, useState } from "react";
import { formatCredits, CREDIT_PACKAGES } from "@/lib/assessments/pricing";
import { AssessmentCostBadge } from "@/components/jobs/AssessmentCostBadge";

interface CreditBalanceData {
  available: number;
  reserved: number;
  used: number;
  effectiveBalance: number;
  plan: string | null;
  planCreditsPerMonth: number;
}

interface CreditHistoryItem {
  id: string;
  amount: number;
  status: string;
  assessmentType: string | null;
  difficulty: string | null;
  createdAt: string;
  invite: {
    candidate: {
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    job: {
      title: string;
    };
    template: {
      title: string;
      type: string;
      difficulty: string;
    };
  };
}

export default function CreditsPage() {
  const [balance, setBalance] = useState<CreditBalanceData | null>(null);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "reserved" | "charged" | "refunded">("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/billing/credits?history=true&limit=100");
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("Error fetching credits:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((item) => {
    if (filter === "all") return true;
    return item.status.toLowerCase() === filter;
  });

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    const badges = {
      reserved: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      charged: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      refunded: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    };
    const badge = badges[statusLower as keyof typeof badges] || badges.reserved;

    const labels = {
      reserved: "Reservado",
      charged: "Cobrado",
      refunded: "Reembolsado",
    };
    const label = labels[statusLower as keyof typeof labels] || status;

    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${badge}`}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-zinc-300 border-t-violet-600 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-zinc-500">Cargando créditos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Créditos de Evaluaciones
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Gestiona tus créditos para evaluaciones técnicas
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Disponibles
            </p>
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatCredits(balance?.available || 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Listos para usar</p>
        </div>

        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Reservados
            </p>
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatCredits(balance?.reserved || 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Invites pendientes</p>
        </div>

        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Usados (mes)
            </p>
            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-violet-600 dark:text-violet-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatCredits(balance?.used || 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Este ciclo</p>
        </div>

        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Balance Efectivo
            </p>
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
            </div>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatCredits(balance?.effectiveBalance || 0)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Disponible - Reservado</p>
        </div>
      </div>

      {/* Warning si hay pocos créditos */}
      {balance && balance.effectiveBalance < 5 && (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-1">
                Créditos Bajos
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                Te quedan menos de 5 créditos efectivos. Compra más para seguir
                enviando evaluaciones a tus candidatos.
              </p>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Comprar Créditos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paquetes de Créditos */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Comprar Créditos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative p-6 rounded-2xl border-2 transition-all ${
                pkg.recommended
                  ? "border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {pkg.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-full">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Recomendado
                  </span>
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  {pkg.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                    ${pkg.price}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400"> USD</span>
                </div>
                <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                  {pkg.credits}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  créditos
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                  ${pkg.pricePerCredit.toFixed(2)} por crédito
                </p>
              </div>
              <button
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                  pkg.recommended
                    ? "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/30"
                    : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                }`}
              >
                Comprar Ahora
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Historial */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Historial de Uso
          </h2>
          
          {/* Filtros */}
          <div className="flex gap-2">
            {[
              { key: "all", label: "Todos" },
              { key: "reserved", label: "Reservados" },
              { key: "charged", label: "Cobrados" },
              { key: "refunded", label: "Reembolsados" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.key
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Candidato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Vacante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Evaluación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Créditos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-zinc-400 dark:text-zinc-600">
                        <svg
                          className="w-12 h-12 mx-auto mb-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p className="text-sm">No hay transacciones todavía</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-zinc-100">
                        {new Date(item.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100">
                        <div>
                          <p className="font-medium">
                            {item.invite.candidate.firstName}{" "}
                            {item.invite.candidate.lastName}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {item.invite.candidate.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                        {item.invite.job.title}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div>
                          <p className="text-zinc-900 dark:text-zinc-100 font-medium">
                            {item.invite.template.title}
                          </p>
                          {item.assessmentType && item.difficulty && (
                            <AssessmentCostBadge
                              type={item.assessmentType as any}
                              difficulty={item.difficulty as any}
                              variant="compact"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                        <span
                          className={
                            item.status.toLowerCase() === "charged"
                              ? "text-red-600 dark:text-red-400"
                              : item.status.toLowerCase() === "refunded"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }
                        >
                          {item.status.toLowerCase() === "charged" && "-"}
                          {item.status.toLowerCase() === "refunded" && "+"}
                          {formatCredits(Number(item.amount))}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}