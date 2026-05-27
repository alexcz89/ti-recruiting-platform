// components/dashboard/SendAssessmentButton.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  ClipboardCopy,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { toastSuccess, toastError } from "@/lib/ui/toast";

export type AssessmentState = {
  applicationId: string;
  templateId: string;
  templateTitle: string;
  state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
  attemptId: string | null;
  token: string | null;
  score: number | null;
};

type Props = {
  applicationId: string;
  /** Un solo assessment (retrocompatible) O un array de assessments */
  assessment?: AssessmentState;
  assessments?: AssessmentState[];
};

type InviteResponse = {
  template?: { id?: string };
  invite?: { token?: string };
  inviteUrl?: string;
  emailStatus?: "sent" | "skipped" | "failed";
  emailError?: string | null;
  error?: string;
  code?: string;
};

function buildInviteUrl(templateId: string, token: string) {
  const origin = window.location.origin;
  return `${origin}/assessments/${encodeURIComponent(templateId)}?token=${encodeURIComponent(token)}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── Botón para UN solo assessment ────────────────────────────────────────────
function SingleAssessmentButton({
  a,
  label,
}: {
  a: AssessmentState;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleAction = () => {
    startTransition(async () => {
      if (a.state === "COMPLETED" && a.attemptId) {
        window.open(
          `/dashboard/assessments/attempts/${a.attemptId}/results`,
          "_blank",
          "noopener,noreferrer"
        );
        return;
      }

      if ((a.state === "SENT" || a.state === "STARTED") && a.token) {
        const url = buildInviteUrl(a.templateId, a.token);
        const ok = await copyToClipboard(url);
        if (ok) toastSuccess("Link copiado ✅");
        else window.prompt("Copia este link:", url);
        return;
      }

      try {
        const res = await fetch(
          `/api/applications/${encodeURIComponent(a.applicationId)}/assessment-invite`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateId: a.templateId }),
          }
        );
        const data = (await res.json().catch(() => ({}))) as InviteResponse;
        if (!res.ok) {
          if (res.status === 402 || data?.code === "NO_CREDITS")
            throw new Error("No tienes créditos para enviar assessments");
          throw new Error(data?.error || "No se pudo generar la invitación");
        }

        const inviteUrl =
          (typeof data?.inviteUrl === "string" && data.inviteUrl) ||
          (data?.template?.id && data?.invite?.token
            ? buildInviteUrl(String(data.template.id), String(data.invite.token))
            : "");
        if (!inviteUrl) throw new Error("Respuesta inválida: falta inviteUrl");

        const emailStatus = data?.emailStatus;
        if (emailStatus === "sent") toastSuccess("Invitación enviada por correo ✅");
        else if (emailStatus === "failed")
          toastError(data?.emailError || "No se pudo enviar el correo, pero el link fue generado.");
        else toastSuccess("Invitación lista ✅");

        const ok = await copyToClipboard(inviteUrl);
        if (!ok) window.prompt("Copia este link:", inviteUrl);

        router.refresh();
      } catch (err: any) {
        toastError(err?.message || "No se pudo enviar el assessment");
      }
    });
  };

  const { buttonLabel, Icon, cls } = (() => {
    switch (a.state) {
      case "COMPLETED":
        return {
          buttonLabel: label ?? `Ver resultados${a.score != null ? ` (${a.score}%)` : ""}`,
          Icon: CheckCircle2,
          cls: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
        };
      case "SENT":
        return {
          buttonLabel: label ?? "Copiar link",
          Icon: ClipboardCopy,
          cls: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
        };
      case "STARTED":
        return {
          buttonLabel: label ?? "Copiar link (en progreso)",
          Icon: ClipboardCopy,
          cls: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
        };
      case "EXPIRED":
        return {
          buttonLabel: label ?? "Reenviar assessment",
          Icon: RotateCcw,
          cls: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
        };
      default:
        return {
          buttonLabel: label ?? "Enviar assessment",
          Icon: Send,
          cls: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
        };
    }
  })();

  return (
    <button
      type="button"
      onClick={handleAction}
      disabled={pending}
      className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition disabled:opacity-60 ${cls}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{pending ? "..." : buttonLabel}</span>
    </button>
  );
}

// ── Ítem del dropdown ─────────────────────────────────────────────────────────
function DropdownItem({
  a,
  onClose,
}: {
  a: AssessmentState;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const stateBadge: Record<string, { label: string; cls: string }> = {
    NONE:      { label: "Sin enviar",   cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
    SENT:      { label: "Enviado",      cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
    STARTED:   { label: "En progreso",  cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
    COMPLETED: { label: a.score != null ? `Completado · ${a.score}%` : "Completado", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    EXPIRED:   { label: "Expirado",     cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  };

  const badge = stateBadge[a.state] ?? stateBadge.NONE;

  const handleClick = () => {
    onClose();
    startTransition(async () => {
      if (a.state === "COMPLETED" && a.attemptId) {
        window.open(
          `/dashboard/assessments/attempts/${a.attemptId}/results`,
          "_blank",
          "noopener,noreferrer"
        );
        return;
      }

      if ((a.state === "SENT" || a.state === "STARTED") && a.token) {
        const url = buildInviteUrl(a.templateId, a.token);
        const ok = await copyToClipboard(url);
        if (ok) toastSuccess(`Link copiado: ${a.templateTitle} ✅`);
        else window.prompt("Copia este link:", url);
        return;
      }

      try {
        const res = await fetch(
          `/api/applications/${encodeURIComponent(a.applicationId)}/assessment-invite`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateId: a.templateId }),
          }
        );
        const data = (await res.json().catch(() => ({}))) as InviteResponse;
        if (!res.ok) {
          if (res.status === 402 || data?.code === "NO_CREDITS")
            throw new Error("No tienes créditos para enviar assessments");
          throw new Error(data?.error || "No se pudo generar la invitación");
        }

        const inviteUrl =
          (typeof data?.inviteUrl === "string" && data.inviteUrl) ||
          (data?.template?.id && data?.invite?.token
            ? buildInviteUrl(String(data.template.id), String(data.invite.token))
            : "");
        if (!inviteUrl) throw new Error("Respuesta inválida: falta inviteUrl");

        const emailStatus = data?.emailStatus;
        if (emailStatus === "sent")
          toastSuccess(`Assessment "${a.templateTitle}" enviado por correo ✅`);
        else if (emailStatus === "failed")
          toastError(data?.emailError || "No se pudo enviar el correo, pero el link fue generado.");
        else toastSuccess(`Invitación lista: ${a.templateTitle} ✅`);

        const ok = await copyToClipboard(inviteUrl);
        if (!ok) window.prompt("Copia este link:", inviteUrl);

        router.refresh();
      } catch (err: any) {
        toastError(err?.message || "No se pudo enviar el assessment");
      }
    });
  };

  const actionLabel = () => {
    if (a.state === "COMPLETED") return "Ver resultados";
    if (a.state === "SENT" || a.state === "STARTED") return "Copiar link";
    if (a.state === "EXPIRED") return "Reenviar";
    return "Enviar";
  };

  const ActionIcon = () => {
    if (a.state === "COMPLETED") return <ExternalLink className="h-3.5 w-3.5" />;
    if (a.state === "SENT" || a.state === "STARTED") return <ClipboardCopy className="h-3.5 w-3.5" />;
    if (a.state === "EXPIRED") return <RotateCcw className="h-3.5 w-3.5" />;
    return <Send className="h-3.5 w-3.5" />;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60 disabled:opacity-50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {a.templateTitle}
        </p>
        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      <span className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${
        pending ? "text-zinc-400" : "text-violet-600 dark:text-violet-400"
      }`}>
        {pending ? "..." : <><ActionIcon />{actionLabel()}</>}
      </span>
    </button>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SendAssessmentButton({
  applicationId,
  assessment,
  assessments,
}: Props) {
  const list: AssessmentState[] = assessments ?? (assessment ? [assessment] : []);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra el dropdown al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (list.length === 0) return null;

  // Un solo assessment → botón simple (retrocompatible)
  if (list.length === 1) {
    return <SingleAssessmentButton a={list[0]} />;
  }

  // Múltiples assessments → dropdown
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40"
      >
        <Send className="h-4 w-4 shrink-0" />
        <span>Enviar assessment</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Selecciona un assessment
            </p>
          </div>
          <div className="divide-y divide-zinc-100 p-1 dark:divide-zinc-800">
            {list.map((a) => (
              <DropdownItem key={a.templateId} a={a} onClose={() => setOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
