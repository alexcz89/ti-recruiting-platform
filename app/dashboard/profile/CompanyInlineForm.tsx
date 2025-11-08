// app/dashboard/profile/CompanyInlineForm.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import {
  saveCompanyBasic,
  setCompanyLogo,
  removeCompanyLogo, // 👈 habilitado
} from "@/app/dashboard/company/actions";

const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

type Props = {
  initial: {
    name: string;
    size: string | null;
    logoUrl?: string | null;
  };
};

export default function CompanyInlineForm({ initial }: Props) {
  const [form, setForm] = useState({
    name: initial.name || "",
    size: initial.size || "",
    logoUrl: initial.logoUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await saveCompanyBasic({ name: form.name, size: (form.size || undefined) as any });
    setSaving(false);
    if (res.ok) toast.success("Empresa actualizada");
    else toast.error(res.message || "Error al guardar");
  };

  const onRemoveLogo = async () => {
    const r = await removeCompanyLogo();
    if (r.ok) {
      setForm((p) => ({ ...p, logoUrl: "" }));
      toast.success("Logo eliminado");
    } else {
      toast.error(r.message || "No se pudo eliminar el logo");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Logo */}
      <div>
        <label className="block text-sm font-medium">Logo</label>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-14 w-14 overflow-hidden rounded-xl border bg-zinc-200/60 dark:bg-zinc-700/50 rounded">
            {form.logoUrl ? (
              <Image
                src={form.logoUrl}
                alt="Logo"
                width={56}
                height={56}
                className="h-14 w-14 object-contain p-1"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center text-xs text-zinc-400">
                Sin logo
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <UploadButton<OurFileRouter>
              endpoint="logoUploader"
              appearance={{
                button:
                  "rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 glass-card p-4 md:p-6",
                allowedContent: "text-[11px] text-zinc-500",
              }}
              onUploadBegin={() => setUploading(true)}
              onClientUploadComplete={async (files) => {
                setUploading(false);
                const f = (files?.[0] ?? {}) as any;
                // UploadThing v9 → preferir ufsUrl (con fallback a url por compatibilidad)
                const url = f.ufsUrl || f.url;
                if (!url) {
                  toast.error("No se recibió URL del archivo");
                  return;
                }
                const r = await setCompanyLogo(url);
                if (r.ok) {
                  setForm((p) => ({ ...p, logoUrl: url }));
                  toast.success("Logo actualizado");
                } else {
                  toast.error(r.message || "No se pudo actualizar el logo");
                }
              }}
              onUploadError={(e) => {
                setUploading(false);
                toast.error(e?.message || "Error al subir archivo");
              }}
            />
            {form.logoUrl ? (
              <button
                type="button"
                onClick={onRemoveLogo}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Quitar logo
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          PNG/JPG/WEBP/SVG hasta 4&nbsp;MB. Se mostrará en tus vacantes públicas.
          {uploading && <span className="ml-2 text-emerald-700">Subiendo…</span>}
        </p>
      </div>

      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium">Nombre de la empresa</label>
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          required
        />
      </div>

      {/* Tamaño */}
      <div>
        <label className="block text-sm font-medium">Tamaño de la empresa</label>
        <select
          name="size"
          value={form.size || ""}
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

      <div className="pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
