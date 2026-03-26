// components/dashboard/SendAssessmentButton.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, ClipboardCopy, CheckCircle2, RotateCcw } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/ui/toast";

type AssessmentState = {
  applicationId: string;
  templateId: string;
  state: "NONE" | "SENT" | "STARTED" | "COMPLETED" | "EXPIRED";
  attemptId: string | null;
  token: string | null;
  score: number | null;
};

type Props = {
  applicationId: string;
  assessment: AssessmentState;
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

export default function SendAssessmentButton({
  applicationId,
  assessment,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const buildInviteUrl = (templateId: string, token: string) => {
    const origin = window.location.origin;
    return `${origin}/assessments/${encodeURIComponent(
      templateId
    )}?token=${encodeURIComponent(token)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleAction = () => {
    startTransition(async () => {
      if (assessment.state === "COMPLETED" && assessment.attemptId) {
        window.open(
          `/dashboard/assessments/attempts/${assessment.attemptId}/results`,
          "_blank",
          "noopener,noreferrer"
        );
        return;
      }

      if (
        (assessment.state === "SENT" || assessment.state === "STARTED") &&
        assessment.token
      ) {
        const url = buildInviteUrl(assessment.templateId, assessment.token);
        const ok = await copyToClipboard(url);

        if (ok) {
          toastSuccess("Link de assessment copiado ✅");
        } else {
          toastError("No se pudo copiar automáticamente");
          window.prompt("Copia este link:", url);
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/applications/${encodeURIComponent(
            applicationId
          )}/assessment-invite`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateId: assessment.templateId }),
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
          throw new Error("Respuesta inválida: falta inviteUrl");
        }

        const emailStatus = data?.emailStatus;
        if (emailStatus === "sent") {
          toastSuccess("Invitación enviada por correo ✅");
        } else if (emailStatus === "failed") {
          toastError(
            data?.emailError ||
              "No se pudo enviar el correo, pero el link fue generado."
          );
        } else {
          toastSuccess("Invitación lista ✅");
        }

        const ok = await copyToClipboard(inviteUrl);
        if (!ok) {
          window.prompt("Copia este link:", inviteUrl);
        }

        router.refresh();
      } catch (err: any) {
        toastError(err?.message || "No se pudo enviar el assessment");
      }
    });
  };

  const { label, Icon, variant } = (() => {
    switch (assessment.state) {
      case "COMPLETED":
        return {
          label: `Ver resultados${
            assessment.score != null ? ` (${assessment.score}%)` : ""
          }`,
          Icon: CheckCircle2,
          variant: "green",
        };
      case "SENT":
        return {
          label: "Copiar link",
          Icon: ClipboardCopy,
          variant: "violet",
        };
      case "STARTED":
        return {
          label: "Copiar link (en progreso)",
          Icon: ClipboardCopy,
          variant: "sky",
        };
      case "EXPIRED":
        return {
          label: "Reenviar assessment",
          Icon: RotateCcw,
          variant: "amber",
        };
      default:
        return {
          label: "Enviar assessment",
          Icon: Send,
          variant: "violet",
        };
    }
  })();

  const variantClasses: Record<string, string> = {
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
    sky:
      "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  };

  return (
    <button
      type="button"
      onClick={handleAction}
      disabled={pending}
      className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition disabled:opacity-60 ${variantClasses[variant]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{pending ? "..." : label}</span>
    </button>
  );
}