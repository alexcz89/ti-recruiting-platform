// components/dashboard/JobActionsMenu.tsx 
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MoreHorizontal, Edit3, Trash2, Users2, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toastSuccess, toastError } from "@/lib/ui/toast";

type Props = {
  jobId: string;
};

export default function JobActionsMenu({ jobId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const applicantsHref = `/dashboard/jobs/${jobId}/applications`;
  const editHref = `/dashboard/jobs/${jobId}/edit`;
  const publicHref = `/jobs/${jobId}`;

  const handleDelete = () => {
    const ok = window.confirm(
      "¿Eliminar esta vacante? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("jobId", jobId);

        const res = await fetch("/dashboard/jobs/delete", {
          method: "POST",
          body: fd,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "No se pudo eliminar la vacante");
        }

        toastSuccess("Vacante eliminada correctamente");
        router.refresh();
      } catch (err: any) {
        toastError(err?.message || "No se pudo eliminar la vacante");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="
          inline-flex h-8 w-8 items-center justify-center
          rounded-full border border-zinc-200/80 bg-white/80
          text-zinc-600 shadow-sm
          hover:bg-zinc-50 hover:text-zinc-800
          active:scale-[0.97]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2
          disabled:opacity-60
          dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:text-zinc-300
          dark:hover:bg-zinc-800/80 dark:hover:text-zinc-50
        "
        disabled={pending}
        aria-label="Acciones"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="
          min-w-[230px] rounded-2xl border border-zinc-100/80
          bg-white/95 px-1.5 py-1.5 shadow-xl backdrop-blur-md
          dark:border-zinc-700/80 dark:bg-zinc-900/95
        "
      >
        {/* Ver postulaciones */}
        <DropdownMenuItem
          asChild
          className="
            group flex items-center gap-2.5 rounded-xl px-2.5 py-2
            text-[13px] text-zinc-800
            hover:bg-zinc-50
            focus:bg-zinc-50
            dark:text-zinc-100 dark:hover:bg-zinc-800/80 dark:focus:bg-zinc-800/80
            cursor-pointer
          "
        >
          <Link href={applicantsHref}>
            <span
              className="
                inline-flex h-7 w-7 items-center justify-center
                rounded-full bg-emerald-50 text-emerald-600
                group-hover:bg-emerald-100 group-hover:text-emerald-700
                dark:bg-emerald-500/10 dark:text-emerald-300
                dark:group-hover:bg-emerald-500/20
              "
            >
              <Users2 className="h-3.5 w-3.5" />
            </span>
            <span>Ver postulaciones</span>
          </Link>
        </DropdownMenuItem>

        {/* Editar */}
        <DropdownMenuItem
          asChild
          className="
            group flex items-center gap-2.5 rounded-xl px-2.5 py-2
            text-[13px] text-zinc-800
            hover:bg-zinc-50
            focus:bg-zinc-50
            dark:text-zinc-100 dark:hover:bg-zinc-800/80 dark:focus:bg-zinc-800/80
            cursor-pointer
          "
        >
          <Link href={editHref}>
            <span
              className="
                inline-flex h-7 w-7 items-center justify-center
                rounded-full bg-sky-50 text-sky-600
                group-hover:bg-sky-100 group-hover:text-sky-700
                dark:bg-sky-500/10 dark:text-sky-300
                dark:group-hover:bg-sky-500/20
              "
            >
              <Edit3 className="h-3.5 w-3.5" />
            </span>
            <span>Editar vacante</span>
          </Link>
        </DropdownMenuItem>

        {/* Ver vacante pública */}
        <DropdownMenuItem
          asChild
          className="
            group flex items-center gap-2.5 rounded-xl px-2.5 py-2
            text-[13px] text-zinc-800
            hover:bg-zinc-50
            focus:bg-zinc-50
            dark:text-zinc-100 dark:hover:bg-zinc-800/80 dark:focus:bg-zinc-800/80
            cursor-pointer
          "
        >
          <Link href={publicHref} target="_blank" rel="noopener noreferrer">
            <span
              className="
                inline-flex h-7 w-7 items-center justify-center
                rounded-full bg-indigo-50 text-indigo-600
                group-hover:bg-indigo-100 group-hover:text-indigo-700
                dark:bg-indigo-500/10 dark:text-indigo-300
                dark:group-hover:bg-indigo-500/20
              "
            >
              <Eye className="h-3.5 w-3.5" />
            </span>
            <span>Ver vacante</span>
          </Link>
        </DropdownMenuItem>

        {/* Separador custom (ya no es un item del dropdown) */}
        <div className="my-1 h-px bg-zinc-200/60 dark:bg-zinc-700/60" />

        {/* Eliminar */}
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            handleDelete();
          }}
          className="
            group flex items-center gap-2.5 rounded-xl px-2.5 py-2
            text-[13px] text-rose-600
            hover:bg-rose-50/80 hover:text-rose-700
            focus:bg-rose-50/80
            dark:text-rose-400 dark:hover:bg-rose-500/15 dark:focus:bg-rose-500/15
            cursor-pointer
          "
        >
          <span
            className="
              inline-flex h-7 w-7 items-center justify-center
              rounded-full bg-rose-50 text-rose-600
              group-hover:bg-rose-100 group-hover:text-rose-700
              dark:bg-rose-500/10 dark:text-rose-300
              dark:group-hover:bg-rose-500/25
            "
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
          <span>Eliminar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
