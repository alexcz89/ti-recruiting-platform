// app/dashboard/jobs/[id]/applications/ActionsMenu.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import {
  MoreHorizontal,
  FileText,
  MessageCircle,
  Trash2,
  Send,
  ClipboardCopy,
  CheckCircle2,
  RotateCcw,
  Clock,
  X,
  ClipboardCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type AssessmentMeta =
  | { enabled: false }
  | {
      enabled: true;
      templateId: string;
      templateIds?: string[];
      templateTitles?: Record<string, string>;
      state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
      perTemplateState?: Array<{
        templateId: string;
        title: string;
        state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
        token: string | null;
        attemptId: string | null;
        score: number | null;
      }>;
      token?: string | null;
      attemptId?: string | null;
    };

type Props = {
  applicationId: string;
  jobId: string;
  candidateHref?: string;
  resumeUrl?: string | null;
  candidateEmail: string;
  candidatePhone?: string | null;
  assessment?: AssessmentMeta;
};

type InviteResponse = {
  ok?: boolean;
  template?: { id?: string; title?: string };
  invite?: { token?: string };
  inviteUrl?: string;
  emailStatus?: "sent" | "skipped" | "failed";
  emailError?: string | null;
  error?: string;
  code?: string;
};

export default function ActionsMenu(props: Props) {
  const {
    applicationId,
    jobId,
    resumeUrl,
    candidateEmail,
    candidatePhone,
    assessment,
  } = props;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);

  // Todos los templateIds del job
  const allTemplateIds: string[] =
    assessment?.enabled && assessment.templateIds?.length
      ? assessment.templateIds
      : assessment?.enabled && assessment.templateId
      ? [assessment.templateId]
      : [];

  const templateTitles: Record<string, string> =
    (assessment?.enabled && assessment.templateTitles) || {};

  const assessmentCount = allTemplateIds.length;

  // Estados individuales por template
  const perTemplateState = assessment?.enabled
    ? (assessment.perTemplateState ?? [])
    : [];

  const completedTemplates = perTemplateState.filter(t => t.state === "COMPLETED");
  const hasMultipleCompleted = completedTemplates.length > 1;

  // Estado del primero para derivar el label global
  const assessmentState = assessment?.enabled ? assessment.state : "NONE";

  // ── Helpers ──────────────────────────────────────────────────────────────
  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };

  const buildInviteUrl = (templateId: string, token: string) =>
    `${window.location.origin}/assessments/${encodeURIComponent(templateId)}?token=${encodeURIComponent(token)}`;

  const sendInvite = async (templateId: string) => {
    const res = await fetch(
      `/api/applications/${encodeURIComponent(applicationId)}/assessment-invite`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      }
    );
    const data = (await res.json().catch(() => ({}))) as InviteResponse;

    if (!res.ok) {
      if (res.status === 402 || data?.code === "NO_CREDITS")
        throw new Error("Sin créditos para enviar assessments");
      throw new Error(data?.error || "No se pudo generar la invitación");
    }

    const inviteUrl =
      (typeof data?.inviteUrl === "string" && data.inviteUrl) ||
      (data?.template?.id && data?.invite?.token
        ? buildInviteUrl(String(data.template.id), String(data.invite.token))
        : "");

    if (!inviteUrl) throw new Error("Respuesta inválida: falta inviteUrl");

    const copied = await copyToClipboard(inviteUrl);
    if (data?.emailStatus === "sent") {
      toastSuccess("Invitación enviada por correo ✅");
    } else if (data?.emailStatus === "failed") {
      toastError(data?.emailError || "No se pudo enviar el correo");
    } else {
      toastSuccess("Invitación lista ✅");
    }
    if (!copied) window.prompt("Copia este link:", inviteUrl);
  };

  // ── Acción principal del assessment ──────────────────────────────────────
  const handleAssessmentAction = () => {
    // Ver resultados
    if (assessment?.enabled && assessmentState === "COMPLETED" && assessment.attemptId) {
      window.open(
        `/dashboard/assessments/attempts/${encodeURIComponent(assessment.attemptId)}/results`,
        "_blank", "noopener,noreferrer"
      );
      return;
    }

    // Copiar link (ya enviado)
    if (
      assessment?.enabled &&
      (assessmentState === "SENT" || assessmentState === "STARTED") &&
      assessment.token
    ) {
      startTransition(async () => {
        const url = buildInviteUrl(assessment.templateId, String(assessment.token));
        const ok = await copyToClipboard(url);
        if (ok) toastSuccess("Link copiado ✅");
        else window.prompt("Copia este link:", url);
      });
      return;
    }

    // Sin assessments
    if (assessmentCount === 0) {
      toastError("Este job no tiene assessments configurados");
      return;
    }

    // Un solo assessment — enviar directo
    if (assessmentCount === 1) {
      startTransition(async () => {
        try {
          await sendInvite(allTemplateIds[0]);
          router.refresh();
        } catch (err: any) {
          toastError(err?.message || "No se pudo enviar");
        }
      });
      return;
    }

    // Múltiples — abrir modal de selección
    setShowModal(true);
  };

  const handleDelete = () => {
    if (!window.confirm("¿Eliminar esta postulación? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await res.text().catch(() => ""));
        toastSuccess("Postulación eliminada");
        window.location.reload();
      } catch (err: any) {
        toastError(err?.message || "No se pudo eliminar");
      }
    });
  };

  const handleOpenResume = () => {
    if (!resumeUrl) return toastError("Este candidato no tiene CV adjunto");
    window.open(resumeUrl, "_blank", "noopener,noreferrer");
  };

  const handleWhatsApp = () => {
    if (!candidatePhone) return toastError("Este candidato no tiene WhatsApp registrado");
    let digits = candidatePhone.replace(/\D/g, "");
    if (digits.length === 10) digits = `52${digits}`;
    if (digits.length === 13 && digits.startsWith("521")) digits = `52${digits.slice(3)}`;
    if (digits.startsWith("52") && digits.length !== 12)
      return toastError("Número de WhatsApp inválido");
    const msg = `Hola, vi tu postulación${candidateEmail ? ` registrada con el correo ${candidateEmail}` : ""} y me gustaría platicar contigo.`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  // ── Labels e íconos ───────────────────────────────────────────────────────
  const { label: assessmentLabel, Icon: AssessmentIcon, iconColor } = (() => {
    if (assessmentState === "COMPLETED")
      return { label: "Ver resultados", Icon: CheckCircle2,
        iconColor: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400" };
    if (assessmentState === "SENT")
      return { label: "Enviado · Copiar link", Icon: Clock,
        iconColor: "bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400" };
    if (assessmentState === "STARTED")
      return { label: "En progreso · Copiar link", Icon: ClipboardCopy,
        iconColor: "bg-sky-50 text-sky-600 group-hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-400" };
    if (assessmentState === "EXPIRED")
      return { label: "Reenviar evaluación", Icon: RotateCcw,
        iconColor: "bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400" };
    // NONE
    if (assessmentCount === 0)
      return { label: "Sin evaluaciones asignadas", Icon: ClipboardCheck,
        iconColor: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500" };
    if (assessmentCount === 1)
      return { label: "Enviar evaluación", Icon: Send,
        iconColor: "bg-violet-50 text-violet-600 group-hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-400" };
    return { label: `Enviar evaluaciones (${assessmentCount})`, Icon: Send,
      iconColor: "bg-violet-50 text-violet-600 group-hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-400" };
  })();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          aria-label="Acciones de la postulación"
          className="
            inline-flex h-7 w-7 items-center justify-center
            rounded-full border border-zinc-200/80 bg-white
            text-zinc-500 shadow-sm transition-all
            hover:bg-zinc-100 hover:text-zinc-700 hover:border-zinc-300
            active:scale-[0.96]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40
            disabled:opacity-60
            dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400
            dark:hover:bg-zinc-800 dark:hover:text-zinc-100
          "
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="min-w-[200px] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700/80 dark:bg-zinc-900"
        >
          {/* Assessment — un item por template completado, o acción global si no */}
          {hasMultipleCompleted ? (
            <>
              {completedTemplates.map((t) => (
                <DropdownMenuItem
                  key={t.templateId}
                  onClick={() => {
                    if (t.attemptId) {
                      window.open(
                        `/dashboard/assessments/attempts/${encodeURIComponent(t.attemptId)}/results`,
                        "_blank", "noopener,noreferrer"
                      );
                    }
                  }}
                  className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                  <span className="truncate max-w-[140px]" title={t.title}>
                    {t.title.length > 22 ? t.title.slice(0, 22) + "…" : t.title}
                    {typeof t.score === "number" && (
                      <span className="ml-1 font-semibold text-emerald-700 dark:text-emerald-400">
                        {t.score}%
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
              {/* Evaluaciones pendientes */}
              {perTemplateState.filter(t => t.state !== "COMPLETED").map((t) => (
                <DropdownMenuItem
                  key={t.templateId}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await sendInvite(t.templateId);
                        router.refresh();
                      } catch (err: any) {
                        toastError(err?.message || "No se pudo enviar");
                      }
                    });
                  }}
                  disabled={pending || t.state === "SENT" || t.state === "STARTED"}
                  className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                    <Send className="h-3 w-3" />
                  </span>
                  <span className="truncate max-w-[140px]" title={t.title}>
                    {t.state === "SENT" ? "Enviado: " : t.state === "STARTED" ? "En progreso: " : "Enviar: "}
                    {t.title.length > 18 ? t.title.slice(0, 18) + "…" : t.title}
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          ) : (
            <DropdownMenuItem
              onClick={handleAssessmentAction}
              disabled={pending || assessmentCount === 0}
              className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
            >
              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${iconColor}`}>
                <AssessmentIcon className="h-3 w-3" />
              </span>
              <span>{pending ? "..." : assessmentLabel}</span>
            </DropdownMenuItem>
          )}

          {/* Ver CV */}
          <DropdownMenuItem
            onClick={handleOpenResume}
            disabled={pending || !resumeUrl}
            className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400">
              <FileText className="h-3 w-3" />
            </span>
            <span>Ver CV</span>
          </DropdownMenuItem>

          {/* WhatsApp */}
          <DropdownMenuItem
            onClick={handleWhatsApp}
            disabled={pending || !candidatePhone}
            className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600 group-hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400">
              <MessageCircle className="h-3 w-3" />
            </span>
            <span>WhatsApp</span>
          </DropdownMenuItem>

          {/* Eliminar */}
          <DropdownMenuItem
            onClick={handleDelete}
            disabled={pending}
            className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 group-hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400">
              <Trash2 className="h-3 w-3" />
            </span>
            <span>Eliminar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Modal de selección múltiple ─────────────────────────────────── */}
      {showModal && (
        <MultiAssessmentModal
          applicationId={applicationId}
          templateIds={allTemplateIds}
          templateTitles={templateTitles}
          onClose={() => setShowModal(false)}
          onSent={() => { setShowModal(false); router.refresh(); }}
          sendInvite={sendInvite}
        />
      )}
    </>
  );
}

// ── Modal de selección con todos pre-seleccionados ────────────────────────────
function MultiAssessmentModal({
  applicationId,
  templateIds,
  templateTitles,
  onClose,
  onSent,
  sendInvite,
}: {
  applicationId: string;
  templateIds: string[];
  templateTitles: Record<string, string>;
  onClose: () => void;
  onSent: () => void;
  sendInvite: (templateId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(templateIds));
  const [sending, setSending] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      toastError("Selecciona al menos una evaluación");
      return;
    }
    setSending(true);
    let ok = 0;
    for (const id of selected) {
      try {
        await sendInvite(id);
        ok++;
      } catch (err: any) {
        toastError(`Error en "${templateTitles[id] ?? id}": ${err?.message}`);
      }
    }
    setSending(false);
    if (ok > 0) onSent();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Enviar evaluaciones
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Selecciona cuáles enviar — todas marcadas por defecto
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lista con checkboxes */}
        <div className="p-4 space-y-2">
          {templateIds.map(id => {
            const title = templateTitles[id] ?? id;
            const isChecked = selected.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                  isChecked
                    ? "border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/20"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {/* Checkbox visual */}
                <div className={`h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                  isChecked
                    ? "border-violet-500 bg-violet-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}>
                  {isChecked && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <span className="text-xs text-zinc-400">
            {selected.size} de {templateIds.length} seleccionada{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {sending ? "Enviando..." : `Enviar ${selected.size > 1 ? `(${selected.size})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}