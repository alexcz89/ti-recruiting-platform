"use client";
// app/dashboard/admin/users/UserActionsClient.tsx

import { useState } from "react";
import { Trash2 } from "lucide-react";

type Props = {
  userId: string;
  userName: string;
  onDelete: (fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
};

export function UserActionsClient({ userId, userName, onDelete }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`¿Eliminar a "${userName}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    const fd = new FormData();
    fd.set("userId", userId);
    const res = await onDelete(fd);
    setDeleting(false);
    if (res.error) setMsg(res.error);
    else setMsg("✅ Eliminado");
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-800/50 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition"
      >
        <Trash2 className="h-3 w-3" />
        {deleting ? "..." : "Eliminar"}
      </button>
    </div>
  );
}