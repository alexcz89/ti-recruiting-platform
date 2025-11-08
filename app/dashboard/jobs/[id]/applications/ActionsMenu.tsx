// app/dashboard/jobs/[id]/applications/ActionsMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function ActionsMenu({
  applicationId,
  candidateHref,
  resumeUrl,
  candidateEmail,
}: {
  applicationId: string;
  candidateHref?: string;
  resumeUrl?: string | null;
  candidateEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function onDelete() {
    if (!confirm("¿Eliminar esta postulación? Esta acción no se puede deshacer.")) return;
    try {
      const res = await fetch(`/api/applications/${applicationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Postulación eliminada");
      // Recarga suave para reflejar cambios
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar la postulación");
    }
  }

  function onCopyEmail() {
    if (!candidateEmail) return;
    navigator.clipboard.writeText(candidateEmail).then(
      () => toast.success("Email copiado"),
      () => toast.error("No se pudo copiar el email")
    );
  }

  function onOpenResume() {
    if (!resumeUrl) return toast.error("Este candidato no tiene CV adjunto");
    window.open(resumeUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 hover:bg-gray-50"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Más acciones"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200/60 dark:bg-zinc-700/50 rounded"
        >
          {candidateHref && (
            <a
              className="block px-3 py-2 text-sm hover:bg-gray-50"
              href={candidateHref}
              onClick={() => setOpen(false)}
            >
              Abrir perfil
            </a>
          )}
          <button
            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              setOpen(false);
              onOpenResume();
            }}
          >
            Descargar/Ver CV
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              setOpen(false);
              onCopyEmail();
            }}
          >
            Copiar email
          </button>
          <div className="my-1 h-px bg-zinc-200/60 dark:bg-zinc-700/50 rounded" />
          <button
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Eliminar postulación
          </button>
        </div>
      )}
    </div>
  );
}
