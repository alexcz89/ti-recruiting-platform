// app/dashboard/jobs/[id]/applications/ActionsMenu.tsx
"use client";

import { useTransition } from "react";
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

export default function ActionsMenu(props: Props) {
  const { applicationId, resumeUrl, candidateEmail, candidatePhone, assessment } = props;

  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

    // NONE o EXPIRED -> generar/reusar invite vía API y copiar
    startTransition(async () => {
      try {
        const body: Record<string, any> = {};
        if (assessment?.templateId) body.templateId = assessment.templateId;

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
      } catch (err: any) {
        console.error(err);
        toastError(err?.message || "No se pudo enviar el assessment");
      }
    });
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

    // Si viene en formato local MX (10 dígitos), asumir 52
    if (digits.length === 10) digits = `52${digits}`;

    // Si viene como 521XXXXXXXXXX (viejo “1” móvil), convertir a 52XXXXXXXXXX
    if (digits.length === 13 && digits.startsWith("521")) digits = `52${digits.slice(3)}`;

    // Validación básica para MX
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
        {/* Assessment (solo lo manda el reclutador desde aquí) */}
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
  );
}
