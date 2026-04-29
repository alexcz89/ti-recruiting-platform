"use client";
// app/dashboard/admin/templates/TemplateActionsClient.tsx

import { useState } from "react";
import { Globe, Lock, Trash2 } from "lucide-react";

type Props = {
  templateId: string;
  isGlobal: boolean;
  onToggleGlobal: (fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
  onDeactivate: (fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
};

export function TemplateActionsClient({ templateId, isGlobal, onToggleGlobal, onDeactivate }: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleToggle() {
    const nextGlobal = !isGlobal;
    const confirmMsg = nextGlobal
      ? "¿Hacer este template GLOBAL? Será visible para todos los recruiters."
      : "¿Quitar visibilidad global? Solo el admin podrá verlo.";
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    const fd = new FormData();
    fd.set("templateId", templateId);
    fd.set("isGlobal", String(nextGlobal));
    const res = await onToggleGlobal(fd);
    setLoading(false);
    if (res.error) setMsg(res.error);
    else setMsg("✅");
    setTimeout(() => setMsg(null), 2000);
  }

  async function handleDeactivate() {
    if (!confirm("¿Desactivar este template? No aparecerá más en el sistema.")) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("templateId", templateId);
    const res = await onDeactivate(fd);
    setLoading(false);
    if (res.error) setMsg(res.error);
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      <button
        onClick={handleToggle}
        disabled={loading}
        title={isGlobal ? "Quitar visibilidad global" : "Hacer global"}
        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          isGlobal
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
            : "border-zinc-200 bg-white text-zinc-600 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
        }`}
      >
        {isGlobal ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        {isGlobal ? "Global" : "Privado"}
      </button>
      <button
        onClick={handleDeactivate}
        disabled={loading}
        title="Desactivar template"
        className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-red-200 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}