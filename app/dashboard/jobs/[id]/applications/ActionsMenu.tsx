// app/dashboard/jobs/[id]/applications/ActionsMenu.tsx
"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";
import {
  MoreHorizontal,
  FileText,
  MessageCircle,
  Trash2,
  Send,
  ClipboardCopy,
  CheckCircle2,
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
  jobId: string; // 🆕 Necesario para obtener assessments del job
  candidateHref?: string;
  resumeUrl?: string | null;
  candidateEmail: string;
  candidatePhone?: string | null;
  assessment?: AssessmentMeta;
};

type InviteResponse = {
  ok?: boolean;
  template?: { id?: string; title?: string; timeLimit?: number | null };
  invite?: { id?: string; token?: string; status?: string; expiresAt?: string | null };
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
  const { applicationId, jobId, resumeUrl, candidateEmail, candidatePhone, assessment } = props;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [availableAssessments, setAvailableAssessments] = useState<AvailableAssessment[]>([]);
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
    return `${origin}/assessments/${encodeURIComponent(templateId)}?token=${encodeURIComponent(token)}`;
  };

  const showCopyFallback = (url: string) => {
    toastSuccess("No se pudo copiar automáticamente");
    window.prompt("Copia este link:", url);
  };

  const toastInviteResult = (data: InviteResponse) => {
    const status = data?.emailStatus;

    if (status === "sent") return toastSuccess("Invitación enviada por correo ✅");

    if (status === "failed") {
      return toastError(data?.emailError || "No se pudo enviar el correo (pero el link sí fue generado).");
    }

    if (status === "skipped") return toastSuccess("Invitación lista ✅ (no se envió correo)");

    toastSuccess("Invitación lista ✅");
  };

  // 🆕 Obtener assessments disponibles del job
  const fetchAvailableAssessments = async () => {
    setLoadingAssessments(true);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/assessments`);
      
      if (!res.ok) {
        throw new Error('No se pudieron cargar los assessments');
      }

      const data = await res.json();
      setAvailableAssessments(data.assessments || []);
      return data.assessments || [];
    } catch (err: any) {
      console.error(err);
      toastError(err?.message || 'Error al cargar assessments');
      return [];
    } finally {
      setLoadingAssessments(false);
    }
  };

  // 🆕 Enviar assessment específico
  const sendAssessmentInvite = async (templateId: string) => {
    try {
      const body: Record<string, any> = { templateId };

      const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/assessment-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

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

      if (!inviteUrl) throw new Error("Respuesta inválida: falta inviteUrl/token");

      const ok = await copyToClipboard(inviteUrl);
      toastInviteResult(data);
      if (!ok) showCopyFallback(inviteUrl);

      router.refresh();
      setShowAssessmentModal(false);
    } catch (err: any) {
      console.error(err);
      toastError(err?.message || "No se pudo enviar el assessment");
    }
  };

  // 🆕 Handler mejorado para enviar assessment
  const handleSendAssessment = async () => {
    startTransition(async () => {
      // Obtener assessments disponibles
      const assessments = await fetchAvailableAssessments();

      if (assessments.length === 0) {
        toastError('Este job no tiene assessments configurados');
        return;
      }

      if (assessments.length === 1) {
        // Solo 1 assessment: enviar directamente
        await sendAssessmentInvite(assessments[0].id);
      } else {
        // Múltiples assessments: mostrar modal
        setShowAssessmentModal(true);
      }
    });
  };

  const handleAssessmentAction = () => {
    if (!assessment || !assessment.enabled) return;

    // COMPLETED -> abrir resultados
    if (assessment.state === "COMPLETED" && assessment.attemptId) {
      window.open(
        `/assessments/attempts/${encodeURIComponent(assessment.attemptId)}/results`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    // SENT/STARTED -> copiar link (sin regenerar)
    if ((assessment.state === "SENT" || assessment.state === "STARTED") && assessment.token) {
      startTransition(async () => {
        const url = buildInviteUrl(assessment.templateId, String(assessment.token));
        const ok = await copyToClipboard(url);
        if (ok) toastSuccess("Link de assessment copiado ✅");
        else showCopyFallback(url);
      });
      return;
    }

    // NONE o EXPIRED -> usar el nuevo handler
    handleSendAssessment();
  };

  const handleDelete = () => {
    const ok = window.confirm("¿Eliminar esta postulación? Esta acción no se puede deshacer.");
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
          method: "DELETE",
        });

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
    if (!candidatePhone) return toastError("Este candidato no tiene número de WhatsApp registrado.");

    let digits = candidatePhone.replace(/\D/g, "");
    if (!digits) return toastError("Número de WhatsApp inválido.");

    if (digits.length === 10) digits = `52${digits}`;
    if (digits.length === 13 && digits.startsWith("521")) digits = `52${digits.slice(3)}`;

    if (digits.startsWith("52") && digits.length !== 12) {
      return toastError("Número de WhatsApp inválido (MX debe ser 10 dígitos).");
    }

    const baseMessage = `Hola, vi tu postulación${
      candidateEmail ? ` registrada con el correo ${candidateEmail}` : ""
    } y me gustaría platicar contigo.`;

    const message = encodeURIComponent(baseMessage);
    const url = `https://wa.me/${digits}?text=${message}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOpenResume = () => {
    if (!resumeUrl) return toastError("Este candidato no tiene CV adjunto");
    window.open(resumeUrl, "_blank", "noopener,noreferrer");
  };

  const assessmentLabel = (() => {
    if (!assessment || !assessment.enabled) return null;
    if (assessment.state === "COMPLETED") return "Ver resultados";
    if (assessment.state === "SENT" || assessment.state === "STARTED") return "Copiar link de assessment";
    if (assessment.state === "EXPIRED") return "Reenviar assessment";
    return "Enviar assessment";
  })();

  const AssessmentIcon = (() => {
    if (!assessment || !assessment.enabled) return null;
    if (assessment.state === "COMPLETED") return CheckCircle2;
    if (assessment.state === "SENT" || assessment.state === "STARTED") return ClipboardCopy;
    return Send;
  })();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          aria-label="Acciones de la postulación"
          className="
            inline-flex h-7 w-7 items-center justify-center
            rounded-full border border-zinc-200/80 bg-white/85
            text-zinc-600 shadow-sm
            hover:bg-zinc-50 hover:text-zinc-800
            active:scale-[0.97]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70
            disabled:opacity-60
            dark:border-zinc-700/80 dark:bg-zinc-900/85 dark:text-zinc-300
            dark:hover:bg-zinc-800/80 dark:hover:text-zinc-50
          "
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="
            min-w-[160px] rounded-md border border-zinc-200/80
            bg-white/97 px-0.5 py-0 shadow-lg backdrop-blur-md
            dark:border-zinc-700/80 dark:bg-zinc-900/98
          "
        >
          {/* Assessment */}
          {assessment?.enabled && assessmentLabel && AssessmentIcon && (
            <DropdownMenuItem
              onClick={handleAssessmentAction}
              disabled={pending}
              className="
                group flex cursor-pointer items-center gap-1 rounded-[6px]
                px-1.5 py-0.5 text-[11px] leading-[1.05]
                text-zinc-800 hover:bg-zinc-50
                disabled:cursor-not-allowed disabled:opacity-60
                dark:text-zinc-100 dark:hover:bg-zinc-800/80
              "
            >
              <span
                className="
                  inline-flex h-5 w-5 items-center justify-center
                  rounded-full bg-violet-50 text-violet-600
                  group-hover:bg-violet-100 group-hover:text-violet-700
                  dark:bg-violet-500/10 dark:text-violet-300
                  dark:group-hover:bg-violet-500/20
                "
              >
                <AssessmentIcon className="h-3 w-3" />
              </span>
              <span>{assessmentLabel}</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={handleOpenResume}
            className="
              group flex cursor-pointer items-center gap-1 rounded-[6px]
              px-1.5 py-0.5 text-[11px] leading-[1.05]
              text-zinc-800 hover:bg-zinc-50
              dark:text-zinc-100 dark:hover:bg-zinc-800/80
            "
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
              <FileText className="h-3 w-3" />
            </span>
            <span>Descargar/Ver CV</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleSendWhatsApp}
            className="
              group flex cursor-pointer items-center gap-1 rounded-[6px]
              px-1.5 py-0.5 text-[11px] leading-[1.05]
              text-zinc-800 hover:bg-zinc-50
              dark:text-zinc-100 dark:hover:bg-zinc-800/80
            "
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <MessageCircle className="h-3 w-3" />
            </span>
            <span>Enviar WhatsApp</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleDelete}
            className="
              group flex cursor-pointer items-center gap-1 rounded-[6px]
              px-1.5 py-0.5 text-[11px] leading-[1.05]
              text-rose-600 hover:bg-rose-50/90 hover:text-rose-700
              dark:text-rose-400 dark:hover:bg-rose-500/15
            "
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              <Trash2 className="h-3 w-3" />
            </span>
            <span>Eliminar postulación</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 🆕 Modal de selección de assessment */}
      {showAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-700 bg-white p-6 shadow-xl dark:bg-zinc-900">
            <button
              onClick={() => setShowAssessmentModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">
              Selecciona una evaluación
            </h3>

            {loadingAssessments ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-violet-600"></div>
              </div>
            ) : availableAssessments.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                No hay assessments disponibles para este job
              </p>
            ) : (
              <div className="space-y-2">
                {availableAssessments.map((assess) => (
                  <button
                    key={assess.id}
                    onClick={() => {
                      startTransition(async () => {
                        await sendAssessmentInvite(assess.id);
                      });
                    }}
                    disabled={pending}
                    className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-violet-500 hover:bg-violet-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-violet-500 dark:hover:bg-violet-900/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-zinc-900 dark:text-white">
                          {assess.title}
                        </h4>
                        {assess.description && (
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {assess.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-700">
                            {assess.type}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-700">
                            {assess.difficulty}
                          </span>
                          <span>{assess.totalQuestions} preguntas</span>
                          {assess.timeLimit && <span>{assess.timeLimit} min</span>}
                        </div>
                      </div>
                      <Send className="ml-4 h-5 w-5 flex-shrink-0 text-violet-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}