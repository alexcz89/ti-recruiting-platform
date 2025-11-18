// app/dashboard/jobs/[id]/applications/ActionsMenu.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal, User2, FileText, Mail, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type Props = {
  applicationId: string;
  candidateHref?: string;
  resumeUrl?: string | null;
  candidateEmail: string;
};

export default function ActionsMenu({
  applicationId,
  candidateHref,
  resumeUrl,
  candidateEmail,
}: Props) {
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    const ok = window.confirm(
      "¿Eliminar esta postulación? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "No se pudo eliminar la postulación");
        }

        toast.success("Postulación eliminada");
        window.location.reload();
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "No se pudo eliminar la postulación");
      }
    });
  };

  const handleCopyEmail = () => {
    if (!candidateEmail) return;
    navigator.clipboard.writeText(candidateEmail).then(
      () => toast.success("Email copiado"),
      () => toast.error("No se pudo copiar el email")
    );
  };

  const handleOpenResume = () => {
    if (!resumeUrl) {
      toast.error("Este candidato no tiene CV adjunto");
      return;
    }
    window.open(resumeUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      {/* Botón 3 puntos compacto */}
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

      {/* Menú compacto */}
      <DropdownMenuContent
        align="end"
        className="
          min-w-[140px] rounded-md border border-zinc-200/80
          bg-white/97 px-0.5 py-0 shadow-lg backdrop-blur-md
          dark:border-zinc-700/80 dark:bg-zinc-900/98
        "
      >
        {candidateHref && (
          <DropdownMenuItem
            asChild
            className="
              group flex cursor-pointer items-center gap-1 rounded-[6px]
              px-1.5 py-0.5 text-[11px] leading-[1.05]
              text-zinc-800 hover:bg-zinc-50
              dark:text-zinc-100 dark:hover:bg-zinc-800/80
            "
          >
            <Link href={candidateHref}>
              <span
                className="
                  inline-flex h-5 w-5 items-center justify-center
                  rounded-full bg-emerald-50 text-emerald-600
                  group-hover:bg-emerald-100 group-hover:text-emerald-700
                  dark:bg-emerald-500/10 dark:text-emerald-300
                  dark:group-hover:bg-emerald-500/20
                "
              >
                <User2 className="h-3 w-3" />
              </span>
              <span>Abrir perfil</span>
            </Link>
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
          <span
            className="
              inline-flex h-5 w-5 items-center justify-center
              rounded-full bg-sky-50 text-sky-600
              group-hover:bg-sky-100 group-hover:text-sky-700
              dark:bg-sky-500/10 dark:text-sky-300
              dark:group-hover:bg-sky-500/20
            "
          >
            <FileText className="h-3 w-3" />
          </span>
          <span>Descargar/Ver CV</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleCopyEmail}
          className="
            group flex cursor-pointer items-center gap-1 rounded-[6px]
            px-1.5 py-0.5 text-[11px] leading-[1.05]
            text-zinc-800 hover:bg-zinc-50
            dark:text-zinc-100 dark:hover:bg-zinc-800/80
          "
        >
          <span
            className="
              inline-flex h-5 w-5 items-center justify-center
              rounded-full bg-indigo-50 text-indigo-600
              group-hover:bg-indigo-100 group-hover:text-indigo-700
              dark:bg-indigo-500/10 dark:text-indigo-300
              dark:group-hover:bg-indigo-500/20
            "
          >
            <Mail className="h-3 w-3" />
          </span>
          <span>Copiar email</span>
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
          <span
            className="
              inline-flex h-5 w-5 items-center justify-center
              rounded-full bg-rose-50 text-rose-600
              group-hover:bg-rose-100 group-hover:text-rose-700
              dark:bg-rose-500/10 dark:text-rose-300
              dark:group-hover:bg-rose-500/25
            "
          >
            <Trash2 className="h-3 w-3" />
          </span>
          <span>Eliminar postulación</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
