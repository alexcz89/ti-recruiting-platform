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
      state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
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
  template?: { id?: string; title?: string; timeLimit?: number | null };
  invite?: {
    id?: string;
    token?: string;
    status?: string;
    expiresAt?: string | null;
  };
  attempt?: { id?: string; status?: string } | null;
  inviteUrl?: string;
  emailStatus?: "sent" | "skipped" | "failed";
  emailError?: string | null;
  meta?: { reusedInvite?: boolean; createdInvite?: boolean };
  error?: string;
  code?: string;
};

type AvailableAssessment = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  difficulty: string;
  totalQuestions: number;
  timeLimit?: number | null;
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
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [availableAssessments, setAvailableAssessments] = useState<
    AvailableAssessment[]
  >([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const buildInviteUrl = (templateId: string, token: string) => {
    const origin = window.location.origin;
    return `${origin}/assessments/${encodeURIComponent(
      templateId
    )}?token=${encodeURIComponent(token)}`;
  };

  const showCopyFallback = (url: string) => {
    toastSuccess("No se pudo copiar automáticamente");
    window.prompt("Copia este link:", url);
  };

  const toastInviteResult = (data: InviteResponse, mode: "send" | "resend") => {
    const status = data?.emailStatus;

    if (status === "sent") {
      return toastSuccess(
        mode === "resend"
          ? "Invitación reenviada por correo ✅"
          : "Invitación enviada por correo ✅"
      );
    }

    if (status === "failed") {
      return toastError(
        data?.emailError ||
          "No se pudo enviar el correo (pero el link sí fue generado)."
      );
    }

    if (status === "skipped") {
      return toastSuccess("Invitación lista ✅ (no se envió correo)");
    }

    return toastSuccess("Invitación lista ✅");
  };

  const fetchAvailableAssessments = async () => {
    setLoadingAssessments(true);
    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/assessments`
      );
      if (!res.ok) throw new Error("No se pudieron cargar los assessments");

      const data = await res.json();
      const items = Array.isArray(data?.assessments) ? data.assessments : [];
      setAvailableAssessments(items);
      return items as AvailableAssessment[];
    } catch (err: any) {
      console.error(err);
      toastError(err?.message || "Error al cargar assessments");
      return [] as AvailableAssessment[];
    } finally {
      setLoadingAssessments(false);
    }
  };

  const sendAssessmentInvite = async (
    templateId: string,
    mode: "send" | "resend"
  ) => {
    try {
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
        if (res.status === 402 || data?.code === "NO_CREDITS") {
          throw new Error("No tienes créditos para enviar assessments");
        }
        throw new Error(data?.error || "No se pudo generar la invitación");
      }

      const inviteUrl =
        (typeof data?.inviteUrl === "string" && data.inviteUrl) ||
        (data?.template?.id && data?.invite?.token
          ? buildInviteUrl(String(data.template.id), String(data.invite.token))
          : "");

      if (!inviteUrl) {
        throw new Error("Respuesta inválida: falta inviteUrl/token");
      }

      const copied = await copyToClipboard(inviteUrl);
      toastInviteResult(data, mode);
      if (!copied) showCopyFallback(inviteUrl);

      router.refresh();
      setShowAssessmentModal(false);
    } catch (err: any) {
      console.error(err);
      toastError(err?.message || "No se pudo enviar el assessment");
    }
  };

  const handleSendAssessment = async () => {
    startTransition(async () => {
      if (assessment?.enabled && assessment.templateId) {
        const mode =
          assessment.state === "EXPIRED" ? "resend" : "send";
        await sendAssessmentInvite(assessment.templateId, mode);
        return;
      }

      const assessments = await fetchAvailableAssessments();
      if (assessments.length === 0) {
        toastError("Este job no tiene assessments configurados");
        return;
      }

      if (assessments.length === 1) {
        await sendAssessmentInvite(assessments[0].id, "send");
        return;
      }

      setShowAssessmentModal(true);
    });
  };

  const handleAssessmentAction = () => {
    if (!assessment || !assessment.enabled) {
      handleSendAssessment();
      return;
    }

    if (assessment.state === "COMPLETED" && assessment.attemptId) {
      window.open(
        `/dashboard/assessments/attempts/${encodeURIComponent(
          assessment.attemptId
        )}/results`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    if (
      (assessment.state === "SENT" || assessment.state === "STARTED") &&
      assessment.token
    ) {
      startTransition(async () => {
        const url = buildInviteUrl(
          assessment.templateId,
          String(assessment.token)
        );
        const ok = await copyToClipboard(url);
        if (ok) {
          toastSuccess("Link de assessment copiado ✅");
        } else {
          showCopyFallback(url);
        }
      });
      return;
    }

    handleSendAssessment();
  };

  const handleDelete = () => {
    const ok = window.confirm(
      "¿Eliminar esta postulación? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/applications/${encodeURIComponent(applicationId)}`,
          {
            method: "DELETE",
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "No se pudo eliminar la postulación");
        }

        toastSuccess("Postulación eliminada");
        window.location.reload();
      } catch (err: any) {
        console.error(err);
        toastError(err?.message || "No se pudo eliminar la postulación");
      }
    });
  };

  const handleSendWhatsApp = () => {
    if (!candidatePhone) {
      return toastError(
        "Este candidato no tiene número de WhatsApp registrado."
      );
    }

    let digits = candidatePhone.replace(/\D/g, "");
    if (!digits) return toastError("Número de WhatsApp inválido.");

    if (digits.length === 10) digits = `52${digits}`;
    if (digits.length === 13 && digits.startsWith("521")) {
      digits = `52${digits.slice(3)}`;
    }

    if (digits.startsWith("52") && digits.length !== 12) {
      return toastError(
        "Número de WhatsApp inválido (MX debe ser 10 dígitos)."
      );
    }

    const baseMessage = `Hola, vi tu postulación${
      candidateEmail ? ` registrada con el correo ${candidateEmail}` : ""
    } y me gustaría platicar contigo.`;

    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(baseMessage)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleOpenResume = () => {
    if (!resumeUrl) {
      return toastError("Este candidato no tiene CV adjunto");
    }
    window.open(resumeUrl, "_blank", "noopener,noreferrer");
  };

  const assessmentLabel = (() => {
    if (!assessment || !assessment.enabled) return "Enviar assessment";
    if (assessment.state === "COMPLETED") return "Ver resultados del assessment";
    if (assessment.state === "SENT") return "Assessment enviado · Copiar link";
    if (assessment.state === "STARTED") return "Assessment en progreso · Copiar link";
    if (assessment.state === "EXPIRED") return "Reenviar assessment";
    return "Enviar assessment";
  })();

  const AssessmentIcon = (() => {
    if (!assessment || !assessment.enabled) return Send;
    if (assessment.state === "COMPLETED") return CheckCircle2;
    if (assessment.state === "SENT") return Clock;
    if (assessment.state === "STARTED") return ClipboardCopy;
    if (assessment.state === "EXPIRED") return RotateCcw;
    return Send;
  })();

  // Color del ícono de assessment según estado
  const assessmentIconColor = (() => {
    if (!assessment?.enabled || assessment.state === "NONE")
      return "bg-violet-50 text-violet-600 group-hover:bg-violet-100 group-hover:text-violet-700 dark:bg-violet-500/10 dark:text-violet-300 dark:group-hover:bg-violet-500/20";
    if (assessment.state === "COMPLETED")
      return "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
    if (assessment.state === "SENT")
      return "bg-blue-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
    if (assessment.state === "STARTED")
      return "bg-sky-50 text-sky-600 group-hover:bg-sky-100 group-hover:text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
    if (assessment.state === "EXPIRED")
      return "bg-amber-50 text-amber-600 group-hover:bg-amber-100 group-hover:text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
    return "bg-violet-50 text-violet-600 group-hover:bg-violet-100 group-hover:text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
  })();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          aria-label="Acciones de la postulación"
          className="
            inline-flex h-8 w-8 items-center justify-center
            rounded-full border border-zinc-200 bg-white
            text-zinc-500 shadow-sm transition-all
            hover:bg-zinc-100 hover:text-zinc-800 hover:border-zinc-300
            active:scale-[0.96]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50
            disabled:opacity-60
            dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400
            dark:hover:bg-zinc-800 dark:hover:text-zinc-100
          "
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="
            min-w-[220px] rounded-xl border border-zinc-200
            bg-white p-1 shadow-xl
            dark:border-zinc-700/80 dark:bg-zinc-900
          "
        >
          <DropdownMenuItem
            onClick={handleAssessmentAction}
            disabled={pending}
            className="
              group flex cursor-pointer items-center gap-2.5 rounded-lg
              px-3 py-2.5 text-sm min-h-[44px]
              text-zinc-800 hover:bg-zinc-50
              disabled:cursor-not-allowed disabled:opacity-60
              dark:text-zinc-100 dark:hover:bg-zinc-800/80
            "
          >
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${assessmentIconColor}`}
            >
              <AssessmentIcon className="h-3.5 w-3.5" />
            </span>
            <span>{assessmentLabel}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleOpenResume}
            disabled={pending || !resumeUrl}
            className="
              group flex cursor-pointer items-center gap-2.5 rounded-lg
              px-3 py-2.5 text-sm min-h-[44px]
              text-zinc-800 hover:bg-zinc-50
              disabled:cursor-not-allowed disabled:opacity-60
              dark:text-zinc-100 dark:hover:bg-zinc-800/80
            "
          >
            <span
              className="
                inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                bg-emerald-50 text-emerald-600
                group-hover:bg-emerald-100 group-hover:text-emerald-700
                dark:bg-emerald-500/10 dark:text-emerald-300
                dark:group-hover:bg-emerald-500/20
              "
            >
              <FileText className="h-3.5 w-3.5" />
            </span>
            <span>Ver CV</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleSendWhatsApp}
            disabled={pending || !candidatePhone}
            className="
              group flex cursor-pointer items-center gap-2.5 rounded-lg
              px-3 py-2.5 text-sm min-h-[44px]
              text-zinc-800 hover:bg-zinc-50
              disabled:cursor-not-allowed disabled:opacity-60
              dark:text-zinc-100 dark:hover:bg-zinc-800/80
            "
          >
            <span
              className="
                inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                bg-green-50 text-green-600
                group-hover:bg-green-100 group-hover:text-green-700
                dark:bg-green-500/10 dark:text-green-300
                dark:group-hover:bg-green-500/20
              "
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </span>
            <span>WhatsApp</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleDelete}
            disabled={pending}
            className="
              group flex cursor-pointer items-center gap-2.5 rounded-lg
              px-3 py-2.5 text-sm min-h-[44px]
              text-red-700 hover:bg-red-50
              disabled:cursor-not-allowed disabled:opacity-60
              dark:text-red-300 dark:hover:bg-red-950/40
            "
          >
            <span
              className="
                inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                bg-red-50 text-red-600
                group-hover:bg-red-100 group-hover:text-red-700
                dark:bg-red-500/10 dark:text-red-300
                dark:group-hover:bg-red-500/20
              "
            >
              <Trash2 className="h-3.5 w-3.5" />
            </span>
            <span>Eliminar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Seleccionar assessment
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Este job tiene múltiples assessments configurados.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAssessmentModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {loadingAssessments ? (
                <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Cargando assessments...
                </div>
              ) : availableAssessments.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No hay assessments disponibles.
                </div>
              ) : (
                <div className="space-y-2">
                  {availableAssessments.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          await sendAssessmentInvite(item.id, "send");
                        });
                      }}
                      className="
                        w-full rounded-xl border border-zinc-200 bg-white p-3 text-left
                        transition hover:border-violet-300 hover:bg-violet-50/40
                        disabled:opacity-60
                        dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-700 dark:hover:bg-violet-950/20
                      "
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {item.title}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                              {item.type}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                              {item.difficulty}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                              {item.totalQuestions} preguntas
                            </span>
                            {item.timeLimit ? (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                                {item.timeLimit} min
                              </span>
                            ) : null}
                          </div>

                          {item.description ? (
                            <p className="mt-2 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">
                              {item.description}
                            </p>
                          ) : null}
                        </div>

                        <span className="inline-flex shrink-0 items-center rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white">
                          Enviar
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAssessmentModal(false)}
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}