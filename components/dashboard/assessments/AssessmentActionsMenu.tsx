// components/dashboard/assessments/AssessmentActionsMenu.tsx
"use client";

import * as React from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { createAssessmentResendBody } from "@/lib/assessments/resend-operation";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  ClipboardCopy,
  ExternalLink,
  RotateCcw,
  FileText,
} from "lucide-react";

type Props = {
  applicationId?: string | null;
  templateId?: string | null;
  invitePath?: string | null;
  resultsUrl?: string | null;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

function cn(...xs: Array<string | undefined | null | false>) {
  return xs.filter(Boolean).join(" ");
}

async function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/** Existing actions, with the shared menu handling focus, keyboard and portal collisions. */
export default function AssessmentActionsMenu({
  applicationId,
  templateId,
  invitePath,
  resultsUrl,
  disabled,
  className,
  ariaLabel = "Acciones",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const inviteUrlAbs =
    invitePath && typeof window !== "undefined"
      ? new URL(invitePath, window.location.origin).toString()
      : null;

  async function onCopyLink() {
    if (!inviteUrlAbs) return;
    try {
      await copyToClipboard(inviteUrlAbs);
      toast.success("Link copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el link");
    } finally {
      setOpen(false);
    }
  }

  async function onResend() {
    if (!applicationId || !templateId) {
      toast.error("Falta información para reenviar");
      return;
    }

    const ok = window.confirm(
      "¿Reenviar evaluación al candidato? Se actualizará el link y la expiración."
    );
    if (!ok) return;

    setBusy(true);
    const toastId = toast.loading("Reenviando evaluación...");
    try {
      const res = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/assessment-invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createAssessmentResendBody(templateId)),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No se pudo reenviar", { id: toastId });
        return;
      }
      toast.success("Evaluación reenviada al candidato", { id: toastId });
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Error reenviando", { id: toastId });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const canCopy = Boolean(invitePath);
  const canOpen = Boolean(invitePath);
  const canResend = Boolean(applicationId && templateId);
  const canResults = Boolean(resultsUrl);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled || busy} aria-label={ariaLabel} className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800", className)}>
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent compact align="end" collisionPadding={8} className="w-56 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto">
        <DropdownMenuItem compact className="min-h-11 text-sm" disabled={!canCopy} onSelect={event => { event.preventDefault(); void onCopyLink(); }}>
          <ClipboardCopy aria-hidden="true" className="h-4 w-4" />Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem compact className="min-h-11 text-sm" disabled={!canOpen} onSelect={() => { if (inviteUrlAbs) window.open(inviteUrlAbs, "_blank", "noopener,noreferrer"); }}>
          <ExternalLink aria-hidden="true" className="h-4 w-4" />Abrir link
        </DropdownMenuItem>
        <DropdownMenuSeparator compact />
        <DropdownMenuItem compact className="min-h-11 text-sm" disabled={!canResend || busy} onSelect={event => { event.preventDefault(); void onResend(); }}>
          <RotateCcw aria-hidden="true" className="h-4 w-4" />{busy ? "Reenviando..." : "Reenviar assessment"}
        </DropdownMenuItem>
        {canResults && <><DropdownMenuSeparator compact /><DropdownMenuItem compact asChild className="min-h-11 text-sm"><Link href={resultsUrl!}><FileText aria-hidden="true" className="h-4 w-4" />Ver resultados</Link></DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
