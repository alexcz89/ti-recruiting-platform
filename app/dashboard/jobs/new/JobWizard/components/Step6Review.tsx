// app/dashboard/jobs/new/JobWizard/components/Step6Review.tsx
"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import {
  Briefcase,
  DollarSign,
  Gift,
  BookOpen,
  FileText,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { JobForm, PresetCompany } from "../types";
import { BENEFITS } from "../constants";
import {
  labelEmployment,
  labelDegree,
  labelLanguageLevel,
  sanitizeHtml,
  getJobQualitySummary,
} from "../utils/helpers";
import WizardWarningModal from "./WizardWarningModal";

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
      className="rounded-md px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
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
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h4 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
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

function qualityTone(score: number) {
  if (score >= 80) {
    return {
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300",
      bar: "bg-emerald-500",
      label: "Alta",
    };
  }

  if (score >= 55) {
    return {
      badge:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300",
      bar: "bg-amber-500",
      label: "Media",
    };
  }

  return {
    badge:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300",
    bar: "bg-red-500",
    label: "Baja",
  };
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
  const [showPublishWarningModal, setShowPublishWarningModal] = useState(false);

  const isRemote = v.locationType === "REMOTE";
  const locationText = isRemote
    ? "Remoto"
    : `${v.locationType === "HYBRID" ? "Híbrido" : "Presencial"} • ${v.city || ""}`;

  const salaryMin =
    typeof v.salaryMin === "number" && !Number.isNaN(v.salaryMin)
      ? v.salaryMin
      : undefined;
  const salaryMax =
    typeof v.salaryMax === "number" && !Number.isNaN(v.salaryMax)
      ? v.salaryMax
      : undefined;
  const fmt = (n: number) => new Intl.NumberFormat("es-MX").format(n);
  const salaryText =
    salaryMin == null && salaryMax == null
      ? "No especificado"
      : salaryMin != null && salaryMax != null
        ? `${v.currency} ${fmt(salaryMin)} - ${fmt(salaryMax)}`
        : salaryMin != null
          ? `Desde ${v.currency} ${fmt(salaryMin)}`
          : `Hasta ${v.currency} ${fmt(salaryMax!)}`;

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
  const degreeLabel = v.minDegree ? labelDegree(v.minDegree) : "Sin especificar";

  const quality = getJobQualitySummary(v);
  const missingRecommended = quality.missingRecommended;
  const tone = qualityTone(quality.score);

  function handleSubmitWarning(
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) {
    if (busy) return;

    if (missingRecommended.length > 0) {
      e.preventDefault();
      setShowPublishWarningModal(true);
    }
  }

  return (
    <div className="space-y-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-bold text-zinc-900 sm:text-xl dark:text-zinc-100">
        6) Revisión y publicación
      </h3>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Calidad de la vacante
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Basada en descripción, skills, sueldo, educación y otros elementos clave.
            </p>
          </div>

          <div
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}
          >
            {quality.score}/100 · {tone.label}
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${tone.bar}`}
            style={{ width: `${Math.max(0, Math.min(quality.score, 100))}%` }}
          />
        </div>

        {quality.strengths.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Fortalezas
            </p>
            <div className="flex flex-wrap gap-2">
              {quality.strengths.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {missingRecommended.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Recomendaciones antes de publicar
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-300/90">
            Tu vacante está lista para publicarse, pero le faltan elementos recomendados:
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-800 dark:text-amber-300/90">
            {missingRecommended.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6">
        <ReviewCard
          icon={<Briefcase className="h-5 w-5 text-emerald-500" />}
          title="Información básica"
          onEdit={() => onEditStep(1)}
        >
          <div className="grid gap-4">
            <Row
              label="Título de la vacante"
              value={
                <span className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {v.title}
                </span>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Row
                label="Empresa"
                value={
                  v.companyMode === "confidential"
                    ? "Confidencial"
                    : presetCompany?.name || "Mi empresa"
                }
              />
              <Row label="Ubicación" value={locationText} />
            </div>
          </div>
        </ReviewCard>

        <ReviewCard
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
          title="Compensación"
          onEdit={() => onEditStep(2)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Sueldo" value={salaryText} />
            <Row label="Tipo de empleo" value={labelEmployment(v.employmentType)} />
            {v.schedule && <Row label="Horario" value={v.schedule} />}
          </div>
        </ReviewCard>

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

        {v.assessmentTemplateId && (
          <ReviewCard
            icon={<FileText className="h-5 w-5 text-emerald-500" />}
            title="Evaluación técnica"
            onEdit={() => onEditStep(5)}
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Evaluación seleccionada — ID:{" "}
              <span className="font-mono text-xs">{v.assessmentTemplateId}</span>
            </p>
          </ReviewCard>
        )}

        <ReviewCard
          icon={<BookOpen className="h-5 w-5 text-emerald-500" />}
          title="Requisitos"
          onEdit={() => {
            onEditStep(4);
            onEditTab("skills");
          }}
        >
          <div className="grid gap-4">
            {(v.requiredSkills?.length > 0 || v.niceSkills?.length > 0) && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {v.requiredSkills?.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100"
                    >
                      {s} <span className="text-emerald-500">★</span>
                    </span>
                  ))}
                  {v.niceSkills?.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(v.eduRequired?.length > 0 || v.eduNice?.length > 0) && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Educación · {degreeLabel} mínimo
                </p>
                <div className="flex flex-wrap gap-2">
                  {v.eduRequired?.map((e) => (
                    <span
                      key={e}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/60 px-3 py-1 text-xs font-medium text-blue-900 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-100"
                    >
                      {e} <span className="text-blue-500">★</span>
                    </span>
                  ))}
                  {v.eduNice?.map((e) => (
                    <span
                      key={e}
                      className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {v.certs?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Certificaciones
                </p>
                <div className="flex flex-wrap gap-2">
                  {v.certs.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50/60 px-3 py-1 text-xs font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-100"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {v.languages?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Idiomas
                </p>
                <div className="flex flex-wrap gap-2">
                  {v.languages.map((l, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50/60 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-100"
                    >
                      {l.name} · {labelLanguageLevel(l.level)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!v.requiredSkills?.length &&
              !v.niceSkills?.length &&
              !v.eduRequired?.length &&
              !v.eduNice?.length &&
              !v.certs?.length &&
              !v.languages?.length && (
                <p className="text-sm text-zinc-500">Sin requisitos adicionales.</p>
              )}
          </div>
        </ReviewCard>

        <ReviewCard
          icon={<Globe className="h-5 w-5 text-emerald-500" />}
          title="Descripción"
          onEdit={() => {
            onEditStep(4);
            onEditTab("desc");
          }}
        >
          {hasDescription ? (
            <div
              className="prose prose-sm max-h-64 max-w-none overflow-auto text-sm text-zinc-700 dark:prose-invert dark:text-zinc-300"
              dangerouslySetInnerHTML={{ __html: safeDescHtml }}
            />
          ) : (
            <p className="text-sm text-zinc-500">Sin descripción.</p>
          )}
        </ReviewCard>
      </div>

      <div className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-6 py-2.5 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => {
              setShowPublishWarningModal(false);
              onBack();
            }}
          >
            Atrás
          </button>
          <button
            type="submit"
            disabled={busy}
            onClick={handleSubmitWarning}
            className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 hover:shadow-md disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {busy
              ? isEditing
                ? "Guardando..."
                : "Publicando..."
              : isEditing
                ? "Guardar cambios"
                : "Publicar vacante"}
          </button>
        </div>
      </div>

      <WizardWarningModal
        open={showPublishWarningModal}
        title="Publicar con advertencias"
        description="Tu vacante está lista, pero le faltan elementos recomendados:"
        items={missingRecommended}
        confirmLabel="Publicar de todos modos"
        cancelLabel="Volver"
        onCancel={() => setShowPublishWarningModal(false)}
        onConfirm={() => {
          setShowPublishWarningModal(false);
          const form = document.querySelector("form");
          form?.requestSubmit();
        }}
      />
    </div>
  );
}