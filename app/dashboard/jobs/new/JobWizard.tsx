// app/dashboard/jobs/new/JobWizard.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2 } from "lucide-react";

import { JobForm, JobWizardProps, jobSchema } from "./JobWizard/types";
import { BENEFITS } from "./JobWizard/constants";
import {
  makeDefaultValues,
  sanitizeHtml,
  htmlToPlain,
} from "./JobWizard/utils/helpers";
import { useAutosave } from "./JobWizard/hooks/useAutosave";
import { useQualityScore } from "./JobWizard/hooks/useQualityScore";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import {
  normalizeDegreeValue,
  normalizeEmploymentTypeValue,
  normalizeLocationTypeValue,
} from "./JobWizard/lib/job-enums";

import Stepper from "./JobWizard/components/Stepper";
import QualityIndicator from "./JobWizard/components/QualityIndicator";
import Step1Basic from "./JobWizard/components/Step1Basic";
import Step2Employment from "./JobWizard/components/Step2Employment";
import Step3Benefits from "./JobWizard/components/Step3Benefits";
import Step4Assessments from "./JobWizard/components/Step4Assessments";
import Step5Details, { type Step5Tab } from "./JobWizard/components/Step5Details";
import Step6Review from "./JobWizard/components/Step6Review";

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "hace unos segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}m`;
  return `hace ${Math.floor(minutes / 60)}h`;
}

