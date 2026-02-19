// app/dashboard/jobs/[id]/assessments/AssignAssessmentForm.tsx
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";
import { Plus, Trash2 } from "lucide-react";
// ✅ NUEVO: Sistema de créditos
import { getAssessmentCost, formatCredits } from "@/lib/assessments/pricing";
import type { AssessmentType, AssessmentDifficulty } from "@prisma/client";

type Props = {
  jobId: string;
  existingAssessments?: any[];
  availableCredits: number; // ✅ NUEVO
};

async function readErrorMessage(res: Response) {
  try {
    const data = await res.json();
    return data?.error || data?.message || "Error";
  } catch {
    return "Error";
  }
}

export default function AssignAssessmentForm({
  jobId,
  existingAssessments = [],
  availableCredits, // ✅ NUEVO
}: Props) {
  const router = useRouter();

  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [minScore, setMinScore] = useState<number | undefined>(undefined);

  const existingTemplateIds = useMemo(() => {
    return new Set(
      (existingAssessments || [])
        .map((a: any) => a?.templateId ?? a?.template?.id)
        .filter(Boolean)
    );
  }, [existingAssessments]);

  // Cargar templates disponibles
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch("/api/assessments", { cache: "no-store" });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        const data = await res.json();
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } catch (error: any) {
        console.error(error);
        toastError(error?.message || "Error al cargar assessments");
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, []);

  const availableTemplates = useMemo(() => {
    return templates.filter((t) => !existingTemplateIds.has(t.id));
  }, [templates, existingTemplateIds]);

  // ✅ NUEVO: Calcular costo del template seleccionado
  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  const selectedCost = useMemo(() => {
    if (!selectedTemplate) return null;
    return getAssessmentCost(
      selectedTemplate.type as AssessmentType,
      selectedTemplate.difficulty as AssessmentDifficulty
    );
  }, [selectedTemplate]);

  // ✅ NUEVO: Verificar si hay suficientes créditos
  const hasEnoughCredits = useMemo(() => {
    if (!selectedCost) return true;
    return availableCredits >= selectedCost.reserve; // Al menos debe poder reservar
  }, [availableCredits, selectedCost]);

  // Asignar assessment
  const handleAssign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedTemplateId) {
      toastError("Selecciona un assessment");
      return;
    }

    // ✅ Validación anti duplicados
    if (existingTemplateIds.has(selectedTemplateId)) {
      toastError("Ese assessment ya está asignado a la vacante");
      return;
    }

    // ✅ NUEVO: Validar créditos disponibles
    if (!hasEnoughCredits) {
      toastError(
        "No tienes suficientes créditos disponibles. " +
        `Necesitas al menos ${selectedCost?.reserve} créditos para reservar.`
      );
      return;
    }

    // clamp minScore 0..100 si viene
    const normalizedMinScore =
      typeof minScore === "number"
        ? Math.max(0, Math.min(100, minScore))
        : undefined;

    setAssigning(true);

    try {
      const res = await fetch(`/api/jobs/${jobId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          isRequired,
          minScore: normalizedMinScore,
        }),
      });

      if (!res.ok) throw new Error(await readErrorMessage(res));

      toastSuccess("Assessment asignado exitosamente");

      // ✅ Reset del formulario
      setSelectedTemplateId("");
      setIsRequired(true);
      setMinScore(undefined);

      router.refresh();
    } catch (error: any) {
      console.error(error);
      toastError(error?.message || "Error al asignar assessment");
    } finally {
      setAssigning(false);
    }
  };

  // Remover assessment
  const handleRemove = async (assessmentId: string) => {
    if (!confirm("¿Deseas remover este assessment de la vacante?")) return;

    try {
      const res = await fetch(`/api/jobs/${jobId}/assessments/${assessmentId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(await readErrorMessage(res));

      toastSuccess("Assessment removido");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toastError(error?.message || "Error al remover assessment");
    }
  };

  if (loading) {
    return <div className="text-sm text-muted">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Assessments asignados */}
      {existingAssessments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-default">Assessments asignados</h3>

          {existingAssessments.map((assessment: any) => {
            // ✅ NUEVO: Calcular costo del assessment asignado
            const cost = assessment.template?.type && assessment.template?.difficulty
              ? getAssessmentCost(
                  assessment.template.type as AssessmentType,
                  assessment.template.difficulty as AssessmentDifficulty
                )
              : null;

            return (
              <div
                key={assessment.id}
                className="flex items-center justify-between p-4 rounded-xl border glass-card"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">
                      {assessment.template?.type === "CODING" ? "💻" : "📝"}
                    </span>
                    <p className="font-medium text-default">
                      {assessment.template?.title ?? "Assessment"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{assessment.isRequired ? "Obligatorio" : "Opcional"}</span>

                    {assessment.minScore != null && (
                      <span>Score mínimo: {assessment.minScore}%</span>
                    )}

                    {assessment.triggerAt && (
                      <span className="capitalize">
                        {String(assessment.triggerAt).toLowerCase()}
                      </span>
                    )}

                    {/* ✅ NUEVO: Mostrar costo */}
                    {cost && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        {formatCredits(cost.total)} créditos/candidato
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(assessment.id)}
                  className="text-red-600 hover:text-red-700 p-2"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulario para asignar nuevo */}
      <form onSubmit={handleAssign} className="space-y-4">
        <h3 className="text-sm font-semibold text-default">Asignar nuevo assessment</h3>

        {/* Selector de template */}
        <div>
          <label className="block text-sm font-medium text-default mb-2">
            Assessment
          </label>

          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            required
            disabled={assigning}
          >
            <option value="">
              {availableTemplates.length ? "Selecciona un assessment..." : "No hay assessments disponibles"}
            </option>

            {availableTemplates.map((template) => {
              const cost = getAssessmentCost(
                template.type as AssessmentType,
                template.difficulty as AssessmentDifficulty
              );
              const canAfford = availableCredits >= cost.reserve;

              return (
                <option 
                  key={template.id} 
                  value={template.id}
                  disabled={!canAfford}
                >
                  {template.title} ({template.difficulty}) - {formatCredits(cost.total)} créditos
                  {!canAfford ? " - Sin créditos suficientes" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* ✅ NUEVO: Preview de costos del template seleccionado */}
        {selectedTemplate && selectedCost && (
          <div className={`p-4 rounded-xl border ${
            hasEnoughCredits
              ? "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20"
              : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {selectedTemplate.type === "CODING" ? "💻" : "📝"}
                  </span>
                  <h4 className="font-semibold text-sm">
                    {selectedTemplate.title}
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border">
                    {selectedTemplate.type}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border">
                    {selectedTemplate.difficulty}
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border">
                    {selectedTemplate.totalQuestions} preguntas
                  </span>
                  <span className="px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border">
                    {selectedTemplate.timeLimit} min
                  </span>
                </div>
              </div>
              <div className="ml-4 text-right">
                <p className={`text-2xl font-bold ${
                  hasEnoughCredits
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {formatCredits(selectedCost.total)}
                </p>
                <p className="text-xs text-zinc-500">créditos/candidato</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Reserva: {formatCredits(selectedCost.reserve)} • Completado: {formatCredits(selectedCost.complete)}
                </p>
              </div>
            </div>

            {!hasEnoughCredits && (
              <div className="mt-3 p-2 rounded bg-red-100 dark:bg-red-900/30 text-xs text-red-800 dark:text-red-200">
                ⚠️ No tienes suficientes créditos. Necesitas al menos {formatCredits(selectedCost.reserve)} para reservar.{" "}
                <a href="/dashboard/billing/credits" className="underline font-medium">
                  Comprar créditos
                </a>
              </div>
            )}
          </div>
        )}

        {/* Es requerido? */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isRequired"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="rounded"
            disabled={assigning}
          />
          <label htmlFor="isRequired" className="text-sm text-default">
            Es obligatorio para aplicar
          </label>
        </div>

        {/* Score mínimo */}
        <div>
          <label className="block text-sm font-medium text-default mb-2">
            Score mínimo requerido (opcional)
          </label>

          <input
            type="number"
            min="0"
            max="100"
            value={minScore ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") return setMinScore(undefined);
              const n = Number(v);
              setMinScore(Number.isFinite(n) ? Math.trunc(n) : undefined);
            }}
            placeholder="Ej: 70"
            className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            disabled={assigning}
          />

          <p className="text-xs text-muted mt-1">
            Si se especifica, solo candidatos con este score o mayor pasarán
          </p>
        </div>

        {/* Botón */}
        <button
          type="submit"
          disabled={assigning || !selectedTemplateId || availableTemplates.length === 0 || !hasEnoughCredits}
          className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 mr-2" />
          {assigning ? "Asignando..." : hasEnoughCredits ? "Asignar assessment" : "Sin créditos suficientes"}
        </button>

        {!hasEnoughCredits && selectedTemplate && (
          <p className="text-xs text-center text-red-600 dark:text-red-400">
            Necesitas comprar más créditos para asignar este assessment
          </p>
        )}
      </form>
    </div>
  );
}