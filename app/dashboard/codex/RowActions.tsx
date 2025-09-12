// app/dashboard/codex/RowActions.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

export default function RowActions({
  slug,
  published,
  editHref,
  onDelete,
  onTogglePublished,
}: {
  slug: string;
  published: boolean;
  editHref: string;
  onDelete: (fd: FormData) => Promise<void>;
  onTogglePublished: (fd: FormData) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Eliminar el artículo "${slug}"? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("slug", slug);
    await onDelete(fd);
    // Forzamos recarga para ver la lista actualizada
    window.location.reload();
  }

  async function handleToggle() {
    setBusy(true);
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("published", String(published));
    await onTogglePublished(fd);
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={editHref}
        className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
      >
        Editar
      </Link>
      <button
        onClick={handleToggle}
        className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
        disabled={busy}
        title={published ? "Marcar como borrador" : "Publicar"}
      >
        {published ? "Despublicar" : "Publicar"}
      </button>
      <button
        onClick={handleDelete}
        className="text-xs border rounded px-2 py-1 hover:bg-red-50 text-red-700 border-red-300"
        disabled={busy}
      >
        Eliminar
      </button>
    </div>
  );
}
