// components/dashboard/assessments/AssessmentActionsMenu.tsx
"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  invitePath?: string | null;
  resultsUrl?: string | null;
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

/**
 * Dropdown rendered in a portal so it never gets clipped by
 * the table container's overflow-hidden.
 * Exposes its DOM node via `portalRef` so the parent can include it
 * in the click-outside check.
 */
function DropdownPortal({
  anchorRef,
  portalRef,
  onClose,
  children,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  portalRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 6,
      left: rect.right + window.scrollX - 224, // 224 = w-56
    });
  }, [anchorRef]);

  // Close on scroll/resize so it doesn't get stale
  React.useEffect(() => {
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  if (!pos) return null;

  return ReactDOM.createPortal(
    <div
      ref={portalRef as React.RefObject<HTMLDivElement>}
      role="menu"
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[9999] w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
    >
      {children}
    </div>,
    document.body
  );
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
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const portalRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      // Keep open if click is inside the trigger button OR inside the portal dropdown
      if (rootRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
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
          body: JSON.stringify({ templateId }),
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
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={btnRef}
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

      {open && (
        <DropdownPortal anchorRef={btnRef} portalRef={portalRef} onClose={() => setOpen(false)}>
          <div className="p-2">
            {/* Copiar link */}
            <button
              type="button"
              role="menuitem"
              disabled={!canCopy}
              onClick={onCopyLink}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
                canCopy
                  ? "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
              )}
            >
              {canCopy ? (
                <ClipboardCopy className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Copiar link
            </button>

            {/* Abrir link */}
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
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
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
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
              )}
            >
              <RotateCcw className="h-4 w-4" />
              {busy ? "Reenviando..." : "Reenviar assessment"}
            </button>

            {/* Ver resultados */}
            {canResults && (
              <>
                <div className="my-2 h-px bg-zinc-100 dark:bg-zinc-800" />
                <Link
                  role="menuitem"
                  href={resultsUrl!}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  <FileText className="h-4 w-4" />
                  Ver resultados
                </Link>
              </>
            )}
          </div>
        </DropdownPortal>
      )}
    </div>
  );
}
