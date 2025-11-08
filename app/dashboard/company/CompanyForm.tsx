// app/dashboard/company/CompanyForm.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveCompany } from "./actions";

const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

type Props = {
  initial: { id: string; name: string; size: string | null };
};

export default function CompanyForm({ initial }: Props) {
  const [form, setForm] = useState<{ name: string; size: string | "" }>(() => ({
    name: initial.name || "",
    size: initial.size || "",
  }));
  const [loading, setLoading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await saveCompany({
      name: form.name,
      size: form.size || null,
    });
    if (res.ok) toast.success(res.message || "Empresa actualizada.");
    else toast.error(res.message || "Error al guardar.");
    setLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nombre de la empresa</label>
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Mi Empresa S.A. de C.V."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Tamaño de la empresa</label>
        <select
          name="size"
          value={form.size}
          onChange={onChange}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">— Seleccionar —</option>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
