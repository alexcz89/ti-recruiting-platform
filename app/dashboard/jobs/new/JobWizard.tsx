// app/dashboard/jobs/new/JobWizard.tsx
"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { createStringFuse, searchStrings } from "@/lib/search/fuse";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import JobRichTextEditor from "@/components/jobs/JobRichTextEditor";
import { Briefcase, Clock3, Save, CheckCircle2, Check, X } from "lucide-react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useFieldArray,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LANGUAGES_FALLBACK } from "@/lib/skills";

// Import from new architecture
import {
  JobForm,
  JobWizardProps,
  PresetCompany,
  LanguageProficiency,
  EmploymentType,
  DegreeLevel,
} from "./JobWizard/types";
import { jobSchema } from "./JobWizard/types";
import {
  BENEFITS,
  EMPLOYMENT_OPTIONS,
  SCHEDULE_PRESETS,
} from "./JobWizard/constants";
import {
  makeDefaultValues,
  sanitizeHtml,
  htmlToPlain,
  clampNonNegative,
  labelEmployment,
  labelDegree,
  labelLanguageLevel,
} from "./JobWizard/utils/helpers";
import { useAutosave } from "./JobWizard/hooks/useAutosave";
import { useQualityScore } from "./JobWizard/hooks/useQualityScore";
import Stepper from "./JobWizard/components/Stepper";
import QualityIndicator from "./JobWizard/components/QualityIndicator";
import Step1Basic from "./JobWizard/components/Step1Basic";

/* =============================
   Helper Functions
============================= */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "hace unos segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
}

function plainToBasicHtml(plain: string): string {
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const lines = plain.replace(/\r\n/g, "\n").split("\n");
  const paragraphs: string[][] = [];
  let buffer: string[] = [];

  lines.forEach((line) => {
    if (!line.trim()) {
      if (buffer.length) {
        paragraphs.push(buffer);
        buffer = [];
      }
      return;
    }
    buffer.push(line);
  });

  if (buffer.length) paragraphs.push(buffer);

  const bulletPrefixes = ["- ", "* ", "• "];
  const isBulletLine = (line: string) =>
    bulletPrefixes.some((prefix) => line.startsWith(prefix));

  return paragraphs
    .map((paraLines) => {
      const allBullets = paraLines.every(isBulletLine);
      if (allBullets) {
        const items = paraLines
          .map((line) => {
            const prefix = bulletPrefixes.find((p) => line.startsWith(p)) || "";
            return escapeHtml(line.slice(prefix.length).trim());
          })
          .filter(Boolean);
        if (!items.length) return "";
        return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
      }

      const text = paraLines.map((line) => escapeHtml(line)).join("<br/>");
      return `<p>${text}</p>`;
    })
    .filter(Boolean)
    .join("");
}

/* =============================
   Constantes
============================= */
const EDUCATION_SUGGESTIONS = [
  "Ingenier�a en Sistemas",
  "Ingenier�a en tecnolog�as Computacionales",
  "Ingenier�a en Rob�tica",
  "Licenciatura en Inform�tica",
  "Licenciatura en Ciencias de la Computaci�n",
  "Maestr�a en tecnolog�as de Informaci�n",
  "Maestr�a en Ciencia de Datos",
  "MBA con enfoque en TI",
  "T�cnico en Programaci�n",
  "T�cnico en Redes",
];

const reviewBox =
  "mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border bg-zinc-50 p-2 dark:bg-zinc-900/40";

