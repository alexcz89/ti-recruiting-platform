// app/dashboard/billing/taxdata/TaxDataForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";

type Props = {
  initial: {
    taxLegalName: string;
    taxRfc: string;
    taxRegime: string;
    taxZip: string;
    taxAddressLine1: string;
    taxAddressLine2: string;
    taxEmail: string;
    cfdiUseDefault: string;
  };
};

const REGIMES = [
  { value: "", label: "Selecciona un régimen fiscal" },
  { value: "601", label: "601 - General de Ley Personas Morales" },
  { value: "603", label: "603 - Personas Morales con Fines no Lucrativos" },
  { value: "605", label: "605 - Sueldos y Salarios e Ingresos Asimilados" },
  { value: "612", label: "612 - Personas Físicas con Actividades Empresariales" },
  { value: "622", label: "622 - Actividades Empresariales con Coeficiente de Utilidad" },
  { value: "623", label: "623 - Opcional para Grupos de Sociedades" },
  { value: "624", label: "624 - Coordinados" },
];

const CFDI_USES = [
  { value: "", label: "Selecciona un uso CFDI" },
  { value: "G01", label: "G01 - Adquisición de mercancías" },
  { value: "G03", label: "G03 - Gastos en general" },
  { value: "P01", label: "P01 - Por definir" },
];

export default function TaxDataForm({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "taxRfc"
          ? value.toUpperCase()
          : name === "taxZip"
          ? value.replace(/\D/g, "").slice(0, 5)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    // Validaciones básicas
    if (!form.taxLegalName.trim() || !form.taxRfc.trim() || !form.taxZip.trim()) {
      toastError("Razón social, RFC y C.P. son obligatorios.");
      return;
    }

    if (form.taxRfc.trim().length < 12) {
      toastError("El RFC parece incompleto.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/billing/taxdata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        console.error("Error guardando datos fiscales", data);
        toastError(data?.error || "No se pudieron guardar los datos fiscales");
        return;
      }

      toastSuccess("Datos fiscales guardados correctamente");
      router.refresh();
    } catch (err) {
      console.error("Network error saving tax data", err);
      toastError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos principales */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-default">
            Razón social *
          </label>
          <input
            type="text"
            name="taxLegalName"
            value={form.taxLegalName}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-transparent px-3 py-2 text-sm text-default shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-zinc-800/70"
            placeholder="Ej. Task Consultores, S.A. de C.V."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-default">
              RFC *
            </label>
            <input
              type="text"
              name="taxRfc"
              value={form.taxRfc}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-transparent px-3 py-2 text-sm text-default tracking-widest shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-zinc-800/70"
              placeholder="XAXX010101000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-default">
              Régimen fiscal
            </label>
            <select
              name="taxRegime"
              value={form.taxRegime}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-transparent px-3 py-2 text-sm text-default shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-zinc-800/70"
            >
              {REGIMES.map((r) => (
                <option key={r.value || "empty"} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Domicilio fiscal */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-default">Domicilio fiscal</h2>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className="block text-sm font-medium text-default">
              Calle y número *
            </label>
            <input
              type="text"
              name="taxAddressLine1"
              value={form.taxAddressLine1}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-transparent px-3 py-2 text-sm text-default shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-zinc-800/70"
              placeholder="Ej. Av. Vasconcelos 123"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-default">
              C.P. *
            </label>
            <input
              type="text"
              name="taxZip"
              value={form.taxZip}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-transparent px-3 py-2 text-sm text-default shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-zinc-800/70"
              placeholder="Ej. 66220"
              inputMode="numeric"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-default">
            Colonia, interior y otros
          </label>
          <input
            type="text"
            name="taxAddressLine2"
            value={form.taxAddressLine2}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-transparent px-3 py-2 text-sm text-default shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-zinc-800/70"
            placeholder="Ej. Col. Del Valle, Int. 4B"
          />
        </div>
      </div>

      {/* Preferencias CFDI */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-default">Preferencias de CFDI</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-default">
              Correo para envío de facturas
            </label>
            <input
              type="email"
              name="taxEmail"
              value={form.taxEmail}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-transparent px-3 py-2 text-sm text-default shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-zinc-800/70"
              placeholder="facturacion@tuempresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-default">
              Uso CFDI predeterminado
            </label>
            <select
              name="cfdiUseDefault"
              value={form.cfdiUseDefault}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-zinc-200/70 bg-transparent px-3 py-2 text-sm text-default shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/70 dark:border-zinc-800/70"
            >
              {CFDI_USES.map((u) => (
                <option key={u.value || "empty"} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-emerald-500 dark:hover:bg-emerald-400"
        >
          {saving ? "Guardando..." : "Guardar datos fiscales"}
        </button>
      </div>
    </form>
  );
}
