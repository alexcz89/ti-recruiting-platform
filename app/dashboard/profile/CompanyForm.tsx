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
    name: string;
    size: string | null;
    logoUrl: string | null;
    assessmentCredits?: number | null;
  };
};

const COMPANY_SIZE_OPTIONS: Array<{
  value: Exclude<CompanySize, "">;
  label: string;
}> = [
  { value: "ONE_TO_TEN", label: "1-10 empleados" },
  { value: "ELEVEN_TO_FIFTY", label: "11-50 empleados" },
  { value: "FIFTY_ONE_TO_TWO_HUNDRED", label: "51-200 empleados" },
  { value: "TWO_HUNDRED_ONE_TO_FIVE_HUNDRED", label: "201-500 empleados" },
  { value: "FIVE_HUNDRED_PLUS", label: "500+ empleados" },
];

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

function getSizeLabel(size: string | null | undefined) {
  return COMPANY_SIZE_OPTIONS.find((opt) => opt.value === size)?.label ?? "Sin tamaño definido";
}

export default function CompanyForm({ companyId, initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial.name ?? "");
  const [size, setSize] = useState<CompanySize>((initial.size as CompanySize) ?? "");
  const [logoPreview, setLogoPreview] = useState(initial.logoUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startUpload } = useUploadThing("logoUploader");

  const isBusy = pending || isUploading;

  useEffect(() => {
    const changed =
      name !== (initial.name ?? "") ||
      size !== ((initial.size as CompanySize) ?? "") ||
      logoPreview !== (initial.logoUrl ?? "");

    setHasChanges(changed);
  }, [name, size, logoPreview, initial]);

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const restoreInitial = useCallback(() => {
    setName(initial.name ?? "");
    setSize((initial.size as CompanySize) ?? "");
    setLogoPreview(initial.logoUrl ?? "");
    resetFileInput();
  }, [initial]);

  const validateImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imágenes.");
      return false;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert("La imagen no debe superar 4 MB.");
      return false;
    }

    return true;
  };

  const uploadSurfaceClasses = useMemo(
    () =>
      [
        "relative rounded-2xl border border-dashed px-4 py-4 transition-all",
        isDragging
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
          : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-zinc-600",
      ].join(" "),
    [isDragging]
  );

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file || isUploading) return;
      if (!validateImage(file)) return;

      const oldPreview = logoPreview;

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(String(reader.result ?? ""));
      };
      reader.readAsDataURL(file);

      setIsUploading(true);

      try {
        const uploaded = await startUpload([file]);
        const first = uploaded?.[0] as { url?: string; fileUrl?: string } | undefined;
        const url = first?.url || first?.fileUrl;

        if (!url) {
          setLogoPreview(oldPreview);
          alert("No se pudo obtener la URL del archivo.");
          return;
        }

        const result = await setCompanyLogo(url);

        if (!result?.ok) {
          setLogoPreview(oldPreview);
          alert(result?.message || "No se pudo guardar el logo.");
          return;
        }

        setLogoPreview(url);
      } catch (error) {
        console.error("Upload error:", error);
        setLogoPreview(oldPreview);
        alert("Error al subir el archivo.");
      } finally {
        setIsUploading(false);
        resetFileInput();
      }
    },
    [isUploading, logoPreview, startUpload]
  );

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

      if (!result?.ok) {
        alert(result?.message || "No se pudo eliminar el logo.");
        return;
      }

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
    if (!trimmedName) {
      alert("El nombre de la empresa es obligatorio.");
      return;
    }

    startTransition(async () => {
      const result = await saveCompany({
        name: trimmedName,
        size: size || null,
      });

      if (!result?.ok) {
        alert(result?.message || "No se pudo guardar.");
        return;
      }

      setName(trimmedName);
      setHasChanges(false);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Company settings
              </div>

              <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
                Perfil de empresa
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Gestiona la identidad visual y la información principal de tu empresa con una
                configuración clara y consistente.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Empresa
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {name || "Sin nombre"}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {getSizeLabel(size)}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  <Wallet className="h-3.5 w-3.5" />
                  Créditos disponibles
                </div>

                <div className="mt-1 flex items-end gap-2">
                  <span className="text-2xl font-bold leading-none text-emerald-800 dark:text-emerald-200">
                    {initial.assessmentCredits ?? 0}
                  </span>
                  <span className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                    assessments
                  </span>
                </div>

                <Link
                  href="/dashboard/billing/credits"
                  className="mt-2 inline-flex text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  Ver detalle
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="order-2 lg:order-1">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Logo de empresa
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Una marca visual clara mejora la confianza y la presentación pública.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex min-h-[180px] items-center justify-center p-6">
                    {logoPreview ? (
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28">
                        <Image
                          src={logoPreview}
                          alt="Logo de la empresa"
                          fill
                          sizes="112px"
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                        <Building2 className="h-8 w-8 text-zinc-400 dark:text-zinc-600" />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label
                        className="relative inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
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

                        {isUploading ? (
                          <>
                            <Spinner className="h-4 w-4" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <Camera className="h-4 w-4" />
                            {logoPreview ? "Cambiar logo" : "Subir logo"}
                          </>
                        )}
                      </label>

                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={isBusy || !logoPreview}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        <Trash2 className="h-4 w-4" />
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>

                <label
                  className={uploadSurfaceClasses}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    disabled={isUploading}
                    onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
                  />

                  <div className="pointer-events-none text-center">
                    <Camera className="mx-auto mb-2 h-5 w-5 text-zinc-400" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Arrastra y suelta tu archivo aquí
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      PNG, JPG, WEBP o SVG · máximo 4 MB
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </aside>

          <div className="order-1 lg:order-2">
            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Información general
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Estos datos se reflejan en tu panel y en la presencia pública de la empresa.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="company-name"
                    className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
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
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="company-size"
                    className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    Tamaño de la empresa
                    <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      (opcional)
                    </span>
                  </label>

                  <select
                    id="company-size"
                    value={size}
                    onChange={(e) => setSize(e.target.value as CompanySize)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="">Selecciona un tamaño</option>
                    {COMPANY_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="submit"
                  disabled={isBusy || !hasChanges}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {pending ? <Spinner /> : <Save className="h-4 w-4" />}
                  {pending ? "Guardando..." : "Guardar cambios"}
                </button>

                <button
                  type="button"
                  onClick={restoreInitial}
                  disabled={isBusy || !hasChanges}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  <Undo2 className="h-4 w-4" />
                  Restablecer
                </button>

                <div className="text-xs text-zinc-500 dark:text-zinc-400 sm:ml-auto">
                  {hasChanges ? (
                    <span className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Cambios pendientes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Todo está guardado
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div>
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