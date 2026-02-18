// app/auth/signup/candidate/components/Step3Professional.tsx
"use client";

import { useState } from "react";
import { Linkedin, Github, MapPin, Phone } from "lucide-react";
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
  const handleChange = (field: keyof Props["data"]) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ [field]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  // Validar que al menos tenga ubicación O algún campo profesional
  const hasMinimumData = 
    data.location.trim() || 
    data.linkedin.trim() || 
    data.github.trim() ||
    data.phone.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mensaje informativo */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
        <p className="text-xs text-blue-900">
          💼 <strong>Estos datos son opcionales</strong> pero te ayudarán a encontrar mejores oportunidades.
          Puedes completarlos ahora o después en tu perfil.
        </p>
      </div>

      {/* Teléfono con Lada */}
      <div>
        <PhoneInputField
          value={data.phone}
          onChange={(val) => onChange({ phone: val })}
          label="Teléfono"
          helperText="Para que las empresas puedan contactarte por WhatsApp o llamada"
        />
      </div>

      {/* Ubicación con Autocomplete */}
      <div>
        <label 
          htmlFor="location" 
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          <MapPin className="inline h-4 w-4 mr-1" />
          Ubicación <span className="text-xs text-gray-400">(opcional)</span>
        </label>
        <LocationAutocomplete
          value={data.location}
          onChange={(val) => onChange({ location: val })}
          onPlace={(place: PlaceResult) => {
            // ✅ Capturar datos estructurados de la ubicación
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
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="Escribe tu ciudad..."
        />
        <p className="mt-1 text-xs text-gray-500">
          Te mostraremos trabajos cerca de ti y opciones remotas
        </p>
      </div>

      {/* LinkedIn */}
      <div>
        <label 
          htmlFor="linkedin" 
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          <Linkedin className="inline h-4 w-4 mr-1" />
          LinkedIn <span className="text-xs text-gray-400">(opcional)</span>
        </label>
        <input
          id="linkedin"
          type="url"
          value={data.linkedin}
          onChange={handleChange("linkedin")}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="https://linkedin.com/in/tu-perfil"
        />
      </div>

      {/* GitHub */}
      <div>
        <label 
          htmlFor="github" 
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          <Github className="inline h-4 w-4 mr-1" />
          GitHub <span className="text-xs text-gray-400">(opcional)</span>
        </label>
        <input
          id="github"
          type="url"
          value={data.github}
          onChange={handleChange("github")}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="https://github.com/tu-usuario"
        />
      </div>

      {/* Tip adicional */}
      {!fromCvBuilder && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
          <p className="text-xs text-emerald-900">
            ℹ️ Después podrás agregar tu CV, experiencia laboral, educación y skills en tu perfil
          </p>
        </div>
      )}

      {/* Botones de navegación */}
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
          {isSubmitting ? (
            fromCvBuilder ? (
              "Creando cuenta e importando CV..."
            ) : (
              "Creando cuenta..."
            )
          ) : (
            fromCvBuilder ? (
              "Crear cuenta y guardar CV"
            ) : (
              "Crear cuenta"
            )
          )}
        </button>
      </div>

      {/* Opción de omitir */}
      {!hasMinimumData && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Omitir por ahora y crear cuenta
        </button>
      )}
    </form>
  );
}