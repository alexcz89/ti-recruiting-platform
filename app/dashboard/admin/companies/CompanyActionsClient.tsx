"use client";
// app/dashboard/admin/companies/CompanyActionsClient.tsx

import { useState } from "react";
import { Edit2, Check, X } from "lucide-react";

type Props = {
  companyId: string;
  companyName: string;
  currentCredits: number;
  onUpdateCredits: (fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
};

export function CompanyActionsClient({ companyId, companyName, currentCredits, onUpdateCredits }: Props) {
  const [editing, setEditing] = useState(false);
  const [credits, setCredits] = useState(String(currentCredits));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("companyId", companyId);
    fd.set("credits", credits);
    const res = await onUpdateCredits(fd);
    setSaving(false);
    if (res.error) {
      setMsg(res.error);
    } else {
      setMsg("✅ Guardado");
      setEditing(false);
      setTimeout(() => setMsg(null), 2000);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-end gap-2">
        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-400 hover:text-blue-600 transition"
        >
          <Edit2 className="h-3 w-3" />
          Créditos
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <input
        type="number"
        value={credits}
        onChange={e => setCredits(e.target.value)}
        min={0}
        className="w-20 rounded-lg border border-blue-400 px-2 py-1 text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-zinc-800 dark:text-white"
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => { setEditing(false); setCredits(String(currentCredits)); }}
        className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 transition"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {msg && <span className="text-xs text-red-500 ml-1">{msg}</span>}
    </div>
  );
}