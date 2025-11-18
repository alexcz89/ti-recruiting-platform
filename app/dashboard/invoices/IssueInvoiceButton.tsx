// app/dashboard/invoices/IssueInvoiceButton.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InvoiceStatus } from "@prisma/client";

type Props = {
  invoiceId: string;
  status: InvoiceStatus;
};

export default function IssueInvoiceButton({ invoiceId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const busy = loading || isPending;

  if (status === "ISSUED") {
    return null; // ya está timbrada, no mostramos botón
  }

  const label = status === "ERROR" ? "Reintentar timbrado" : "Timbrar CFDI";

  const handleClick = async () => {
    if (busy) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/issue`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Issue invoice error", data);
        toast.error(data?.error || "No se pudo timbrar la factura");
        return;
      }
      toast.success("Factura timbrada correctamente");
      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);
      toast.error("Error de red al timbrar la factura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="text-xs text-emerald-600 hover:underline disabled:opacity-60 dark:text-emerald-400"
    >
      {busy ? "Timbrando..." : label}
    </button>
  );
}
