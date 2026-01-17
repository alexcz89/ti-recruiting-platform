// components/dashboard/assessments/AssessmentActionsMenu.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  ClipboardCopy,
  ExternalLink,
  RotateCcw,
  FileText,
  Link2,
} from "lucide-react";

type Props = {
  applicationId?: string | null;
  templateId?: string | null;

  invitePath?: string | null; // e.g. /assessments/:templateId?token=...
  resultsUrl?: string | null; // e.g. /assessments/attempts/:attemptId/results

  disabled?: boolean;
  className?: string;
};

function cn(...xs: Array<string | undefined | null | false>) {
  return xs.filter(Boolean).join(" ");
}

async function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // fallback
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

export default function AssessmentActionsMenu({
  applicationId,
  templateId,
  invitePath,
  resultsUrl,
  disabled,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const inviteUrlAbs =
    invitePath && typeof window !== "undefined" ? new URL(invitePath, window.location.origin).toString() : null;

  async function onCopyLink() {
    if (!inviteUrlAbs) return;
    try {
      await copyToClipboard(inviteUrlAbs);
      // Si tienes Sonner/Toast, aquí lo conectas; por ahora simple:
      // eslint-disable-next-line no-alert
      alert("Link copiado");
    } catch {
      // eslint-disable-next-line no-alert
      alert("No se pudo copiar el link");
    } finally {
      setOpen(false);
    }
  }

  async function onResend() {
    if (!applicationId || !templateId) {
      // eslint-disable-next-line no-alert
      alert("Falta applicationId/templateId para reenviar.");
      return;
    }

    const ok = confirm("¿Reenviar evaluación al candidato? (Genera/actualiza link y expiración).");
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/assessment-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // eslint-disable-next-line no-alert
        alert(data?.error || "No se pudo reenviar");
        return;
      }

      // eslint-disable-next-line no-alert
      alert("Assessment reenviado");
      router.refresh();
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Error reenviando");
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
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all",
          "border-zinc-200 bg-white/90 text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300",
          "dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:bg-zinc-900 dark:hover:border-zinc-600",
          (disabled || busy) && "opacity-60 cursor-not-allowed"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Acciones"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border shadow-lg",
            "border-zinc-200 bg-white",
            "dark:border-zinc-800 dark:bg-zinc-950"
          )}
        >
          <div className="p-2">
            {/* Link */}
            <button
              type="button"
              role="menuitem"
              disabled={!canCopy}
              onClick={onCopyLink}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
                canCopy
                  ? "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  : "text-zinc-400 cursor-not-allowed dark:text-zinc-600"
              )}
            >
              {canCopy ? <ClipboardCopy className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              Copiar link
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={!canOpen}
              onClick={() => {
                if (!inviteUrlAbs) return;
                window.open(inviteUrlAbs, "_blank", "noopener,noreferrer");
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
                canOpen
                  ? "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  : "text-zinc-400 cursor-not-allowed dark:text-zinc-600"
              )}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir link
            </button>

            <div className="my-2 h-px bg-zinc-100 dark:bg-zinc-800" />

            {/* Reenviar */}
            <button
              type="button"
              role="menuitem"
              disabled={!canResend || busy}
              onClick={onResend}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
                canResend && !busy
                  ? "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  : "text-zinc-400 cursor-not-allowed dark:text-zinc-600"
              )}
            >
              <RotateCcw className="h-4 w-4" />
              {busy ? "Reenviando..." : "Reenviar assessment"}
            </button>

            {/* Resultados */}
            {canResults ? (
              <>
                <div className="my-2 h-px bg-zinc-100 dark:bg-zinc-800" />
                <Link
                  role="menuitem"
                  href={resultsUrl!}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
                    "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Ver resultados
                </Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}