// app/dashboard/profile/CompanyForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  Camera,
  CheckCircle2,
  Loader2,
  Save,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";

import {
  saveCompany,
  setCompanyLogo,
  removeCompanyLogo,
} from "@/app/dashboard/company/actions";
import { useUploadThing } from "@/lib/uploadthing";

type CompanySize =
  | ""
  | "ONE_TO_TEN"
  | "ELEVEN_TO_FIFTY"
  | "FIFTY_ONE_TO_TWO_HUNDRED"
  | "TWO_HUNDRED_ONE_TO_FIVE_HUNDRED"
  | "FIVE_HUNDRED_PLUS";

type Props = {
  companyId: string;
  initial: {
    name:               string;
    size:               string | null;
    logoUrl:            string | null;
    assessmentCredits?: number | null;
    jobsCount?:         number;
  };
};

const COMPANY_SIZE_OPTIONS: Array<{ value: Exclude<CompanySize, "">; label: string }> = [
  { value: "ONE_TO_TEN",                    label: "1-10 empleados"    },
  { value: "ELEVEN_TO_FIFTY",               label: "11-50 empleados"   },
  { value: "FIFTY_ONE_TO_TWO_HUNDRED",      label: "51-200 empleados"  },
  { value: "TWO_HUNDRED_ONE_TO_FIVE_HUNDRED", label: "201-500 empleados" },
  { value: "FIVE_HUNDRED_PLUS",             label: "500+ empleados"    },
];

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

function getSizeLabel(size: string | null | undefined) {
  return COMPANY_SIZE_OPTIONS.find((o) => o.value === size)?.label ?? "Sin tamaño definido";
}

