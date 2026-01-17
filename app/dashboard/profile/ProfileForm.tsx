// app/dashboard/profile/ProfileForm.tsx
"use client";

import { useTransition, useState, useEffect } from "react";
import { toast } from "sonner";
import { saveRecruiterProfile } from "./actions";
import PhoneInputField from "@/components/PhoneInputField";
import { Check, X, ExternalLink, Globe } from "lucide-react";

type Props = {
  initial: { phone: string; website: string };
};

export default function ProfileForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState(initial.phone || "");
  const [website, setWebsite] = useState(initial.website || "");
  const [hasChanges, setHasChanges] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(false);

  // Detectar cambios
  useEffect(() => {
    const changed =
      phone !== (initial.phone || "") || website !== (initial.website || "");
    setHasChanges(changed);
  }, [phone, website, initial]);

  // Validar URL
  useEffect(() => {
    if (!website) {
      setIsValidUrl(false);
      return;
    }

    try {
      // Agregar https:// si no tiene protocolo
      const urlToTest = website.startsWith("http")
        ? website
        : `https://${website}`;
      new URL(urlToTest);
      setIsValidUrl(true);
    } catch {
      setIsValidUrl(false);
    }
  }, [website]);

  const handleDiscard = () => {
    setPhone(initial.phone || "");
    setWebsite(initial.website || "");
  };

  const normalizeUrl = (url: string) => {
    if (!url) return "";
    return url.startsWith("http") ? url : `https://${url}`;
  };

  return (
    <form
      action={(formData: FormData) => {
        formData.set("phone", phone);
        formData.set("website", normalizeUrl(website));

        startTransition(async () => {
          const res = await saveRecruiterProfile(null as any, formData);
          if (res?.ok) {
            toast.success(res.message || "Perfil actualizado");
            setHasChanges(false);
          } else {
            toast.error(res?.message || "Error al guardar");
          }
        });
      }}
      className="space-y-6"
      id="contact"
    >
      {/* Phone Input */}
      <PhoneInputField
        value={phone}
        onChange={setPhone}
        label="Teléfono"
        helperText="Guardamos el número en formato internacional para que funcionen los botones de WhatsApp y llamadas."
      />

      {/* Website Input with validation */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-default">
          Sitio web
          <span className="ml-1 text-xs text-muted font-normal">(opcional)</span>
        </label>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Globe className="h-4 w-4 text-muted" />
          </div>

          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="miempresa.com"
            className="w-full rounded-lg border glass-card p-3 pl-10 pr-10 transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />

          {website && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {isValidUrl ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <X className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted">
            Puedes escribir &quot;miempresa.com&quot; o la URL completa.
          </p>

          {website && isValidUrl && (
            <a
              href={normalizeUrl(website)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              Vista previa
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
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
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
    </form>
  );
}
