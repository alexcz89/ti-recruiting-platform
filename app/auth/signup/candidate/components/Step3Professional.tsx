// app/auth/signup/candidate/components/Step3Professional.tsx
"use client";

import { useState } from "react";
import { Linkedin, Github, MapPin, ChevronDown } from "lucide-react";
import PhoneInputField from "@/components/PhoneInputField";
import LocationAutocomplete, { type PlaceResult } from "@/components/LocationAutocomplete";

interface Props {
  data: {
    phone: string;
    location: string;
    linkedin: string;
    github: string;
  };
  onChange: (updates: Partial<Props["data"]> & {
    locationLat?: number;
    locationLng?: number;
    placeId?: string;
    city?: string;
    admin1?: string;
    country?: string;
    cityNorm?: string;
    admin1Norm?: string;
  }) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  fromCvBuilder?: boolean;
}

// Clases reutilizables
const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors";

const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1";

export default function Step3Professional({
  data,
  onChange,
  onSubmit,
  onBack,
  isSubmitting,
  fromCvBuilder = false,
}: Props) {
  const [showSocial, setShowSocial] = useState(
    !!(data.linkedin || data.github)
  );

  const handleChange =
    (field: keyof Props["data"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ [field]: e.target.value });
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const hasMinimumData =
    data.location.trim() ||
    data.linkedin.trim() ||
    data.github.trim() ||
    data.phone.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Banner informativo */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/50 px-3 py-2">
        <p className="text-xs text-blue-800 dark:text-blue-300 hyphens-none">
          💼 <strong>Datos opcionales</strong> — puedes completarlos ahora o después en tu perfil.
        </p>
      </div>

      {/* Teléfono */}
      <div>
        <PhoneInputField
          value={data.phone}
          onChange={(val) => onChange({ phone: val })}
          label="Teléfono"
          helperText="Para que empresas puedan contactarte por WhatsApp"
        />
      </div>

      {/* Ubicación */}
      <div>
        <label htmlFor="location" className={labelClass}>
          <MapPin className="inline h-3.5 w-3.5 mr-1" />
          Ubicación{" "}
          <span className="text-xs text-zinc-400 dark:text-zinc-500">(opcional)</span>
        </label>
        <LocationAutocomplete
          value={data.location}
          onChange={(val) => onChange({ location: val })}
          onPlace={(place: PlaceResult) => {
            onChange({
              location: place.label,
              locationLat: place.lat,
              locationLng: place.lng,
              city: place.city,
              admin1: place.admin1,
              country: place.country,
              cityNorm: place.cityNorm,
              admin1Norm: place.admin1Norm,
            });
          }}
          countries={["mx", "us", "co", "ar", "cl", "pe"]}
          className={inputClass}
          placeholder="Escribe tu ciudad..."
        />
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 hyphens-none">
          Te mostraremos trabajos cerca de ti y opciones remotas
        </p>
      </div>

      {/* Redes sociales colapsables */}
      <div>
        <button
          type="button"
          onClick={() => setShowSocial((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-3 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Linkedin className="h-3.5 w-3.5 text-[#0077b5]" />
            <Github className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
            Agregar LinkedIn y GitHub
            {(data.linkedin || data.github) && (
              <span className="ml-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {[data.linkedin, data.github].filter(Boolean).length} agregado
                {[data.linkedin, data.github].filter(Boolean).length > 1 ? "s" : ""}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-zinc-400 transition-transform ${showSocial ? "rotate-180" : ""}`}
          />
        </button>

        {showSocial && (
          <div className="mt-2 space-y-2 rounded-lg border border-zinc-100 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/40 p-3">
            {/* LinkedIn */}
            <div>
              <label htmlFor="linkedin" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                <Linkedin className="inline h-3.5 w-3.5 mr-1 text-[#0077b5]" />
                LinkedIn
              </label>
              <input
                id="linkedin"
                type="url"
                value={data.linkedin}
                onChange={handleChange("linkedin")}
                className={inputClass}
                placeholder="https://linkedin.com/in/tu-perfil"
              />
            </div>

            {/* GitHub */}
            <div>
              <label htmlFor="github" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                <Github className="inline h-3.5 w-3.5 mr-1" />
                GitHub
              </label>
              <input
                id="github"
                type="url"
                value={data.github}
                onChange={handleChange("github")}
                className={inputClass}
                placeholder="https://github.com/tu-usuario"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tip CV */}
      {!fromCvBuilder && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center hyphens-none">
          ℹ️ Después podrás agregar CV, experiencia y skills en tu perfil
        </p>
      )}

      {/* Botones — sticky en móvil */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm pt-2 pb-3 border-t border-zinc-100 dark:border-zinc-800 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 hyphens-none"
          >
            ← Atrás
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 hyphens-none"
          >
            {isSubmitting
              ? "Creando cuenta..."
              : fromCvBuilder
              ? "Crear cuenta y guardar CV"
              : "Crear cuenta"}
          </button>
        </div>

        {!hasMinimumData && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1.5 w-full text-center text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 underline transition-colors hyphens-none"
          >
            Omitir por ahora y crear cuenta
          </button>
        )}
      </div>
    </form>
  );
}