/* =============================
   Componente principal
============================= */
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
  ]);
  const [tab4, setTab4] = useState<"desc" | "skills" | "langs" | "edu">(
    "desc"
  );
  const [busy, setBusy] = useState(false);

  const methods = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: makeDefaultValues({ presetCompany, initial }),
    mode: "onChange",
  });

  const {
    watch,
    setValue,
    reset,
    handleSubmit,
    register,
    control,
    formState: { errors },
  } = methods;

  // Initialize new hooks
  const { lastSaved, isSaving } = useAutosave(watch, initial?.id);
  const qualityScore = useQualityScore(watch);

  const {
    fields: languageFields,
    append: addLanguageRow,
    remove: removeLanguageRow,
  } = useFieldArray({
    control,
    name: "languages",
  });

  // Search helpers
  const [skillQuery, setSkillQuery] = useState("");
  const [educationQuery, setEducationQuery] = useState("");
  const [certQuery, setCertQuery] = useState("");

  const skillsFuse = useMemo(
    () => createStringFuse(skillsOptions || []),
    [skillsOptions]
  );
  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim();
    if (!q) return (skillsOptions || []).slice(0, 30);
    return searchStrings(skillsFuse, q, 50);
  }, [skillQuery, skillsOptions, skillsFuse]);

  const educationFuse = useMemo(
    () => createStringFuse(EDUCATION_SUGGESTIONS),
    []
  );
  const filteredEducation = useMemo(() => {
    const q = educationQuery.trim();
    if (!q) return EDUCATION_SUGGESTIONS.slice(0, 30);
    return searchStrings(educationFuse, q, 50);
  }, [educationQuery, educationFuse]);

  const certsFuse = useMemo(
    () => createStringFuse(certOptions || []),
    [certOptions]
  );
  const filteredCerts = useMemo(() => {
    const q = certQuery.trim();
    if (!q) return (certOptions || []).slice(0, 30);
    return searchStrings(certsFuse, q, 50);
  }, [certQuery, certsFuse, certOptions]);

  // Derivados para paso 4
  const descriptionPlain = watch("descriptionPlain") || "";
  const descLength = descriptionPlain.length;
  const wordCount = descriptionPlain.trim()
    ? descriptionPlain.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const MAX_DESC_CHARS = 500;
  const MAX_DESC_WORDS = 80;

  const canNext4 = descLength >= 50;

  // Aplicar plantilla
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

    // beneficios base
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
      const b = tpl.benefitsJson as any;
      benefitsJson = { ...benefitsBase };
      for (const k of Object.keys(benefitsBase)) {
        benefitsJson[k] = Boolean(b[k] ?? benefitsBase[k]);
      }
      if (typeof b.aguinaldoDias === "number")
        aguinaldoDias = b.aguinaldoDias;
      if (typeof b.vacacionesDias === "number")
        vacacionesDias = b.vacacionesDias;
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
    const languagesTpl = Array.isArray(tpl.languages) ? tpl.languages : [];

    reset({
      ...makeDefaultValues({ presetCompany, initial }),
      title: tpl.title ?? "",
      locationType: tpl.locationType ?? "ONSITE",
      city: tpl.city ?? "",
      country: tpl.country ?? "",
      admin1: tpl.admin1 ?? "",
      cityNorm: tpl.cityNorm ?? "",
      admin1Norm: tpl.admin1Norm ?? "",
      locationLat: tpl.locationLat ?? null,
      locationLng: tpl.locationLng ?? null,
      currency: tpl.currency ?? "MXN",
      salaryMin:
        tpl.salaryMin === null || tpl.salaryMin === undefined
          ? ""
          : String(tpl.salaryMin),
      salaryMax:
        tpl.salaryMax === null || tpl.salaryMax === undefined
          ? ""
          : String(tpl.salaryMax),
      showSalary: Boolean(tpl.showSalary),
      employmentType: tpl.employmentType ?? "FULL_TIME",
      schedule: tpl.schedule ?? "",
      showBenefits,
      benefits: benefitsJson,
      aguinaldoDias,
      vacacionesDias,
      primaVacPct,
      descriptionHtml: html,
      descriptionPlain: plain,
      minDegree: tpl.minDegree ?? "BACHELOR",
      eduRequired: eduReq,
      eduNice,
      requiredSkills: skillsReq,
      niceSkills: skillsNice,
      certs: Array.isArray(tpl.certs) ? tpl.certs : [],
      languages: languagesTpl,
    });

    toast.success("Plantilla aplicada");
  }

  // Env�o
  async function onValidSubmit(v: JobForm) {
    setBusy(true);
    try {
      const fd = new FormData();

      // Paso 1
      fd.set("title", v.title.trim());
      fd.set("companyMode", v.companyMode);
      fd.set("companyOtherName", (v.companyOtherName || "").trim());
      fd.set("locationType", v.locationType);
      fd.set("city", (v.city || "").trim());
      if (v.country) fd.set("country", v.country);
      if (v.admin1) fd.set("admin1", v.admin1);
      if (v.cityNorm) fd.set("cityNorm", v.cityNorm);
      if (v.admin1Norm) fd.set("admin1Norm", v.admin1Norm);
      if (v.locationLat != null)
        fd.set("locationLat", String(v.locationLat));
      if (v.locationLng != null)
        fd.set("locationLng", String(v.locationLng));
      fd.set("currency", v.currency);
      if (v.salaryMin)
        fd.set("salaryMin", clampNonNegative(v.salaryMin));
      if (v.salaryMax)
        fd.set("salaryMax", clampNonNegative(v.salaryMax));
      fd.set("showSalary", String(v.showSalary));

      // Paso 2
      fd.set("employmentType", v.employmentType);
      if (v.schedule) fd.set("schedule", v.schedule);

      // Paso 3
      const benefitsPayload = {
        ...v.benefits,
        aguinaldoDias: v.aguinaldoDias,
        vacacionesDias: v.vacacionesDias,
        primaVacPct: v.primaVacPct,
        showBenefits: v.showBenefits,
      };
      fd.set("showBenefits", String(v.showBenefits));
      fd.set("benefitsJson", JSON.stringify(benefitsPayload));

      // Paso 4 � HTML + texto plano
      let safeHtml = sanitizeHtml((v.descriptionHtml || "").trim());
      if (!safeHtml.trim() && v.descriptionPlain.trim()) {
        safeHtml = sanitizeHtml(
          plainToBasicHtml(v.descriptionPlain.trim())
        );
      }
      const safePlain =
        v.descriptionPlain.trim() || htmlToPlain(safeHtml);

      // ahora s� guardamos ambos campos
      fd.set("descriptionHtml", safeHtml);
      fd.set("description", safePlain);

      fd.set("minDegree", v.minDegree);
      const eduPack = [
        ...v.eduRequired.map((name) => ({ name, required: true })),
        ...v.eduNice.map((name) => ({ name, required: false })),
      ];
      fd.set("educationJson", JSON.stringify(eduPack));
      const skillsPack = [
        ...v.requiredSkills.map((name) => ({
          name,
          required: true,
        })),
        ...v.niceSkills.map((name) => ({ name, required: false })),
      ];
      fd.set("skillsJson", JSON.stringify(skillsPack));
      fd.set("certsJson", JSON.stringify(v.certs));

      // Idiomas (si existen)
      if (v.languages && v.languages.length) {
        fd.set("languagesJson", JSON.stringify(v.languages));
      }

      const isEditing = !!initial?.id;

      if (isEditing && initial?.id) {
        fd.set("jobId", initial.id);
        const result = await onSubmit(fd);
        if (result?.error) throw new Error(result.error);
        toast.success("Cambios guardados correctamente");
        if (result?.redirectTo) router.push(result.redirectTo);
        else router.refresh();
        return;
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402 && data?.code === "PLAN_LIMIT_REACHED") {
          toast.error(
            data?.error ||
              "Has alcanzado el l�mite de vacantes activas para tu plan.",
            {
              description:
                typeof data?.maxActiveJobs === "number"
                  ? `Vacantes activas: ${
                      data.currentActiveJobs ?? "—"
                    } / ${data.maxActiveJobs}. Cierra una vacante o mejora tu plan.`
                  : undefined,
            }
          );
          return;
        }
        throw new Error(
          data?.error || "Error al publicar la vacante"
        );
      }

      toast.success("Vacante publicada correctamente ??");
      router.push(`/dashboard/jobs/${data.id}/applications`);
    } catch (err: any) {
      console.error("Error en handlePublish:", err);
      toast.error(
        (err && typeof err.message === "string" && err.message) ||
          "Ocurri� un error al guardar la vacante"
      );
    } finally {
      setBusy(false);
    }
  }

  const benefits = watch("benefits");
  const showBenefits = watch("showBenefits");

  const requiredSkills = watch("requiredSkills");
  const niceSkills = watch("niceSkills");
  const eduRequired = watch("eduRequired");
  const eduNice = watch("eduNice");
  const certs = watch("certs");
  const tabItems = [
    { k: "desc", lbl: "Descripción", done: descLength > 0 },
    {
      k: "skills",
      lbl: "Skills / Certs",
      done:
        requiredSkills.length +
          niceSkills.length +
          certs.length >
        0,
    },
    {
      k: "langs",
      lbl: "Idiomas",
      done: languageFields.length > 0,
    },
    {
      k: "edu",
      lbl: "Educación",
      done: eduRequired.length + eduNice.length > 0,
    },
  ];

  function addSkillByName(name: string, to: "req" | "nice" = "req") {
    const n = name.trim();
    if (!n) return;
    if (requiredSkills.includes(n) || niceSkills.includes(n)) return;
    if (to === "req") {
      setValue("requiredSkills", [...requiredSkills, n], {
        shouldDirty: true,
      });
    } else {
      setValue("niceSkills", [...niceSkills, n], {
        shouldDirty: true,
      });
    }
    setSkillQuery("");
  }

  function addEduByName(name: string, to: "req" | "nice" = "req") {
    const n = name.trim();
    if (!n) return;
    if (eduRequired.includes(n) || eduNice.includes(n)) return;
    if (to === "req") {
      setValue("eduRequired", [...eduRequired, n], {
        shouldDirty: true,
      });
    } else {
      setValue("eduNice", [...eduNice, n], {
        shouldDirty: true,
      });
    }
    setEducationQuery("");
  }

  function addCert(c: string) {
    const n = c.trim();
    if (!n) return;
    if (certs.includes(n)) return;
    setValue("certs", [...certs, n], { shouldDirty: true });
    setCertQuery("");
  }

  function onDragStart(
    e: React.DragEvent<HTMLSpanElement>,
    payload: { kind: "skill" | "edu"; name: string; from: "req" | "nice" }
  ) {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify(payload)
    );
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropSkills(
    e: React.DragEvent<HTMLDivElement>,
    to: "req" | "nice"
  ) {
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const payload = JSON.parse(data) as {
      kind: "skill" | "edu";
      name: string;
      from: "req" | "nice";
    };
    if (payload.kind !== "skill" || payload.from === to) return;

    if (to === "req") {
      if (!requiredSkills.includes(payload.name)) {
        setValue("requiredSkills", [...requiredSkills, payload.name], {
          shouldDirty: true,
        });
      }
      setValue(
        "niceSkills",
        niceSkills.filter((n) => n !== payload.name),
        { shouldDirty: true }
      );
    } else {
      if (!niceSkills.includes(payload.name)) {
        setValue("niceSkills", [...niceSkills, payload.name], {
          shouldDirty: true,
        });
      }
      setValue(
        "requiredSkills",
        requiredSkills.filter((n) => n !== payload.name),
        { shouldDirty: true }
      );
    }
  }

  function onDropEdu(
    e: React.DragEvent<HTMLDivElement>,
    to: "req" | "nice"
  ) {
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const payload = JSON.parse(data) as {
      kind: "skill" | "edu";
      name: string;
      from: "req" | "nice";
    };
    if (payload.kind !== "edu" || payload.from === to) return;

    if (to === "req") {
      if (!eduRequired.includes(payload.name)) {
        setValue("eduRequired", [...eduRequired, payload.name], {
          shouldDirty: true,
        });
      }
      setValue(
        "eduNice",
        eduNice.filter((n) => n !== payload.name),
        { shouldDirty: true }
      );
    } else {
      if (!eduNice.includes(payload.name)) {
        setValue("eduNice", [...eduNice, payload.name], {
          shouldDirty: true,
        });
      }
      setValue(
        "eduRequired",
        eduRequired.filter((n) => n !== payload.name),
        { shouldDirty: true }
      );
    }
  }

  // Helper para avanzar controlando paso m�ximo visitado
  function goNextStep(next: number) {
    // Mark current step as complete
    setStepCompletion((prev) => {
      const newCompletion = [...prev];
      newCompletion[step - 1] = true;
      return newCompletion;
    });

    setStep(next);
    setMaxStepVisited((prev) => Math.max(prev, next));

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStepClick(target: number) {
    if (target <= maxStepVisited) {
      setStep(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    toast.error(
      "Primero completa los pasos anteriores antes de avanzar."
    );
  }

  /* =============================
     Render
  ============================= */
  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onValidSubmit)}>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
          <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10 lg:py-12">
            {/* Header with Autosave and Quality */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {initial?.id ? "Editar vacante" : "Nueva vacante"}
                </h2>

                {/* Autosave Indicator */}
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

              {/* Quality Score - Compact (screens < lg) */}
              <div className="lg:hidden">
                <QualityIndicator score={qualityScore} compact />
              </div>
            </div>

            {/* Two Column Grid */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
              {/* Main Content Column */}
              <div className="space-y-0">
                <div className="mb-0">
                  <Stepper
                    step={step}
                    maxStepVisited={maxStepVisited}
                    stepCompletion={stepCompletion}
                    onJump={handleStepClick}
                  />
                </div>

                {/* Paso 1 */}
                {step === 1 && (
                  <Step1Basic
                    presetCompany={presetCompany}
                    templates={templates}
                    onApplyTemplate={applyTemplateById}
                    onNext={() => goNextStep(2)}
                  />
                )}

                {/* Paso 2 */}
                {step === 2 && (
                  <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <Briefcase className="h-5 w-5 text-emerald-500" />
                    <span>2) Tipo de empleo</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                    Elige el tipo de contrato y un horario de referencia.
                  </p>
                </div>

                {/* Cards de tipo de empleo */}
                <div className="grid gap-3">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Tipo de contrato *
                </label>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {EMPLOYMENT_OPTIONS.map((opt) => {
                    const active =
                      watch("employmentType") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setValue("employmentType", opt.value, {
                            shouldDirty: true,
                          })
                        }
                        className={clsx(
                          "group relative flex h-full min-h-[140px] flex-col items-start rounded-xl border p-4 text-left text-xs sm:text-sm transition",
                          active
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-500/30 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-100"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/10"
                        )}
                      >
                        {active && (
                          <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-600" />
                        )}
                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                              active
                                ? "border-emerald-500 bg-emerald-600 text-white"
                                : "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                            )}
                          >
                            {opt.label[0]}
                          </span>
                          <span className="font-semibold whitespace-normal break-words leading-tight hyphens-none line-clamp-2 min-h-[2.5rem]">
                            {opt.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 whitespace-normal break-words hyphens-none">
                          {opt.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horario */}
              <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <Clock3 className="h-4 w-4 text-emerald-500" />
                Horario de referencia (opcional)
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ej. L-V 9:00-18:00 (hora local)
              </p>
                <input
                  className="h-11 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Ej. L-V 9:00-18:00 (hora local)"
                  {...register("schedule")}
                />
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {SCHEDULE_PRESETS.map((p) => {
                    const active = watch("schedule") === p.value;
                    return (
                    <button
                      key={p.value}
                      type="button"
                      className={clsx(
                        "cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-zinc-50 active:scale-[0.98] active:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:hover:bg-zinc-800",
                        active
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-400 dark:text-emerald-100"
                          : "bg-white border-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200"
                      )}
                      onClick={() =>
                        setValue("schedule", p.value, {
                          shouldDirty: true,
                        })
                      }
                    >
                      {p.label}
                    </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Este campo es informativo. No afecta filtros ni
                  validaciones.
                </p>
              </div>

                    <div className="flex justify-between gap-4 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                        onClick={() => setStep(1)}
                      >
                        Atr�s
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition"
                        onClick={() => goNextStep(3)}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}

                {/* Paso 3 - Prestaciones */}
                {step === 3 && (
                  <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">3) Prestaciones</h3>

                <div
                  className={clsx(
                    "rounded-lg border p-4 flex items-start justify-between gap-4",
                    showBenefits
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  )}
                >
                  <div className="text-sm">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      Mostrar prestaciones en la publicación
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Recomendado: aumenta conversiones
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      {...register("showBenefits")}
                    />
                    {showBenefits ? "Si" : "No"}
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                {BENEFITS.map((b) => {
                  const checked = !!benefits[b.key];
                  return (
                    <label
                      key={b.key}
                      className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 transition cursor-pointer hover:bg-zinc-50 hover:border-zinc-300 dark:hover:bg-zinc-800/40 dark:hover:border-zinc-600 active:scale-[0.98] has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:has-[:checked]:bg-emerald-950/20 dark:has-[:checked]:border-emerald-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/40 has-[:focus-visible]:outline-none"
                    >
                      <input
                        id={`benefit-${b.key}`}
                        type="checkbox"
                        className="accent-emerald-600"
                        checked={checked}
                        onChange={(e) =>
                          setValue(
                            "benefits",
                            {
                              ...benefits,
                              [b.key]: e.target.checked,
                            },
                            { shouldDirty: true }
                          )
                        }
                      />
                      <span className="min-w-0 text-sm font-medium text-zinc-800 dark:text-zinc-100 whitespace-normal break-normal hyphens-none leading-tight">
                        {b.label}
                      </span>

                      <div className="ml-auto flex items-center gap-3">
                        {checked && b.key === "aguinaldo" && (
                          <NumberMini
                            label="días"
                            field="aguinaldoDias"
                          />
                        )}
                        {checked && b.key === "vacaciones" && (
                          <NumberMini
                            label="días"
                            field="vacacionesDias"
                          />
                        )}
                        {checked && b.key === "primaVac" && (
                          <NumberMini
                            label="%"
                            field="primaVacPct"
                            max={100}
                          />
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

                    <div className="flex justify-between gap-4 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                        onClick={() => setStep(2)}
                      >
                        Atr�s
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition"
                        onClick={() => goNextStep(4)}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}

                {/* Paso 4 */}
                {step === 4 && (
                  <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {/* Tabs */}
                <div
                  role="tablist"
                  aria-label="Detalles de la vacante"
                  className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                {tabItems.map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    role="tab"
                    aria-selected={tab4 === (t.k as any)}
                    className={clsx(
                      "flex items-center gap-2 rounded-lg h-9 px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                      tab4 === (t.k as any)
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    )}
                    onClick={() => setTab4(t.k as any)}
                  >
                    <span>{t.lbl}</span>
                    {t.done ? (
                      <span className="inline-flex h-4 w-4 items-center justify-center">
                        <CheckCircle2
                          className={clsx(
                            "h-3.5 w-3.5",
                            tab4 === (t.k as any)
                              ? "text-white/90"
                              : "text-emerald-500"
                          )}
                        />
                      </span>
                    ) : (
                      <span className="inline-flex h-4 w-4 items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Descripción */}
              {tab4 === "desc" && (
                <div className="animate-fade-in-up grid gap-4 mt-4">
                  <label className="text-sm font-medium">
                    Descripción de la vacante *
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Incluye responsabilidades, requisitos y beneficios.
                  </p>
                  <Controller
                    name="descriptionHtml"
                    control={control}
                    render={({ field: { value, onChange } }) => {
                      const isEmpty = !value || !value.trim();
                      return (
                        <div className="relative [&_.job-editor]:min-h-[260px] md:[&_.job-editor]:min-h-[320px] [&_.job-editor+div]:hidden [&_.job-editor~div]:hidden">
                          <JobRichTextEditor
                            valueHtml={value || ""}
                            onChangeHtml={(html, plain) => {
                              const safe = sanitizeHtml(html || "");
                              onChange(safe);
                              const plainText =
                                plain || htmlToPlain(safe);
                              setValue("descriptionPlain", plainText, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                          />
                          {isEmpty && (
                            <div className="pointer-events-none absolute left-4 right-4 top-12 text-xs text-zinc-400 dark:text-zinc-500 whitespace-pre-line">
                              Ejemplo:
                              - Responsabilidades principales
                              - Requisitos clave y tecnolog�as
                              - Beneficios y cultura del equipo
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <div
                    className={clsx(
                      "text-xs",
                      canNext4 ? "text-emerald-600" : "text-red-500"
                    )}
                  >
                    chars: {descLength}/{MAX_DESC_CHARS}&nbsp;&nbsp;palabras:{" "}
                    {wordCount}/{MAX_DESC_WORDS}
                  </div>
                  {errors.descriptionPlain && (
                    <p className="text-xs text-red-600">
                      {errors.descriptionPlain.message}
                    </p>
                  )}
                </div>
              )}

              {/* SKILLS / CERTS */}
              {tab4 === "skills" && (
                <div className="animate-fade-in-up grid gap-6">
                  <div className="grid gap-3">
                    <label className="text-sm font-medium">
                      Skills / Certs
                    </label>

                    <div className="relative">
                      <input
                        className="w-full rounded-md border border-zinc-300 bg-white p-4 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                        placeholder="Busca (ej. Python, AWS, React Native...) y presiona Enter"
                        value={skillQuery}
                        onChange={(e) =>
                          setSkillQuery(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Enter" ||
                              e.key === "Tab") &&
                            skillQuery.trim()
                          ) {
                            e.preventDefault();
                            addSkillByName(
                              filteredSkills[0] ||
                                skillQuery.trim(),
                              "req"
                            );
                          }
                        }}
                        aria-autocomplete="list"
                        aria-expanded={!!skillQuery}
                      />
                      {skillQuery && (
                        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                          {filteredSkills.length === 0 ? (
                            <div className="p-2 text-sm text-zinc-500">
                              Sin resultados
                            </div>
                          ) : (
                            filteredSkills.map((s) => (
                              <button
                                key={s}
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                                onClick={() =>
                                  addSkillByName(s, "req")
                                }
                                role="option"
                              >
                                {s}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* bins */}
                    <div className="grid sm:grid-cols-2 gap-6">
                      <Bin
                        title="Obligatoria"
                        items={requiredSkills}
                        placeholder="Arrastra aqu�"
                        onRemove={(name) =>
                          setValue(
                            "requiredSkills",
                            requiredSkills.filter(
                              (x) => x !== name
                            ),
                            { shouldDirty: true }
                          )
                        }
                        onDragStart={(name, e) =>
                          onDragStart(e, {
                            kind: "skill",
                            name,
                            from: "req",
                          })
                        }
                        onDrop={(e) => onDropSkills(e, "req")}
                      />
                      <Bin
                        title="Deseable"
                        items={niceSkills}
                        placeholder="Sin elementos"
                        onRemove={(name) =>
                          setValue(
                            "niceSkills",
                            niceSkills.filter((x) => x !== name),
                            { shouldDirty: true }
                          )
                        }
                        onDragStart={(name, e) =>
                          onDragStart(e, {
                            kind: "skill",
                            name,
                            from: "nice",
                          })
                        }
                        onDrop={(e) => onDropSkills(e, "nice")}
                      />
                    </div>
                  </div>

                  {/* Certificaciones */}
                  <div className="grid gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <label className="text-sm font-medium">
                      Certificaciones (opcional)
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Opcional: agrega certificaciones relevantes.
                    </p>
                    <div className="relative">
                      <input
                        className="w-full rounded-md border border-zinc-300 bg-white p-4 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                        placeholder="Busca y selecciona (ej. AWS SAA, CCNA...)"
                        value={certQuery}
                        onChange={(e) =>
                          setCertQuery(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Enter" ||
                              e.key === "Tab") &&
                            certQuery.trim()
                          ) {
                            e.preventDefault();
                            addCert(
                              filteredCerts[0] ||
                                certQuery.trim()
                            );
                          }
                        }}
                        aria-autocomplete="list"
                        aria-expanded={!!certQuery}
                      />
                      {certQuery && (
                        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                          {filteredCerts.length === 0 ? (
                            <div className="p-2 text-sm text-zinc-500">
                              Sin resultados
                            </div>
                          ) : (
                            filteredCerts.map((c) => (
                              <button
                                key={c}
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                                onClick={() => addCert(c)}
                                role="option"
                              >
                                {c}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {certs.length ? (
                      <div className="flex flex-wrap gap-2">
                        {certs.map((c) => (
                          <span
                            key={c}
                            className="group inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 transition cursor-pointer hover:bg-emerald-100/70 active:scale-[0.98] focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-500/40 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30"
                          >
                            {c}
                            <button
                              type="button"
                              aria-label="Remove"
                              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-emerald-700/60 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                              onClick={() =>
                                setValue(
                                  "certs",
                                  certs.filter((x) => x !== c),
                                  { shouldDirty: true }
                                )
                              }
                              title="Quitar"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Opcional.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* IDIOMAS */}
              {tab4 === "langs" && (
                <div className="animate-fade-in-up grid gap-6">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Idiomas requeridos (opcional)
                    </label>
                    <button
                      type="button"
                      className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      onClick={() =>
                        addLanguageRow({
                          name: "Ingl�s",
                          level: "PROFESSIONAL",
                        })
                      }
                    >
                      + A�adir idioma
                    </button>
                  </div>

                  {languageFields.length === 0 && (
                    <p className="text-xs text-zinc-500">
                      A�ade uno o m�s idiomas relevantes para la
                      vacante (ej. Ingl�s profesional).
                    </p>
                  )}

                  <div className="grid gap-2">
                    {languageFields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] gap-2 items-center"
                      >
                        <select
                          className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                          {...register(
                            `languages.${idx}.name` as const
                          )}
                        >
                          {LANGUAGES_FALLBACK.map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                        </select>

                        <select
                          className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                          {...register(
                            `languages.${idx}.level` as const
                          )}
                        >
                          <option value="NATIVE">Nativo</option>
                          <option value="PROFESSIONAL">
                            Profesional (C1�C2)
                          </option>
                          <option value="CONVERSATIONAL">
                            Conversacional (B1�B2)
                          </option>
                          <option value="BASIC">
                            B�sico (A1�A2)
                          </option>
                        </select>

                        <button
                          type="button"
                          aria-label="Remove"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-emerald-700/60 transition hover:text-emerald-700 hover:border-emerald-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-zinc-700"
                          onClick={() => removeLanguageRow(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EDUCACI�N */}
              {tab4 === "edu" && (
                <div className="animate-fade-in-up grid gap-6">
                  <div className="grid md:grid-cols-2 gap-6 min-w-0">
                    <div className="grid gap-2 min-w-0">
                      <label className="text-sm font-medium">Nivel mínimo</label>
                      <select
                        className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                        {...register("minDegree")}
                      >
                        <option value="HIGHSCHOOL">
                          Bachillerato
                        </option>
                        <option value="TECH">T�cnico</option>
                        <option value="BACHELOR">
                          Licenciatura / Ingenier�a
                        </option>
                        <option value="MASTER">Maestr�a</option>
                        <option value="PHD">Doctorado</option>
                      </select>
                    </div>

                    <div className="grid gap-2 min-w-0">
                      <label className="text-sm font-medium">
                        Agregar educaci�n (programa / carrera)
                      </label>
                      <div className="relative">
                        <input
                          className="w-full min-w-0 h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                          placeholder="Ej. Ingenier�a en Sistemas, Maestr�a en TI... (Enter agrega)"
                          value={educationQuery}
                          onChange={(e) =>
                            setEducationQuery(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (
                              (e.key === "Enter" ||
                                e.key === "Tab") &&
                              educationQuery.trim()
                            ) {
                              e.preventDefault();
                              addEduByName(
                                filteredEducation[0] ||
                                  educationQuery.trim(),
                                "req"
                              );
                            }
                          }}
                          aria-autocomplete="list"
                          aria-expanded={!!educationQuery}
                        />
                        {educationQuery && (
                          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                            {filteredEducation.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-zinc-500">
                                Sin resultados
                              </div>
                            ) : (
                              filteredEducation.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                                  onClick={() =>
                                    addEduByName(s, "req")
                                  }
                                  role="option"
                                >
                                  {s}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* bins educaci�n */}
                  <div className="grid sm:grid-cols-2 gap-6">
                    <Bin
                      title="Obligatoria"
                      items={eduRequired}
                      placeholder="Sin elementos"
                      onRemove={(name) =>
                        setValue(
                          "eduRequired",
                          eduRequired.filter((x) => x !== name),
                          { shouldDirty: true }
                        )
                      }
                      onDragStart={(name, e) =>
                        onDragStart(e, {
                          kind: "edu",
                          name,
                          from: "req",
                        })
                      }
                      onDrop={(e) => onDropEdu(e, "req")}
                    />
                    <Bin
                      title="Deseable"
                      items={eduNice}
                      placeholder="Sin elementos"
                      onRemove={(name) =>
                        setValue(
                          "eduNice",
                          eduNice.filter((x) => x !== name),
                          { shouldDirty: true }
                        )
                      }
                      onDragStart={(name, e) =>
                        onDragStart(e, {
                          kind: "edu",
                          name,
                          from: "nice",
                        })
                      }
                      onDrop={(e) => onDropEdu(e, "nice")}
                    />
                  </div>
                  {eduRequired.length === 0 && eduNice.length === 0 && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Agrega al menos un programa educativo recomendado para la vacante.
                    </p>
                  )}
                </div>
              )}

                    {/* Navegaci�n paso 4 */}
                    <div className="flex justify-between gap-4 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                        onClick={() => setStep(3)}
                      >
                        Atr�s
                      </button>
                      <button
                        type="button"
                        className={clsx(
                          "rounded-md px-6 py-2.5 text-sm font-medium text-white transition",
                          canNext4
                            ? "bg-emerald-600 hover:bg-emerald-500"
                            : "bg-emerald-300 cursor-not-allowed"
                        )}
                        disabled={!canNext4}
                        onClick={() => goNextStep(5)}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}

                {/* Paso 5 - Revisión */}
                {step === 5 && (
                  <div className="space-y-8 rounded-xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      5) Revisión y publicación
                    </h3>

                {/* Bloque general de revisi�n */}
                <ReviewBlock presetCompany={presetCompany} onEditStep={setStep} onEditTab={setTab4} />

                    <div className="pt-10 mt-10 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex justify-between gap-4">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                          onClick={() => setStep(4)}
                        >
                          Atrás
                        </button>
                        <button
                          type="submit"
                          className="rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-emerald-300 disabled:cursor-not-allowed transition shadow-sm hover:shadow-md"
                          disabled={busy}
                        >
                          {busy
                            ? initial?.id
                              ? "Guardando..."
                              : "Publicando..."
                            : initial?.id
                            ? "Guardar cambios"
                            : "Publicar vacante"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar Column - Quality Indicator (screens >= lg) */}
              <aside className="hidden lg:block">
                <div className="sticky top-8">
                  <QualityIndicator score={qualityScore} />
                </div>
              </aside>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
/* =============================
   Subcomponentes auxiliares
============================= */

function NumberMini({
  label,
  field,
  max,
}: {
  label: string;
  field: "aguinaldoDias" | "vacacionesDias" | "primaVacPct";
  max?: number;
}) {
  const { register } = useFormContext<JobForm>();
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="whitespace-nowrap">{label}:</span>
      <input
        type="number"
        min={0}
        max={max}
        className="h-10 w-16 rounded border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        {...register(field, { valueAsNumber: true })}
      />
    </div>
  );
}

function Bin({
  title,
  items,
  placeholder,
  onRemove,
  onDragStart,
  onDrop,
}: {
  title: string;
  items: string[];
  placeholder: string;
  onRemove: (name: string) => void;
  onDragStart: (
    name: string,
    e: React.DragEvent<HTMLSpanElement>
  ) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="rounded-md border border-zinc-200 bg-white p-5 min-h-[180px] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {title}
      </p>
      <div className="flex flex-wrap items-start gap-2 min-h-[32px]">
        {items.length === 0 ? (
          <span className="text-xs text-zinc-400">
            {placeholder}
          </span>
        ) : (
          items.map((name) => (
            <span
              key={name}
              draggable
              onDragStart={(e) => onDragStart(name, e)}
              className="group inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 transition cursor-pointer hover:bg-emerald-100/70 active:scale-[0.98] focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-500/40 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30"
            >
              {name}
              <button
                type="button"
                aria-label="Remove"
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-emerald-700/60 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                onClick={() => onRemove(name)}
                title="Quitar"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function ReviewBlock({
  presetCompany,
  onEditStep,
  onEditTab,
}: {
  presetCompany: PresetCompany;
  onEditStep: (step: number) => void;
  onEditTab: (tab: "desc" | "skills" | "langs" | "edu") => void;
}) {
  const { watch } = useFormContext<JobForm>();
  const v = watch();

  const isRemote = v.locationType === "REMOTE";
  const locationText = isRemote
    ? "Remoto"
    : `${v.locationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${v.city || ""}`;

  const salaryMin =
    typeof v.salaryMin === "number" && !Number.isNaN(v.salaryMin)
      ? v.salaryMin
      : undefined;
  const salaryMax =
    typeof v.salaryMax === "number" && !Number.isNaN(v.salaryMax)
      ? v.salaryMax
      : undefined;
  const hasMin = salaryMin !== undefined;
  const hasMax = salaryMax !== undefined;
  const hasSalary = hasMin || hasMax;

  const formatAmount = (value: number) =>
    new Intl.NumberFormat("es-MX").format(value);

  const salaryText = !hasSalary
    ? "No especificado"
    : hasMin && hasMax
    ? `${v.currency} ${formatAmount(salaryMin!)} - ${formatAmount(salaryMax!)}`
    : hasMin
    ? `Desde ${v.currency} ${formatAmount(salaryMin!)}`
    : `Hasta ${v.currency} ${formatAmount(salaryMax!)}`;

  const benefitsList = Object.entries(v.benefits || {})
    .filter(([, val]) => val)
    .map(([k]) => {
      if (k === "aguinaldo") return `Aguinaldo: ${v.aguinaldoDias} días`;
      if (k === "vacaciones")
        return `Vacaciones: ${v.vacacionesDias} días`;
      if (k === "primaVac")
        return `Prima vacacional: ${v.primaVacPct}%`;
      const lbl = BENEFITS.find((b) => b.key === k)?.label ?? k;
      return lbl;
    });

  const hasEduItems =
    (v.eduRequired && v.eduRequired.length > 0) ||
    (v.eduNice && v.eduNice.length > 0);

  const hasCerts = v.certs && v.certs.length > 0;

  const hasLanguages = v.languages && v.languages.length > 0;

  const hasRequiredSkills = v.requiredSkills && v.requiredSkills.length > 0;
  const hasNiceSkills = v.niceSkills && v.niceSkills.length > 0;

  const safeDescriptionHtml = sanitizeHtml(v.descriptionHtml || "");
  const hasDescription = Boolean(v.descriptionPlain && v.descriptionPlain.trim());

  return (
    <div className="grid gap-8">
      {/* Basic Information Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-500" />
            Información básica
          </h4>
          <button
            type="button"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md px-2 py-1"
            onClick={() => onEditStep(1)}
          >
            Editar
          </button>
        </div>
        <div className="grid gap-6">
          <div className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Título de la vacante
            </span>
            <span className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              {v.title}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Empresa
              </span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {v.companyMode === "confidential"
                  ? "Confidencial"
                  : presetCompany?.name || "Mi empresa"}
              </span>
            </div>

            <div className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Ubicación
              </span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {locationText}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Compensation Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-500">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Compensación y horario
          </h4>
          <button
            type="button"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md px-2 py-1"
            onClick={() => onEditStep(2)}
          >
            Editar
          </button>
        </div>
        <div className="grid gap-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Rango salarial
              </span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {salaryText}
                {hasSalary && (
                  <span className="ml-2 text-xs text-zinc-500">
                    {v.showSalary
                      ? "(visible en publicación)"
                      : "(oculto en publicación)"}
                  </span>
                )}
              </span>
            </div>

            <div className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Tipo de contrato
              </span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {labelEmployment(v.employmentType)}
              </span>
            </div>
          </div>

          {v.schedule ? (
            <div className="grid gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Horario
              </span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {v.schedule}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              <span>Agrega un horario de referencia</span>
              <button
                type="button"
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:border-emerald-200 hover:text-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-300"
                onClick={() => onEditStep(2)}
              >
                Agregar horario
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Benefits Card */}
      {(v.showBenefits || benefitsList.length > 0) && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-500">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              </svg>
              Prestaciones
            </h4>
            <button
              type="button"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md px-2 py-1"
              onClick={() => onEditStep(3)}
            >
              Editar
            </button>
          </div>

          {benefitsList.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-6">
              {benefitsList.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <svg className="h-5 w-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Prestaciones configuradas pero ocultas en la publicación
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {v.showBenefits ? (
                <>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                  </svg>
                  Visibles en la publicación
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                  </svg>
                  Ocultas en la publicación
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Requirements Card */}
      {(hasEduItems || hasRequiredSkills || hasNiceSkills || hasCerts || hasLanguages) && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-500">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
              Requisitos
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md px-2 py-1"
                onClick={() => {
                  onEditStep(4);
                  onEditTab("edu");
                }}
              >
                Editar educación
              </button>
              <button
                type="button"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md px-2 py-1"
                onClick={() => {
                  onEditStep(4);
                  onEditTab("skills");
                }}
              >
                Editar skills/certs
              </button>
              <button
                type="button"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md px-2 py-1"
                onClick={() => {
                  onEditStep(4);
                  onEditTab("langs");
                }}
              >
                Editar idiomas
              </button>
            </div>
          </div>

          <div className="grid gap-8">
            {/* Education */}
            <div className="grid gap-6">
              <div className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Nivel mínimo de educación
                </span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {labelDegree(v.minDegree)}
                </span>
              </div>

              {hasEduItems && (
                <div className="grid gap-2">
                  {v.eduRequired && v.eduRequired.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 block">
                        Carreras requeridas:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {v.eduRequired.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-700 dark:text-emerald-300">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
                            </svg>
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {v.eduNice && v.eduNice.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 block">
                        Carreras deseables:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {v.eduNice.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-700 dark:text-zinc-200">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/>
                            </svg>
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Skills */}
            {(hasRequiredSkills || hasNiceSkills) && (
              <div className="grid gap-6">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Skills técnicos
                </span>

                {hasRequiredSkills && (
                  <div>
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 block">
                      Obligatorios:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {v.requiredSkills!.map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
                          </svg>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {hasNiceSkills && (
                  <div>
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 block">
                      Deseables:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {v.niceSkills!.map((name) => (
                        <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/>
                          </svg>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Certifications */}
            {hasCerts && (
              <div className="grid gap-6">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Certificaciones
                </span>
                <div className="flex flex-wrap gap-2">
                  {v.certs!.map((cert) => (
                    <span key={cert} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 text-xs font-medium text-purple-700 dark:text-purple-300">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {hasLanguages && (
              <div className="grid gap-6">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Idiomas requeridos
                </span>
                <div className="flex flex-wrap gap-2">
                  {v.languages!.map((lng) => (
                    <span key={`${lng.name}-${lng.level}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.894L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd"/>
                      </svg>
                      {lng.name}
                      <span className="text-[10px] opacity-75">
                        ({labelLanguageLevel(lng.level as LanguageProficiency)})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-500">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
            Descripción de la vacante
          </h4>
          <button
            type="button"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-md px-2 py-1"
            onClick={() => {
              onEditStep(4);
              onEditTab("desc");
            }}
          >
            Editar
          </button>
        </div>
        {!hasDescription && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <span>La descripción está vacía.</span>
            <button
              type="button"
              className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:border-amber-300 hover:text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200"
              onClick={() => {
                onEditStep(4);
                onEditTab("desc");
              }}
            >
              Agregar descripción
            </button>
          </div>
        )}
        <div
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-zinc-100 prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-li:text-zinc-700 dark:prose-li:text-zinc-300 prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100"
          dangerouslySetInnerHTML={{
            __html:
              safeDescriptionHtml ||
              "<p class='text-zinc-500 dark:text-zinc-400 italic'>Sin descripción</p>",
          }}
        />
      </div>
    </div>
  );
}
/* =============================
   Helpers
============================= */
function inputCls(err?: any) {
  return clsx(
    "min-w-0 rounded-md border bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900",
    err ? "border-red-500" : "border-zinc-300"
  );
}