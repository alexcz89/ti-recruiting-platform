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

  const handleChange = (field: keyof Props["data"]) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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
      {/* Banner informativo compacto */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
        <p className="text-xs text-blue-800">
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
        <label
          htmlFor="location"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          <MapPin className="inline h-3.5 w-3.5 mr-1" />
          Ubicación{" "}
          <span className="text-xs text-gray-400">(opcional)</span>
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
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="Escribe tu ciudad..."
        />
        <p className="mt-0.5 text-xs text-gray-500">
          Te mostraremos trabajos cerca de ti y opciones remotas
        </p>
      </div>

      {/* Redes sociales colapsables */}
      <div>
        <button
          type="button"
          onClick={() => setShowSocial((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Linkedin className="h-3.5 w-3.5 text-[#0077b5]" />
            <Github className="h-3.5 w-3.5 text-gray-700" />
            Agregar LinkedIn y GitHub
            {(data.linkedin || data.github) && (
              <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                {[data.linkedin, data.github].filter(Boolean).length} agregado{[data.linkedin, data.github].filter(Boolean).length > 1 ? "s" : ""}
              </span>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${showSocial ? "rotate-180" : ""}`}
          />
        </button>

        {showSocial && (
          <div className="mt-2 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            {/* LinkedIn */}
            <div>
              <label
                htmlFor="linkedin"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                <Linkedin className="inline h-3.5 w-3.5 mr-1 text-[#0077b5]" />
                LinkedIn
              </label>
              <input
                id="linkedin"
                type="url"
                value={data.linkedin}
                onChange={handleChange("linkedin")}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="https://linkedin.com/in/tu-perfil"
              />
            </div>

            {/* GitHub */}
            <div>
              <label
                htmlFor="github"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                <Github className="inline h-3.5 w-3.5 mr-1" />
                GitHub
              </label>
              <input
                id="github"
                type="url"
                value={data.github}
                onChange={handleChange("github")}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="https://github.com/tu-usuario"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tip CV */}
      {!fromCvBuilder && (
        <p className="text-xs text-gray-400 text-center">
          ℹ️ Después podrás agregar CV, experiencia y skills en tu perfil
        </p>
      )}

      {/* Botones — sticky en móvil */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm pt-2 pb-3 border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            ← Atrás
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? fromCvBuilder
                ? "Creando cuenta..."
                : "Creando cuenta..."
              : fromCvBuilder
              ? "Crear cuenta y guardar CV"
              : "Crear cuenta"}
          </button>
        </div>

        {!hasMinimumData && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1.5 w-full text-center text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Omitir por ahora y crear cuenta
          </button>
        )}
      </div>
    </form>
  );
}