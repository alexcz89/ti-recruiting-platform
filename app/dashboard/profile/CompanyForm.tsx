// app/dashboard/profile/CompanyForm.tsx
"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";
import { saveCompany, setCompanyLogo } from "@/app/dashboard/company/actions";
import Image from "next/image";
import { Upload, X, Check, Building2 } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";

type Props = {
  companyId: string;
  initial: {
    name: string;
    size: string;
    logoUrl: string;
  };
};

export default function CompanyForm({ companyId, initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [logoPreview, setLogoPreview] = useState(initial.logoUrl);
  const [name, setName] = useState(initial.name);
  const [size, setSize] = useState(initial.size);
  const [hasChanges, setHasChanges] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("logoUploader");

  // Detectar cambios
  useEffect(() => {
    const changed =
      name !== initial.name ||
      size !== initial.size ||
      logoPreview !== initial.logoUrl;
    setHasChanges(changed);
  }, [name, size, logoPreview, initial]);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toastError("Solo se permiten imágenes");
      return;
    }

    // Validar tamaño (4MB)
    if (file.size > 4 * 1024 * 1024) {
      toastError("La imagen no debe superar 4 MB");
      return;
    }

    // Mostrar preview inmediato
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Subir a UploadThing
    setIsUploading(true);
    try {
      const uploadedFiles = await startUpload([file]);

      if (!uploadedFiles || uploadedFiles.length === 0) {
        toastError("Error al subir el archivo");
        setLogoPreview(initial.logoUrl); // Revertir preview
        return;
      }

      // Obtener URL del archivo subido
      const uploadedFile = uploadedFiles[0] as any;
      const url = uploadedFile.url || uploadedFile.fileUrl;

      if (!url) {
        toastError("No se recibió URL del archivo");
        setLogoPreview(initial.logoUrl);
        return;
      }

      // Guardar en base de datos
      const res = await setCompanyLogo(url);

      if (res.ok) {
        setLogoPreview(url);
        toastSuccess("Logo actualizado correctamente");
      } else {
        toastError(res.message || "Error al guardar el logo");
        setLogoPreview(initial.logoUrl);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toastError(error?.message || "Error al subir el archivo");
      setLogoPreview(initial.logoUrl);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  const handleRemoveLogo = async () => {
    setIsUploading(true);
    try {
      const { removeCompanyLogo } = await import("@/app/dashboard/company/actions");
      const res = await removeCompanyLogo();

      if (res.ok) {
        setLogoPreview("");
        toastSuccess("Logo eliminado");
      } else {
        toastError(res.message || "Error al eliminar el logo");
      }
    } catch (error) {
      toastError("Error al eliminar el logo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDiscard = () => {
    setName(initial.name);
    setSize(initial.size);
    setLogoPreview(initial.logoUrl);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const res = await saveCompany({ name, size: size || null });
      if (res?.ok) {
        toastSuccess(res.message || "Empresa actualizada");
        setHasChanges(false);
      } else {
        toastError(res?.message || "Error al guardar");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Logo Upload */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-default">Logo</label>

        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="relative shrink-0">
            {logoPreview ? (
              <div className="relative h-20 w-20 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
                <Image
                  src={logoPreview}
                  alt="Logo preview"
                  fill
                  className="object-contain p-2"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isUploading}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Quitar logo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-20 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-zinc-400 dark:text-zinc-600" />
              </div>
            )}
          </div>

          {/* Upload Area */}
          <div className="flex-1 space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed transition-colors p-4 ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:border-emerald-400 dark:hover:border-emerald-600"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />

              <div className="text-center pointer-events-none">
                {isUploading ? (
                  <>
                    <svg
                      className="animate-spin h-6 w-6 mx-auto text-emerald-600 mb-2"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Subiendo archivo...
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-zinc-400 dark:text-zinc-600 mb-2" />
                    <p className="text-xs font-medium text-default">
                      Arrastra tu logo aquí o{" "}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        haz clic para seleccionar
                      </span>
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      PNG, JPG, WEBP, SVG hasta 4 MB
                    </p>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-muted">
              Se mostrará en tus vacantes públicas. Recomendado: cuadrado, mínimo 200x200px.
            </p>
          </div>
        </div>
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-default">
          Nombre de la empresa
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Mi Empresa S.A."
          className="w-full rounded-lg border glass-card p-3 transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {/* Company Size */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-default">
          Tamaño de la empresa
          <span className="ml-1 text-xs text-muted font-normal">(opcional)</span>
        </label>
        <select
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="w-full rounded-lg border glass-card p-3 transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="">Selecciona un tamaño</option>
          <option value="1-10">1-10 empleados</option>
          <option value="11-50">11-50 empleados</option>
          <option value="51-200">51-200 empleados</option>
          <option value="201-500">201-500 empleados</option>
          <option value="501-1000">501-1000 empleados</option>
          <option value="1001+">1001+ empleados</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !hasChanges}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Guardando...
            </span>
          ) : (
            "Guardar cambios"
          )}
        </button>

        {hasChanges && !pending && (
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-medium text-default hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Descartar cambios
          </button>
        )}

        {hasChanges && (
          <span className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
            Cambios sin guardar
          </span>
        )}
      </div>

      {/* Back to Overview */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <a
          href="/dashboard/overview"
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Regresar al overview
        </a>
      </div>
    </form>
  );
}