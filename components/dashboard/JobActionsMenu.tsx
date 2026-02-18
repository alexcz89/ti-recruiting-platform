// components/dashboard/JobActionsMenu.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Edit,
  Eye,
  Pause,
  Play,
  XCircle,
  Trash2,
} from "lucide-react";
import { toastError, toastSuccess } from "@/lib/ui/toast";

type JobStatus = "OPEN" | "PAUSED" | "CLOSED";

type Props = {
  jobId: string;
  currentStatus: JobStatus;
};

function cn(...xs: Array<string | undefined | null | false>) {
  return xs.filter(Boolean).join(" ");
}

export default function JobActionsMenu({ jobId, currentStatus }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showAbove, setShowAbove] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, right: 0 });
  const [mounted, setMounted] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Detectar si está montado (para evitar SSR issues)
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Detectar si hay espacio abajo o debe mostrarse arriba
  React.useEffect(() => {
    if (!open || !rootRef.current) return;

    const updatePosition = () => {
      if (!rootRef.current) return;
      
      const rect = rootRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 300;

      const shouldShowAbove = spaceBelow < dropdownHeight;
      setShowAbove(shouldShowAbove);

      setPosition({
        top: shouldShowAbove ? rect.top : rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };

    updatePosition();
    
    // Actualizar en scroll o resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        // Verificar si el click fue en el dropdown
        const dropdown = document.getElementById(`job-menu-${jobId}`);
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setOpen(false);
      }
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
  }, [jobId]);

  async function handleStatusChange(newStatus: JobStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error("Error actualizando estado");
      }

      const statusLabels = {
        OPEN: "reabierta",
        PAUSED: "pausada",
        CLOSED: "cerrada",
      };
      toastSuccess(`Vacante ${statusLabels[newStatus]} correctamente`);
      
      router.refresh();
      setOpen(false);
    } catch (error) {
      toastError("Error al actualizar el estado de la vacante");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const confirmed = confirm(
      "¿Estás seguro de eliminar esta vacante? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Error eliminando vacante");
      }

      toastSuccess("Vacante eliminada correctamente");
      
      router.push("/dashboard/jobs");
      router.refresh();
    } catch (error) {
      toastError("Error al eliminar la vacante");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const showPause = currentStatus === "OPEN";
  const showReopen = currentStatus === "PAUSED" || currentStatus === "CLOSED";
  const showClose = currentStatus === "OPEN" || currentStatus === "PAUSED";

  // Contenido del dropdown
  const dropdownContent = open && mounted ? (
    <div
      id={`job-menu-${jobId}`}
      role="menu"
      style={{
        position: 'fixed',
        top: showAbove ? undefined : `${position.top}px`,
        bottom: showAbove ? `${window.innerHeight - position.top + 8}px` : undefined,
        right: `${position.right}px`,
        zIndex: 9999,
      }}
      className={cn(
        "w-56 overflow-hidden rounded-2xl border shadow-lg",
        "border-zinc-200 bg-white",
        "dark:border-zinc-800 dark:bg-zinc-950"
      )}
    >
      <div className="p-2">
        {/* Ver postulaciones */}
        <Link
          href={`/dashboard/jobs/${jobId}/applications`}
          onClick={() => setOpen(false)}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
            "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
          )}
        >
          <Eye className="h-4 w-4" />
          Ver postulaciones
        </Link>

        {/* Editar */}
        <Link
          href={`/dashboard/jobs/${jobId}/edit`}
          onClick={() => setOpen(false)}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
            "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
          )}
        >
          <Edit className="h-4 w-4" />
          Editar vacante
        </Link>

        <div className="my-2 h-px bg-zinc-100 dark:bg-zinc-800" />

        {/* Pausar */}
        {showPause && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleStatusChange("PAUSED")}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
              busy
                ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <Pause className="h-4 w-4" />
            Pausar vacante
          </button>
        )}

        {/* Reabrir */}
        {showReopen && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleStatusChange("OPEN")}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
              busy
                ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <Play className="h-4 w-4" />
            Reabrir vacante
          </button>
        )}

        {/* Cerrar */}
        {showClose && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleStatusChange("CLOSED")}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
              busy
                ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <XCircle className="h-4 w-4" />
            Cerrar vacante
          </button>
        )}

        <div className="my-2 h-px bg-zinc-100 dark:bg-zinc-800" />

        {/* Eliminar */}
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
            busy
              ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
              : "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          )}
        >
          <Trash2 className="h-4 w-4" />
          {busy ? "Eliminando..." : "Eliminar vacante"}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div ref={rootRef} className={cn("relative inline-flex")}>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all",
            "border-zinc-200 bg-white/90 text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300",
            "dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:bg-zinc-900 dark:hover:border-zinc-600",
            busy && "opacity-60 cursor-not-allowed"
          )}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Acciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* 🚀 Portal: renderiza el dropdown en el body */}
      {mounted && dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
}