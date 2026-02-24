// app/dashboard/jobs/new/JobWizard/components/Step6Review.tsx
"use client";

import { useFormContext } from "react-hook-form";
import { Briefcase, DollarSign, Gift, BookOpen, FileText, Globe } from "lucide-react";
import { JobForm, PresetCompany } from "../types";
import { BENEFITS } from "../constants";
import {
  labelEmployment,
  labelDegree,
  labelLanguageLevel,
  sanitizeHtml,
} from "../utils/helpers";

type Tab = "desc" | "skills" | "langs" | "edu";

type Props = {
  presetCompany: PresetCompany;
  busy: boolean;
  isEditing: boolean;
  onBack: () => void;
  onEditStep: (step: number) => void;
  onEditTab: (tab: Tab) => void;
};

function EditBtn({ label, onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md px-2 py-1"
      onClick={onClick}
    >
      {label ?? "Editar"}
    </button>
  );
}

function ReviewCard({
  icon,
  title,
  onEdit,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          {icon}
          {title}
        </h4>
        <EditBtn onClick={onEdit} />
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{value ?? "—"}</span>
    </div>
  );
}

export default function Step6Review({
  presetCompany,
  busy,
  isEditing,
  onBack,
  onEditStep,
  onEditTab,
}: Props) {
  const { watch } = useFormContext<JobForm>();
  const v = watch();

  // Ubicación
  const isRemote = v.locationType === "REMOTE";
  const locationText = isRemote
    ? "Remoto"
    : `${v.locationType === "HYBRID" ? "Híbrido" : "Presencial"} • ${v.city || ""}`;

  // Salario
  const salaryMin = typeof v.salaryMin === "number" && !Number.isNaN(v.salaryMin) ? v.salaryMin : undefined;
  const salaryMax = typeof v.salaryMax === "number" && !Number.isNaN(v.salaryMax) ? v.salaryMax : undefined;
  const fmt = (n: number) => new Intl.NumberFormat("es-MX").format(n);
  const salaryText =
    salaryMin == null && salaryMax == null
      ? "No especificado"
      : salaryMin != null && salaryMax != null
      ? `${v.currency} ${fmt(salaryMin)} - ${fmt(salaryMax)}`
      : salaryMin != null
      ? `Desde ${v.currency} ${fmt(salaryMin)}`
      : `Hasta ${v.currency} ${fmt(salaryMax!)}`;

  // Prestaciones
  const benefitsList = Object.entries(v.benefits || {})
    .filter(([, val]) => val)
    .map(([k]) => {
      if (k === "aguinaldo") return `Aguinaldo: ${v.aguinaldoDias} días`;
      if (k === "vacaciones") return `Vacaciones: ${v.vacacionesDias} días`;
      if (k === "primaVac") return `Prima vacacional: ${v.primaVacPct}%`;
      return BENEFITS.find((b) => b.key === k)?.label ?? k;
    });

  const safeDescHtml = sanitizeHtml(v.descriptionHtml || "");
  const hasDescription = Boolean(v.descriptionPlain?.trim());

  return (
    <div className="space-y-8 rounded-xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
        6) Revisión y publicación
      </h3>

      <div className="grid gap-6">
        {/* 1. Información básica */}
        <ReviewCard
          icon={<Briefcase className="h-5 w-5 text-emerald-500" />}
          title="Información básica"
          onEdit={() => onEditStep(1)}
        >
          <div className="grid gap-4">
            <Row label="Título de la vacante" value={<span className="text-base font-medium text-zinc-900 dark:text-zinc-100">{v.title}</span>} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Row
                label="Empresa"
                value={v.companyMode === "confidential" ? "Confidencial" : presetCompany?.name || "Mi empresa"}
              />
              <Row label="Ubicación" value={locationText} />
            </div>
          </div>
        </ReviewCard>

        {/* 2. Compensación */}
        <ReviewCard
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
          title="Compensación"
          onEdit={() => onEditStep(2)}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Row label="Sueldo" value={salaryText} />
            <Row label="Tipo de empleo" value={labelEmployment(v.employmentType)} />
            {v.schedule && <Row label="Horario" value={v.schedule} />}
          </div>
        </ReviewCard>

        {/* 3. Prestaciones */}
        <ReviewCard
          icon={<Gift className="h-5 w-5 text-emerald-500" />}
          title="Prestaciones"
          onEdit={() => onEditStep(3)}
        >
          {benefitsList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {benefitsList.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100"
                >
                  {b}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin prestaciones adicionales.</p>
          )}
        </ReviewCard>

        {/* 4. Evaluación técnica */}
        {v.assessmentTemplateId && (
          <ReviewCard
            icon={<FileText className="h-5 w-5 text-emerald-500" />}
            title="Evaluación técnica"
            onEdit={() => onEditStep(4)}
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Evaluación seleccionada — ID: <span className="font-mono text-xs">{v.assessmentTemplateId}</span>
            </p>
          </ReviewCard>
        )}

        {/* 5. Requisitos */}
        <ReviewCard
          icon={<BookOpen className="h-5 w-5 text-emerald-500" />}
          title="Requisitos"
          onEdit={() => { onEditStep(5); onEditTab("skills"); }}
        >
          <div className="grid gap-4">
            {/* Skills */}
            {(v.requiredSkills?.length > 0 || v.niceSkills?.length > 0) && (
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {v.requiredSkills?.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100">
                      {s} <span className="text-emerald-500">★</span>
                    </span>
                  ))}
                  {v.niceSkills?.map((s) => (
                    <span key={s} className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Educación */}
            {(v.eduRequired?.length > 0 || v.eduNice?.length > 0) && (
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                  Educación · {labelDegree(v.minDegree)} mínimo
                </p>
                <div className="flex flex-wrap gap-2">
                  {v.eduRequired?.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/60 px-3 py-1 text-xs font-medium text-blue-900 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-100">
                      {e} <span className="text-blue-500">★</span>
                    </span>
                  ))}
                  {v.eduNice?.map((e) => (
                    <span key={e} className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certificaciones */}
            {v.certs?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Certificaciones</p>
                <div className="flex flex-wrap gap-2">
                  {v.certs.map((c) => (
                    <span key={c} className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50/60 px-3 py-1 text-xs font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-100">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Idiomas */}
            {v.languages?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Idiomas</p>
                <div className="flex flex-wrap gap-2">
                  {v.languages.map((l, i) => (
                    <span key={i} className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50/60 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100">
                      {l.name} · {labelLanguageLevel(l.level)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!v.requiredSkills?.length && !v.niceSkills?.length && !v.eduRequired?.length && !v.eduNice?.length && !v.certs?.length && !v.languages?.length && (
              <p className="text-sm text-zinc-500">Sin requisitos adicionales.</p>
            )}
          </div>
        </ReviewCard>

        {/* 6. Descripción */}
        <ReviewCard
          icon={<Globe className="h-5 w-5 text-emerald-500" />}
          title="Descripción"
          onEdit={() => { onEditStep(5); onEditTab("desc"); }}
        >
          {hasDescription ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none max-h-64 overflow-auto text-sm text-zinc-700 dark:text-zinc-300"
              dangerouslySetInnerHTML={{ __html: safeDescHtml }}
            />
          ) : (
            <p className="text-sm text-zinc-500">Sin descripción.</p>
          )}
        </ReviewCard>
      </div>

      {/* Navegación */}
      <div className="pt-10 mt-10 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <button
            type="button"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            onClick={onBack}
          >
            Atrás
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-emerald-300 disabled:cursor-not-allowed transition shadow-sm hover:shadow-md"
          >
            {busy
              ? isEditing ? "Guardando..." : "Publicando..."
              : isEditing ? "Guardar cambios" : "Publicar vacante"}
          </button>
        </div>
      </div>
    </div>
  );
}