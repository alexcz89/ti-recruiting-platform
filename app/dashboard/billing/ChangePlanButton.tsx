"use client";

// app/dashboard/billing/ChangePlanButton.tsx
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { PlanId } from "@/config/plans";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import { STRIPE_PRICES } from "@/lib/stripe";

// Planes que van por Stripe Checkout
const STRIPE_PLAN_MAP: Partial<Record<PlanId, string>> = {
  STARTER: STRIPE_PRICES.STARTER,
  PRO:     STRIPE_PRICES.PRO,
};

type Props = {
  planId: PlanId;
  isCurrent: boolean;
};

export default function ChangePlanButton({ planId, isCurrent }: Props) {
  const router                    = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading]     = useState(false);
  const busy                      = loading || isPending;

  if (isCurrent) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold cursor-default border border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300"
      >
        Plan actual
      </button>
    );
  }

  const handleClick = async () => {
    if (busy) return;
    setLoading(true);

    try {
      const stripePriceId = STRIPE_PLAN_MAP[planId];

      // ── Planes de pago → Stripe Checkout ──────────────────
      if (stripePriceId) {
        const res  = await fetch("/api/billing/create-checkout", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ type: "subscription", priceId: stripePriceId }),
        });
        const data = await res.json();

        if (data.url) {
          window.location.href = data.url; // redirige a Stripe
          return;
        }
        throw new Error(data.error || "No se pudo iniciar el checkout");
      }

      // ── Plan FREE → API interna (downgrade) ───────────────
      const res  = await fetch("/api/billing/change-plan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toastError(data?.error || "No se pudo cambiar de plan");
        return;
      }

      toastSuccess("Plan actualizado correctamente");
      startTransition(() => router.refresh());

    } catch (e: any) {
      toastError(e.message || "No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 transition-colors"
    >
      {busy
        ? <><Loader2 className="h-3 w-3 animate-spin" /> Procesando...</>
        : "Cambiar a este plan"
      }
    </button>
  );
}