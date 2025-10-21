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
  DropdownMenuSeparator,
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
  const publicHref = `/jobs/${jobId}`; // 👁️ Vista pública (candidato)

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
        className="inline-flex items-center justify-center rounded-md border px-2 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
        disabled={pending}
        aria-label="Acciones"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[220px]">
        {/* 🔹 Ver postulaciones */}
        <DropdownMenuItem asChild>
          <Link href={applicantsHref} className="flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            Ver postulaciones
          </Link>
        </DropdownMenuItem>

        {/* 🔹 Editar vacante */}
        <DropdownMenuItem asChild>
          <Link href={editHref} className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Editar vacante
          </Link>
        </DropdownMenuItem>

        {/* 🔹 Ver vacante pública */}
        <DropdownMenuItem asChild>
          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Ver vacante
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 🔻 Eliminar */}
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-red-600 focus:text-red-700"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
