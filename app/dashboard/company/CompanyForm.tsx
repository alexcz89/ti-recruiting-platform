// app/dashboard/company/CompanyForm.tsx
"use client";

import { useState } from "react";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import { saveCompany } from "./actions";

const COMPANY_SIZES = [
  { value: "ONE_TO_TEN", label: "1-10 empleados" },
  { value: "ELEVEN_TO_FIFTY", label: "11-50 empleados" },
  { value: "FIFTY_ONE_TO_TWO_HUNDRED", label: "51-200 empleados" },
  { value: "TWO_HUNDRED_ONE_TO_FIVE_HUNDRED", label: "201-500 empleados" },
  { value: "FIVE_HUNDRED_PLUS", label: "500+ empleados" },
] as const;

type CompanySizeValue = (typeof COMPANY_SIZES)[number]["value"];

type Props = {
  initial: { id: string; name: string; size: string | null };
};

export default function CompanyForm({ initial }: Props) {
  const [form, setForm] = useState<{
    name: string;
    size: CompanySizeValue | "";
  }>(() => ({
    name: initial.name || "",
    size: (initial.size as CompanySizeValue) || "",
  }));

  const [loading, setLoading] = useState(false);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await saveCompany({
      name: form.name,
      size: form.size || null,
    });

    if (res.ok) {
      toastSuccess(res.message || "Empresa actualizada.");
    } else {
      toastError(res.message || "Error al guardar.");
    }

    setLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">
          Nombre de la empresa
        </label>
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
        <label className="block text-sm font-medium">
          Tamaño de la empresa
        </label>
        <select
          name="size"
          value={form.size}
          onChange={onChange}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">— Seleccionar —</option>
          {COMPANY_SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}