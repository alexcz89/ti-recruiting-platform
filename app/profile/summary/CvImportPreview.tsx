"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileSearch, ShieldCheck, X } from "lucide-react";
import type {
  CvImportAnalysis,
  CvImportSections,
} from "@/lib/profile/cv-import";

type Props = {
  analysis: CvImportAnalysis;
  fileName: string;
  currentCounts: {
    experiences: number;
    education: number;
    skills: number;
    languages: number;
  };
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onApply: (sections: CvImportSections) => void;
};

function detectedPersonal(analysis: CvImportAnalysis) {
  return [
    analysis.location && `Ubicación: ${analysis.location}`,
    analysis.phonePrimary && `Teléfono: ${analysis.phonePrimary}`,
    analysis.linkedin && "LinkedIn",
    analysis.github && "GitHub",
    `Seniority estimado: ${analysis.seniority}`,
    analysis.yearsExperience > 0 && `${analysis.yearsExperience} años de experiencia`,
  ].filter(Boolean) as string[];
}

export default function CvImportPreview({
  analysis,
  fileName,
  currentCounts,
  busy,
  error,
  onCancel,
  onApply,
}: Props) {
  const personal = useMemo(() => detectedPersonal(analysis), [analysis]);
  const [sections, setSections] = useState<CvImportSections>({
    personal: personal.length > 0,
    experiences: analysis.experiences.length > 0,
    education: analysis.education.length > 0,
    skills: analysis.skillsMatched.length > 0,
    languages: analysis.languages.length > 0,
  });

  const rows = [
    {
      key: "personal" as const,
      label: "Datos personales",
      detected: personal.length,
      current: null,
      preview: personal.slice(0, 3).join(" · ") || "Sin datos nuevos detectados",
    },
    {
      key: "experiences" as const,
      label: "Experiencia",
      detected: analysis.experiences.length,
      current: currentCounts.experiences,
      preview:
        analysis.experiences
          .slice(0, 2)
          .map((item) => `${item.role} en ${item.company}`)
          .join(" · ") || "Sin experiencia detectada",
    },
    {
      key: "education" as const,
      label: "Educación",
      detected: analysis.education.length,
      current: currentCounts.education,
      preview:
        analysis.education
          .slice(0, 2)
          .map((item) => item.program || item.institution)
          .join(" · ") || "Sin educación detectada",
    },
    {
      key: "skills" as const,
      label: "Skills",
      detected: analysis.skillsMatched.length,
      current: currentCounts.skills,
      preview:
        analysis.skillsMatched
          .slice(0, 6)
          .map((item) => item.label)
          .join(" · ") || "Sin skills del catálogo detectados",
    },
    {
      key: "languages" as const,
      label: "Idiomas",
      detected: analysis.languages.length,
      current: currentCounts.languages,
      preview:
        analysis.languages
          .slice(0, 4)
          .map((item) => item.label)
          .join(" · ") || "Sin idiomas detectados",
    },
  ];
  const selectedCount = Object.values(sections).filter(Boolean).length;

  return (
    <section
      aria-labelledby="cv-import-title"
      className="overflow-hidden rounded-xl border border-emerald-200 bg-white dark:border-emerald-900/60 dark:bg-zinc-950"
    >
      <div className="relative flex flex-col gap-4 border-b border-emerald-100 bg-emerald-50/70 px-4 py-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <FileSearch className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="cv-import-title" className="text-base font-semibold text-zinc-950 dark:text-white">
              Revisa antes de actualizar tu perfil
            </h2>
            <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
              {fileName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Cancelar importación del CV"
          className="absolute right-4 rounded-md p-2 text-zinc-500 hover:bg-white/80 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-white sm:static"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            El archivo todavía no se ha reemplazado. Al confirmar, TaskIO conservará tus datos actuales y sólo agregará información que no exista.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </p>
        )}

        <fieldset className="divide-y divide-zinc-100 border-y border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          <legend className="sr-only">Secciones del perfil que se actualizarán</legend>
          {rows.map((row) => {
            const disabled = row.detected === 0;
            return (
              <label
                key={row.key}
                className={`flex min-h-[72px] cursor-pointer items-start gap-3 py-3 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={sections[row.key]}
                  disabled={disabled || busy}
                  onChange={(event) =>
                    setSections((current) => ({
                      ...current,
                      [row.key]: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {row.label}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {row.detected} detectado{row.detected === 1 ? "" : "s"}
                    </span>
                    {row.current !== null && row.current > 0 && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {row.current} ya en tu perfil
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {row.preview}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            No se borrará ni sobrescribirá información existente.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="min-h-[42px] rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onApply(sections)}
              disabled={busy || selectedCount === 0}
              className="min-h-[42px] rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Actualizando perfil…" : "Aplicar y reemplazar CV"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