export default function CompanyForm({ companyId, initial }: Props) {
  const [pending,      startTransition] = useTransition();
  const [name,         setName]         = useState(initial.name     ?? "");
  const [size,         setSize]         = useState<CompanySize>((initial.size as CompanySize) ?? "");
  const [logoPreview,  setLogoPreview]  = useState(initial.logoUrl  ?? "");
  const [isUploading,  setIsUploading]  = useState(false);
  const [isDragging,   setIsDragging]   = useState(false);
  const [hasChanges,   setHasChanges]   = useState(false);

  const fileInputRef       = useRef<HTMLInputElement>(null);
  const logoButtonInputRef = useRef<HTMLInputElement>(null);
  const { startUpload }    = useUploadThing("logoUploader");

  const isBusy = pending || isUploading;

  useEffect(() => {
    setHasChanges(
      name        !== (initial.name     ?? "") ||
      size        !== ((initial.size as CompanySize) ?? "") ||
      logoPreview !== (initial.logoUrl  ?? ""),
    );
  }, [name, size, logoPreview, initial]);

  const resetFileInput = () => {
    if (fileInputRef.current)       fileInputRef.current.value       = "";
    if (logoButtonInputRef.current) logoButtonInputRef.current.value = "";
  };

  const restoreInitial = useCallback(() => {
    setName((initial.name ?? ""));
    setSize((initial.size as CompanySize) ?? "");
    setLogoPreview(initial.logoUrl ?? "");
    resetFileInput();
  }, [initial]);

  const validateImage = (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Solo se permiten imágenes."); return false; }
    if (file.size > 4 * 1024 * 1024)    { alert("La imagen no debe superar 4 MB."); return false; }
    return true;
  };

  const uploadSurfaceClasses = useMemo(
    () => [
      "relative rounded-xl border border-dashed px-4 py-5 transition-all cursor-pointer",
      isDragging
        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
        : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/50",
    ].join(" "),
    [isDragging],
  );

  const handleUpload = useCallback(async (file: File | null) => {
    if (!file || isUploading) return;
    if (!validateImage(file)) return;

    const oldPreview = logoPreview;
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(String(reader.result ?? ""));
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const uploaded = await startUpload([file]);
      const first    = uploaded?.[0] as { url?: string; fileUrl?: string } | undefined;
      const url      = first?.url || first?.fileUrl;
      if (!url) { setLogoPreview(oldPreview); alert("No se pudo obtener la URL del archivo."); return; }

      const result = await setCompanyLogo(url);
      if (!result?.ok) { setLogoPreview(oldPreview); alert(result?.message || "No se pudo guardar el logo."); return; }

      setLogoPreview(url);
    } catch (error) {
      console.error("Upload error:", error);
      setLogoPreview(oldPreview);
      alert("Error al subir el archivo.");
    } finally {
      setIsUploading(false);
      resetFileInput();
    }
  }, [isUploading, logoPreview, startUpload]);

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleUpload(e.dataTransfer.files?.[0] ?? null);
  };

  const handleRemoveLogo = async () => {
    if (isBusy) return;
    setIsUploading(true);
    try {
      const result = await removeCompanyLogo();
      if (!result?.ok) { alert(result?.message || "No se pudo eliminar el logo."); return; }
      setLogoPreview("");
      resetFileInput();
    } catch (error) {
      console.error("Remove logo error:", error);
      alert("Error al eliminar el logo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { alert("El nombre de la empresa es obligatorio."); return; }

    startTransition(async () => {
      const result = await saveCompany({ name: trimmedName, size: size || null });
      if (!result?.ok) { alert(result?.message || "No se pudo guardar."); return; }
      setName(trimmedName);
      setHasChanges(false);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 sm:text-lg">
                Mi empresa
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400 hidden sm:block">
                Identidad visual y datos principales de tu empresa.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {(initial.jobsCount ?? 0) > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/10 dark:text-emerald-300">
                  <Building2 className="h-3.5 w-3.5" />
                  {initial.jobsCount} vacante{(initial.jobsCount ?? 0) !== 1 ? "s" : ""}
                </span>
              )}
              {hasChanges ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-900/10 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Pendiente
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-900/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Guardado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">

          {/* ── Logo (sidebar on desktop, below fields on mobile) ── */}
          <aside className="order-2 lg:order-1">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Logo de empresa
              </h3>

              {/* Preview */}
              <div className="mb-3 flex min-h-[140px] items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
                {logoPreview ? (
                  <div className="relative h-20 w-20">
                    <Image src={logoPreview} alt="Logo" fill sizes="80px" className="object-contain" />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                    <Building2 className="h-7 w-7 text-zinc-400" />
                  </div>
                )}
              </div>

              {/* Upload / Remove buttons */}
              <div className="flex gap-2">
                <label className="relative inline-flex min-h-[40px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
                  <input
                    ref={logoButtonInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    disabled={isUploading}
                    onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
                  />
                  {isUploading ? <><Spinner /><span>Subiendo…</span></> : <><Camera className="h-4 w-4" /><span>{logoPreview ? "Cambiar" : "Subir logo"}</span></>}
                </label>

                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isBusy || !logoPreview}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Drag-drop — desktop only */}
              <label
                className={`mt-3 hidden sm:block ${uploadSurfaceClasses}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true);  }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  disabled={isUploading}
                  onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
                />
                <div className="pointer-events-none text-center">
                  <Camera className="mx-auto mb-1.5 h-5 w-5 text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Arrastra aquí
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    PNG, JPG, WEBP o SVG · máx 4 MB
                  </p>
                </div>
              </label>

              {/* Credits info */}
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  <Wallet className="h-3.5 w-3.5" />
                  Créditos disponibles
                </div>
                <div className="mt-1 flex items-end gap-1.5">
                  <span className="text-xl font-bold leading-none text-emerald-800 dark:text-emerald-200">
                    {initial.assessmentCredits ?? 0}
                  </span>
                  <span className="text-xs text-emerald-700/70 dark:text-emerald-300/70">
                    assessments
                  </span>
                </div>
                <Link
                  href="/dashboard/billing/credits"
                  className="mt-1.5 inline-flex text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  Ver detalle →
                </Link>
              </div>
            </div>
          </aside>

          {/* ── Form fields — always first on mobile ── */}
          <div className="order-1 lg:order-2 space-y-5">

            {/* Nombre */}
            <div className="space-y-1.5">
              <label htmlFor="company-name" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Nombre de la empresa
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input
                id="company-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                placeholder="Mi Empresa S.A."
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Tamaño */}
            <div className="space-y-1.5">
              <label htmlFor="company-size" className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Tamaño de la empresa
                <span className="ml-1 text-xs font-normal text-zinc-400">(opcional)</span>
              </label>
              <select
                id="company-size"
                value={size}
                onChange={(e) => setSize(e.target.value as CompanySize)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">Selecciona un tamaño</option>
                {COMPANY_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Summary preview (compact, mobile-friendly) */}
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{name || "Sin nombre"}</span>
                {size ? ` · ${getSizeLabel(size)}` : ""}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={isBusy || !hasChanges}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto"
              >
                {pending ? <Spinner /> : <Save className="h-4 w-4" />}
                {pending ? "Guardando..." : "Guardar cambios"}
              </button>

              <button
                type="button"
                onClick={restoreInitial}
                disabled={isBusy || !hasChanges}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:w-auto"
              >
                <Undo2 className="h-4 w-4" />
                Restablecer
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4">
        <Link
          href="/dashboard/overview"
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Regresar al overview
        </Link>
      </div>
    </form>
  );
}
