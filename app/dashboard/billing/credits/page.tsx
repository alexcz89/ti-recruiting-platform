"use client";

// app/dashboard/billing/credits/page.tsx
import { useEffect, useState } from "react";
import { formatCredits, CREDIT_PACKAGES } from "@/lib/assessments/pricing";
import { AssessmentCostBadge } from "@/components/jobs/AssessmentCostBadge";
import { Loader2, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

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
    candidate: { firstName: string | null; lastName: string | null; email: string };
    job: { title: string };
    template: { title: string; type: string; difficulty: string };
  };
}

export default function CreditsPage() {
  const searchParams              = useSearchParams();
  const success                   = searchParams.get("success") === "1";
  const canceled                  = searchParams.get("canceled") === "1";

  const [balance,  setBalance]    = useState<CreditBalanceData | null>(null);
  const [history,  setHistory]    = useState<CreditHistoryItem[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [buying,   setBuying]     = useState<string | null>(null);
  const [filter,   setFilter]     = useState<"all" | "reserved" | "charged" | "refunded">("all");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/billing/credits?history=true&limit=100");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error("Error fetching credits:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Stripe Checkout ──────────────────────────────────────
  const handleBuy = async (stripePriceId: string, pkgId: string) => {
    setBuying(pkgId);
    try {
      const res  = await fetch("/api/billing/create-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: "credits", priceId: stripePriceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Error al iniciar el pago");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBuying(null);
    }
  };

  const filteredHistory = history.filter(item =>
    filter === "all" ? true : item.status.toLowerCase() === filter
  );

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    const styles: Record<string, string> = {
      reserved: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      charged:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      refunded: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    };
    const labels: Record<string, string> = {
      reserved: "Reservado",
      charged:  "Cobrado",
      refunded: "Reembolsado",
    };
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[s] || styles.reserved}`}>
        {labels[s] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="inline-block h-8 w-8 animate-spin text-violet-600" />
          <p className="mt-4 text-sm text-zinc-500">Cargando créditos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Créditos de Evaluaciones
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Gestiona tus créditos para evaluaciones técnicas
        </p>
      </div>

      {/* Banners de resultado de pago */}
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            ¡Pago exitoso! Tus créditos ya están disponibles.
          </p>
        </div>
      )}
      {canceled && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Pago cancelado. Tus créditos no han cambiado.
          </p>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        {[
          { label: "Disponibles",     value: balance?.available       || 0, color: "text-emerald-600 dark:text-emerald-400", sub: "Listos para usar"     },
          { label: "Reservados",      value: balance?.reserved        || 0, color: "text-amber-600 dark:text-amber-400",    sub: "Invites pendientes"   },
          { label: "Usados (mes)",    value: balance?.used            || 0, color: "text-violet-600 dark:text-violet-400",  sub: "Este ciclo"           },
          { label: "Balance efectivo",value: balance?.effectiveBalance|| 0, color: "text-blue-600 dark:text-blue-400",      sub: "Disponible - Reservado" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <p className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-tight">{label}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${color}`}>{formatCredits(value)}</p>
            <p className="text-xs text-zinc-500 mt-1 hidden sm:block">{sub}</p>
          </div>
        ))}
      </div>

      {/* Warning pocos créditos */}
      {balance && balance.effectiveBalance < 5 && (
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100 mb-1">Créditos Bajos</h3>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Te quedan menos de 5 créditos efectivos. Compra más para seguir enviando evaluaciones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Paquetes de créditos */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 p-2">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Comprar Créditos
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CREDIT_PACKAGES.map(pkg => (
            <div
              key={pkg.id}
              className={`relative flex flex-col rounded-3xl border-2 p-5 transition-all hover:shadow-md
                ${pkg.recommended
                  ? "border-violet-400 dark:border-violet-600 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 ring-2 ring-violet-500/20"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                }`}
            >
              {pkg.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1 text-[11px] font-bold text-white shadow-md">
                    MÁS POPULAR
                  </span>
                </div>
              )}

              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{pkg.name}</p>
                <p className="text-3xl font-black text-zinc-900 dark:text-white mt-0.5">
                  {pkg.credits}
                  <span className="text-base font-semibold text-zinc-500 ml-1">créditos</span>
                </p>
              </div>

              <div className="mb-4 space-y-1">
                <p className="text-2xl font-black text-zinc-900 dark:text-white">
                  ${pkg.price}
                  <span className="text-xs font-normal text-zinc-400 ml-1">MXN</span>
                </p>
                <p className="text-xs text-zinc-500">${pkg.pricePerCredit.toFixed(2)} MXN por crédito</p>
              </div>

              <div className="flex-1" />

              <button
                onClick={() => handleBuy(pkg.stripePriceId, pkg.id)}
                disabled={!!buying}
                className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-60
                  ${pkg.recommended
                    ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg"
                    : "border-2 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
              >
                {buying === pkg.id
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                  : `Comprar ${pkg.credits} créditos`
                }
              </button>
            </div>
          ))}
        </div>

        <p className="mt-3 text-center text-xs text-zinc-400">
          Pago seguro procesado por Stripe · Los créditos se acreditan inmediatamente · Sin vencimiento
        </p>
      </div>

      {/* Historial */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Historial de Uso</h2>
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all",      label: "Todos"        },
              { key: "reserved", label: "Reservados"   },
              { key: "charged",  label: "Cobrados"     },
              { key: "refunded", label: "Reembolsados" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
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
                  {["Fecha", "Candidato", "Vacante", "Evaluación", "Estado", "Créditos"].map((h, i) => (
                    <th key={h} className={`px-4 sm:px-6 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${i === 5 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-400 dark:text-zinc-600">
                      No hay transacciones todavía
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-zinc-100">
                        {new Date(item.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {item.invite.candidate.firstName} {item.invite.candidate.lastName}
                        </p>
                        <p className="text-xs text-zinc-500">{item.invite.candidate.email}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                        {item.invite.job.title}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.invite.template.title}</p>
                        {item.assessmentType && item.difficulty && (
                          <AssessmentCostBadge
                            type={item.assessmentType as any}
                            difficulty={item.difficulty as any}
                            variant="compact"
                          />
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                        <span className={
                          item.status.toLowerCase() === "charged"  ? "text-red-600 dark:text-red-400" :
                          item.status.toLowerCase() === "refunded" ? "text-emerald-600 dark:text-emerald-400" :
                          "text-amber-600 dark:text-amber-400"
                        }>
                          {item.status.toLowerCase() === "charged"  && "-"}
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