// app/dashboard/profile/CompanyForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  Undo2,
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
  return COMPANY_SIZE_OPTIONS.find((opt) => opt.value === size)?.label ?? "Sin definir";
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

  const cardClasses = useMemo(
    () =>
      [
        "relative rounded-2xl border-2 border-dashed p-4 sm:p-5 transition-all",
        isDragging
          ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/10"
          : "border-zinc-300 bg-zinc-50/70 hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:border-emerald-600",
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
    <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-4 sm:px-6 sm:py-5 dark:border-zinc-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Perfil de empresa
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Actualiza el nombre, el tamaño y la identidad visual de tu empresa.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="font-medium text-zinc-900 dark:text-zinc-100">{name || "Sin nombre"}</div>
              <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                {getSizeLabel(size)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Identidad visual
            </div>

            <div className="mx-auto w-fit lg:mx-0">
              {logoPreview ? (
                <div className="relative h-28 w-28 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:h-32 sm:w-32">
                  <Image
                    src={logoPreview}
                    alt="Logo de la empresa"
                    fill
                    sizes="128px"
                    className="object-contain p-3"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={isBusy}
                    className="absolute -right-2 -top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Eliminar logo"
                  >
                    {isUploading ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 sm:h-32 sm:w-32">
                  <Building2 className="h-10 w-10 text-zinc-400 dark:text-zinc-600" />
                </div>
              )}
            </div>

            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Recomendado: imagen cuadrada, mínimo 200×200 px.
            </p>
          </aside>

          <div className="space-y-6">
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

            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Logo
              </label>

              <label
                className={cardClasses}
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

                <div className="pointer-events-none text-center">
                  {isUploading ? (
                    <>
                      <Spinner className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-600">
                        Subiendo logo...
                      </p>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="mx-auto mb-2 h-6 w-6 text-zinc-400" />
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        Arrastra tu logo aquí o{" "}
                        <span className="text-emerald-600">haz clic para seleccionar</span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        PNG, JPG, WEBP o SVG · máximo 4 MB
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="submit"
            disabled={isBusy || !hasChanges}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            Descartar cambios
          </button>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 sm:ml-auto">
            {hasChanges ? (
              <span className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Tienes cambios sin guardar
              </span>
            ) : (
              "Todo está guardado"
            )}
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