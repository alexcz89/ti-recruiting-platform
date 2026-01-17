// app/dashboard/jobs/[id]/assessments/AssignAssessmentForm.tsx
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Props = {
  jobId: string;
  existingAssessments?: any[];
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
        toast.error(error?.message || "Error al cargar assessments");
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, []);

  const availableTemplates = useMemo(() => {
    return templates.filter((t) => !existingTemplateIds.has(t.id));
  }, [templates, existingTemplateIds]);

  // Asignar assessment
  const handleAssign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedTemplateId) {
      toast.error("Selecciona un assessment");
      return;
    }

    // ✅ blindaje anti duplicados (por si el estado quedó stale)
    if (existingTemplateIds.has(selectedTemplateId)) {
      toast.error("Ese assessment ya está asignado a la vacante");
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

      toast.success("Assessment asignado exitosamente");

      // ✅ reset del formulario (evita re-submit accidental)
      setSelectedTemplateId("");
      setIsRequired(true);
      setMinScore(undefined);

      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Error al asignar assessment");
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

      toast.success("Assessment removido");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Error al remover assessment");
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

          {existingAssessments.map((assessment: any) => (
            <div
              key={assessment.id}
              className="flex items-center justify-between p-4 rounded-xl border glass-card"
            >
              <div className="flex-1">
                <p className="font-medium text-default">
                  {assessment.template?.title ?? "Assessment"}
                </p>

                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  <span>{assessment.isRequired ? "Obligatorio" : "Opcional"}</span>

                  {/* ✅ muestra 0 también */}
                  {assessment.minScore != null && (
                    <span>Score mínimo: {assessment.minScore}%</span>
                  )}

                  {assessment.triggerAt && (
                    <span className="capitalize">
                      {String(assessment.triggerAt).toLowerCase()}
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
          ))}
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

            {availableTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title} ({template.difficulty})
              </option>
            ))}
          </select>
        </div>

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
          disabled={assigning || !selectedTemplateId || availableTemplates.length === 0}
          className="btn btn-primary w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {assigning ? "Asignando..." : "Asignar assessment"}
        </button>
      </form>
    </div>
  );
}