function plainToBasicHtml(plain: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = plain.replace(/\r\n/g, "\n").split("\n");
  const paragraphs: string[][] = [];
  let buf: string[] = [];

  lines.forEach((line) => {
    if (!line.trim()) {
      if (buf.length) {
        paragraphs.push(buf);
        buf = [];
      }
      return;
    }
    buf.push(line);
  });

  if (buf.length) paragraphs.push(buf);

  const bulletPrefixes = ["- ", "* ", "• "];

  return paragraphs
    .map((paraLines) => {
      const allBullets = paraLines.every((l) =>
        bulletPrefixes.some((p) => l.startsWith(p))
      );

      if (allBullets) {
        const items = paraLines
          .map((l) => {
            const p = bulletPrefixes.find((prefix) => l.startsWith(prefix)) || "";
            return escape(l.slice(p.length).trim());
          })
          .filter(Boolean);

        return items.length
          ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`
          : "";
      }

      return `<p>${paraLines.map(escape).join("<br/>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

export default function JobWizard({
  onSubmit,
  presetCompany,
  skillsOptions,
  certOptions,
  templates = [],
  initial,
}: JobWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [maxStepVisited, setMaxStepVisited] = useState(1);
  const [stepCompletion, setStepCompletion] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [busy, setBusy] = useState(false);
  const [step5Tab, setStep5Tab] = useState<Step5Tab>("desc");

  const methods = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: makeDefaultValues({ presetCompany, initial }),
    mode: "onChange",
  });

  const { watch, reset, handleSubmit } = methods;
  const { lastSaved, isSaving, loadDraft, clearDraft } = useAutosave(
    watch,
    initial?.id
  );
  const qualityScore = useQualityScore(watch);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current || initial?.id) return;

    const draft = loadDraft();
    if (!draft) return;

    hasRestoredRef.current = true;

    if (
      window.confirm(
        "¿Deseas continuar con el borrador guardado automáticamente?"
      )
    ) {
      reset(draft);
    } else {
      clearDraft();
    }
  }, [clearDraft, initial?.id, loadDraft, reset]);

  function goNextStep(next: number) {
    setStepCompletion((prev) => {
      const n = [...prev];
      n[step - 1] = true;
      return n;
    });
    setStep(next);
    setMaxStepVisited((prev) => Math.max(prev, next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStepClick(target: number) {
    if (target <= maxStepVisited) {
      setStep(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    toastError("Primero completa los pasos anteriores antes de avanzar.");
  }

  function applyTemplateById(id: string) {
    if (!id) return;

    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;

    let html = sanitizeHtml(tpl.descriptionHtml || "");
    const plain = tpl.description
      ? tpl.description
      : html
        ? htmlToPlain(html)
        : "";

    if (!html.trim() && plain.trim()) {
      html = sanitizeHtml(plainToBasicHtml(plain));
    }

    const benefitsBase = BENEFITS.reduce((acc, b) => {
      acc[b.key] = b.def;
      return acc;
    }, {} as Record<string, boolean>);

    let benefitsJson = benefitsBase;
    let aguinaldoDias = 15;
    let vacacionesDias = 12;
    let primaVacPct = 25;
    let showBenefits = true;

    if (tpl.benefitsJson && typeof tpl.benefitsJson === "object") {
      const b = tpl.benefitsJson as Record<string, unknown>;
      benefitsJson = { ...benefitsBase };

      for (const k of Object.keys(benefitsBase)) {
        benefitsJson[k] = Boolean(b[k] ?? benefitsBase[k]);
      }

      if (typeof b.aguinaldoDias === "number") aguinaldoDias = b.aguinaldoDias;
      if (typeof b.vacacionesDias === "number") vacacionesDias = b.vacacionesDias;
      if (typeof b.primaVacPct === "number") primaVacPct = b.primaVacPct;
      showBenefits = Boolean(b.showBenefits ?? true);
    }

    const eduReq = Array.isArray(tpl.education)
      ? tpl.education.filter((e) => e.required).map((e) => e.name)
      : [];
    const eduNice = Array.isArray(tpl.education)
      ? tpl.education.filter((e) => !e.required).map((e) => e.name)
      : [];
    const skillsReq = Array.isArray(tpl.skills)
      ? tpl.skills.filter((s) => s.required).map((s) => s.name)
      : [];
    const skillsNice = Array.isArray(tpl.skills)
      ? tpl.skills.filter((s) => !s.required).map((s) => s.name)
      : [];

    reset({
      ...makeDefaultValues({ presetCompany, initial }),
      title: tpl.title ?? "",
      locationType: normalizeLocationTypeValue(tpl.locationType) ?? "ONSITE",
      city: tpl.city ?? "",
      country: tpl.country ?? "",
      admin1: tpl.admin1 ?? "",
      cityNorm: tpl.cityNorm ?? "",
      admin1Norm: tpl.admin1Norm ?? "",
      locationLat: tpl.locationLat ?? null,
      locationLng: tpl.locationLng ?? null,
      currency: tpl.currency === "USD" ? "USD" : "MXN",
      salaryMin: tpl.salaryMin ?? undefined,
      salaryMax: tpl.salaryMax ?? undefined,
      showSalary: Boolean(tpl.showSalary),
      employmentType:
        normalizeEmploymentTypeValue(tpl.employmentType) ?? "FULL_TIME",
      schedule: tpl.schedule ?? "",
      showBenefits,
      benefits: benefitsJson,
      aguinaldoDias,
      vacacionesDias,
      primaVacPct,
      descriptionHtml: html,
      descriptionPlain: plain,
      minDegree: normalizeDegreeValue(tpl.minDegree),
      eduRequired: eduReq,
      eduNice,
      requiredSkills: skillsReq,
      niceSkills: skillsNice,
      certs: Array.isArray(tpl.certs) ? tpl.certs : [],
      languages: Array.isArray(tpl.languages) ? tpl.languages : [],
    });

    toastSuccess("Plantilla aplicada");
  }

  async function onValidSubmit(v: JobForm) {
    console.log("✅ onValidSubmit called", v);
    setBusy(true);

    try {
      const normalizedMinDegree = normalizeDegreeValue(v.minDegree);
      const normalizedLocationType =
        normalizeLocationTypeValue(v.locationType) ?? "ONSITE";
      const normalizedEmploymentType =
        normalizeEmploymentTypeValue(v.employmentType) ?? "FULL_TIME";

      const fd = new FormData();

      fd.set("title", v.title.trim());
      fd.set("companyMode", v.companyMode);
      fd.set("companyOtherName", (v.companyOtherName || "").trim());
      fd.set("locationType", normalizedLocationType);
      fd.set("city", (v.city || "").trim());

      if (v.country) fd.set("country", v.country);
      if (v.admin1) fd.set("admin1", v.admin1);
      if (v.cityNorm) fd.set("cityNorm", v.cityNorm);
      if (v.admin1Norm) fd.set("admin1Norm", v.admin1Norm);
      if (v.locationLat != null) fd.set("locationLat", String(v.locationLat));
      if (v.locationLng != null) fd.set("locationLng", String(v.locationLng));

      fd.set("currency", v.currency);

      if (v.salaryMin != null) {
        fd.set("salaryMin", String(Math.max(0, Number(v.salaryMin))));
      }

      if (v.salaryMax != null) {
        fd.set("salaryMax", String(Math.max(0, Number(v.salaryMax))));
      }

      fd.set("showSalary", String(v.showSalary));
      fd.set("employmentType", normalizedEmploymentType);

      if (v.schedule) fd.set("schedule", v.schedule);

      const benefitsPayload = {
        ...v.benefits,
        aguinaldoDias: v.aguinaldoDias,
        vacacionesDias: v.vacacionesDias,
        primaVacPct: v.primaVacPct,
        showBenefits: v.showBenefits,
      };

      fd.set("showBenefits", String(v.showBenefits));
      fd.set("benefitsJson", JSON.stringify(benefitsPayload));

      if (v.assessmentTemplateId) {
        fd.set("assessmentTemplateId", v.assessmentTemplateId);
      }

      let safeHtml = sanitizeHtml((v.descriptionHtml || "").trim());
      if (!safeHtml.trim() && v.descriptionPlain.trim()) {
        safeHtml = sanitizeHtml(plainToBasicHtml(v.descriptionPlain.trim()));
      }

      fd.set("descriptionHtml", safeHtml);
      fd.set("description", v.descriptionPlain.trim() || htmlToPlain(safeHtml));

      if (normalizedMinDegree) {
        fd.set("minDegree", normalizedMinDegree);
      } else {
        toastError("No especificaste nivel académico mínimo.", {
          description:
            "La vacante se publicará de todos modos, pero definirlo ayuda a filtrar mejor candidatos.",
        });
      }

      fd.set(
        "educationJson",
        JSON.stringify([
          ...v.eduRequired.map((name) => ({ name, required: true })),
          ...v.eduNice.map((name) => ({ name, required: false })),
        ])
      );

      fd.set(
        "skillsJson",
        JSON.stringify([
          ...v.requiredSkills.map((name) => ({ name, required: true })),
          ...v.niceSkills.map((name) => ({ name, required: false })),
        ])
      );

      fd.set("certsJson", JSON.stringify(v.certs));

      if (v.languages?.length) {
        fd.set("languagesJson", JSON.stringify(v.languages));
      }

      const isEditing = !!initial?.id;

      if (isEditing && initial?.id) {
        fd.set("jobId", initial.id);

        const result = await onSubmit(fd);
        if (result?.error) throw new Error(result.error);

        clearDraft();
        toastSuccess("Cambios guardados correctamente");

        if (result?.redirectTo) router.push(result.redirectTo);
        else router.refresh();

        return;
      }

      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402 && data?.code === "PLAN_LIMIT_REACHED") {
          toastError(
            data?.error || "Has alcanzado el límite de vacantes activas.",
            {
              description:
                typeof data?.maxActiveJobs === "number"
                  ? `Vacantes activas: ${data.currentActiveJobs ?? "•"} / ${data.maxActiveJobs}. Cierra una vacante o mejora tu plan.`
                  : undefined,
            }
          );
          return;
        }

        throw new Error(data?.error || "Error al publicar la vacante");
      }

      clearDraft();
      toastSuccess("Vacante publicada correctamente 🎉");
      router.push(`/dashboard/jobs/${data.id}/applications`);
    } catch (err: any) {
      console.error("Error en handlePublish:", err);
      toastError(
        (err?.message as string) || "Ocurrió un error al guardar la vacante"
      );
    } finally {
      setBusy(false);
    }
  }

  const isEditing = !!initial?.id;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onValidSubmit, (errors) => {
        console.error("❌ RHF validation errors:", JSON.stringify(errors, null, 2));
        toastError("Error de validación — revisa la consola");
      })}>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
          <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10 lg:py-12">
            <div className="mb-0 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                  {isEditing ? "Editar vacante" : "Nueva vacante"}
                </h2>

                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  {isSaving ? (
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Save className="h-3.5 w-3.5 animate-pulse" />
                      <span>Guardando...</span>
                    </div>
                  ) : lastSaved ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Guardado {getTimeAgo(lastSaved)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="lg:hidden">
                <QualityIndicator score={qualityScore} compact />
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-0">
                <div className="mb-0">
                  <Stepper
                    step={step}
                    maxStepVisited={maxStepVisited}
                    stepCompletion={stepCompletion}
                    onJump={handleStepClick}
                  />
                </div>

                {step === 1 && (
                  <Step1Basic
                    presetCompany={presetCompany ?? null}
                    templates={templates}
                    onApplyTemplate={applyTemplateById}
                    onNext={() => goNextStep(2)}
                  />
                )}

                {step === 2 && (
                  <Step2Employment
                    onNext={() => goNextStep(3)}
                    onBack={() => setStep(1)}
                  />
                )}

                {step === 3 && (
                  <Step3Benefits
                    onNext={() => goNextStep(4)}
                    onBack={() => setStep(2)}
                  />
                )}

                {step === 4 && (
                  <Step5Details
                    skillsOptions={skillsOptions}
                    certOptions={certOptions}
                    onNext={() => goNextStep(5)}
                    onBack={() => setStep(3)}
                    activeTab={step5Tab}
                    onTabChange={setStep5Tab}
                  />
                )}

                {step === 5 && (
                  <Step4Assessments
                    onNext={() => goNextStep(6)}
                    onBack={() => setStep(4)}
                  />
                )}

                {step === 6 && (
                  <Step6Review
                    presetCompany={presetCompany ?? null}
                    busy={busy}
                    onBack={() => setStep(5)}
                    isEditing={isEditing}
                    onEditStep={(targetStep) => {
                      setStep(targetStep);
                      setMaxStepVisited((prev) => Math.max(prev, targetStep));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onEditTab={(tab) => {
                      setStep(4);
                      setStep5Tab(tab);
                      setMaxStepVisited((prev) => Math.max(prev, 4));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                )}
              </div>

              <div className="hidden lg:block">
                <div className="sticky top-6">
                  <QualityIndicator score={qualityScore} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}