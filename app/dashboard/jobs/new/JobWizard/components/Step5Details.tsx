// app/dashboard/jobs/new/JobWizard/components/Step5Details.tsx
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Controller, useFormContext, useFieldArray } from "react-hook-form";
import { X, CheckCircle2, Sparkles, Loader2, Wand2 } from "lucide-react";
import clsx from "clsx";
import { JobForm } from "../types";
import { BENEFITS, EDUCATION_SUGGESTIONS } from "../constants";
import { sanitizeHtml, htmlToPlain } from "../utils/helpers";
import { createStringFuse, searchStrings } from "@/lib/search/fuse";
import { LANGUAGES_FALLBACK } from "@/lib/shared/skills-data";
import JobRichTextEditor from "@/components/jobs/JobRichTextEditor";
import SkillBin from "./SkillBin";
import WizardWarningModal from "./WizardWarningModal";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { DEGREE_OPTIONS, normalizeDegreeValue } from "../lib/job-enums";

export type Step5Tab = "desc" | "skills" | "langs" | "edu";

type Props = {
  skillsOptions: string[];
  certOptions: string[];
  onNext: () => void;
  onBack: () => void;
  activeTab?: Step5Tab;
  onTabChange?: (tab: Step5Tab) => void;
};

type AiMode = "generate-all" | "improve-description" | "extract-structure";

function plainToBasicHtml(plain: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = plain.replace(/\r\n/g, "\n").split("\n");
  const paragraphs: string[][] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      if (buffer.length) {
        paragraphs.push(buffer);
        buffer = [];
      }
      continue;
    }
    buffer.push(line);
  }

  if (buffer.length) paragraphs.push(buffer);

  const bulletPrefixes = ["- ", "* ", "• "];

  return paragraphs
    .map((paraLines) => {
      const allBullets = paraLines.every((line) =>
        bulletPrefixes.some((prefix) => line.startsWith(prefix))
      );

      if (allBullets) {
        const items = paraLines
          .map((line) => {
            const prefix = bulletPrefixes.find((p) => line.startsWith(p)) || "";
            return escape(line.slice(prefix.length).trim());
          })
          .filter(Boolean);

        return items.length
          ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`
          : "";
      }

      return `<p>${paraLines.map(escape).join("<br/>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

export default function Step5Details({
  skillsOptions,
  certOptions,
  onNext,
  onBack,
  activeTab = "desc",
  onTabChange,
}: Props) {
  const {
    watch,
    setValue,
    getValues,
    register,
    control,
    formState: { errors },
  } = useFormContext<JobForm>();

  const [tab, setTab] = useState<Step5Tab>(activeTab);
  const [skillQuery, setSkillQuery] = useState("");
  const [certQuery, setCertQuery] = useState("");
  const [educationQuery, setEducationQuery] = useState("");
  const [isEducationOpen, setIsEducationOpen] = useState(false);
  const [highlightedSkillIndex, setHighlightedSkillIndex] = useState(0);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const [isExtractingStructure, setIsExtractingStructure] = useState(false);
  const [showMissingSkillsModal, setShowMissingSkillsModal] = useState(false);

  const educationDropdownRef = useRef<HTMLDivElement | null>(null);
  const skillsDropdownRef = useRef<HTMLDivElement | null>(null);

  const {
    fields: languageFields,
    append: addLanguageRow,
    remove: removeLanguageRow,
  } = useFieldArray({ control, name: "languages" });

  const requiredSkills = watch("requiredSkills");
  const niceSkills = watch("niceSkills");
  const eduRequired = watch("eduRequired");
  const eduNice = watch("eduNice");
  const certs = watch("certs");
  const descriptionPlain = watch("descriptionPlain") || "";
  const descLength = descriptionPlain.length;
  const wordCount = descriptionPlain.trim()
    ? descriptionPlain.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const canNext = descLength >= 50;
  const totalSkills = requiredSkills.length + niceSkills.length;
  const hasSkills = totalSkills > 0;

  const title = watch("title");
  const companyMode = watch("companyMode");
  const locationType = watch("locationType");
  const city = watch("city");
  const country = watch("country");
  const currency = watch("currency");
  const salaryMin = watch("salaryMin");
  const salaryMax = watch("salaryMax");
  const employmentType = watch("employmentType");
  const schedule = watch("schedule");
  const benefits = watch("benefits");
  const aguinaldoDias = watch("aguinaldoDias");
  const vacacionesDias = watch("vacacionesDias");
  const primaVacPct = watch("primaVacPct");
  const assessmentTemplateId = watch("assessmentTemplateId");
  const languages = watch("languages");
  const minDegree = watch("minDegree");

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (hasSkills && showMissingSkillsModal) {
      setShowMissingSkillsModal(false);
    }
  }, [hasSkills, showMissingSkillsModal]);

  function changeTab(next: Step5Tab) {
    setTab(next);
    onTabChange?.(next);
  }

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

  useEffect(() => {
    setHighlightedSkillIndex(0);
  }, [skillQuery]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent | MouseEvent) {
      const target = e.target as Node | null;

      if (
        educationDropdownRef.current &&
        target &&
        !educationDropdownRef.current.contains(target)
      ) {
        setIsEducationOpen(false);
      }

      if (
        skillsDropdownRef.current &&
        target &&
        !skillsDropdownRef.current.contains(target)
      ) {
        setSkillQuery("");
        setHighlightedSkillIndex(0);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsEducationOpen(false);
        setSkillQuery("");
        setHighlightedSkillIndex(0);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function addSkill(name: string, to: "req" | "nice" = "req") {
    const n = name.trim();
    if (!n || requiredSkills.includes(n) || niceSkills.includes(n)) return;

    if (to === "req") {
      setValue("requiredSkills", [...requiredSkills, n], { shouldDirty: true });
    } else {
      setValue("niceSkills", [...niceSkills, n], { shouldDirty: true });
    }

    setSkillQuery("");
    setHighlightedSkillIndex(0);
  }

  function addEdu(name: string, to: "req" | "nice" = "req") {
    const n = name.trim();
    if (!n || eduRequired.includes(n) || eduNice.includes(n)) return;

    if (to === "req") {
      setValue("eduRequired", [...eduRequired, n], { shouldDirty: true });
    } else {
      setValue("eduNice", [...eduNice, n], { shouldDirty: true });
    }

    setEducationQuery("");
    setIsEducationOpen(false);
  }

  function addCert(c: string) {
    const n = c.trim();
    if (!n || certs.includes(n)) return;
    setValue("certs", [...certs, n], { shouldDirty: true });
    setCertQuery("");
  }

  function onDragStart(
    e: React.DragEvent<HTMLSpanElement>,
    payload: { kind: "skill" | "edu"; name: string; from: "req" | "nice" }
  ) {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
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

  function onDropEdu(e: React.DragEvent<HTMLDivElement>, to: "req" | "nice") {
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
        setValue("eduNice", [...eduNice, payload.name], { shouldDirty: true });
      }
      setValue(
        "eduRequired",
        eduRequired.filter((n) => n !== payload.name),
        { shouldDirty: true }
      );
    }
  }

  function getHighlightedSkill() {
    if (!filteredSkills.length) return null;
    const safeIndex = Math.min(
      Math.max(highlightedSkillIndex, 0),
      filteredSkills.length - 1
    );
    return filteredSkills[safeIndex] || null;
  }

  function renderHighlightedText(text: string, query: string) {
    const q = query.trim();
    if (!q) return text;

    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;

    const start = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const end = text.slice(idx + q.length);

    return (
      <>
        {start}
        <mark className="rounded bg-emerald-100 px-0.5 text-inherit dark:bg-emerald-900/40">
          {match}
        </mark>
        {end}
      </>
    );
  }

  function buildAiPayload(mode: AiMode) {
    const activeBenefits = Object.entries(benefits || {})
      .filter(([, enabled]) => enabled)
      .map(([key]) => {
        if (key === "aguinaldo") return `Aguinaldo (${aguinaldoDias} días)`;
        if (key === "vacaciones") return `Vacaciones (${vacacionesDias} días)`;
        if (key === "primaVac") return `Prima vacacional (${primaVacPct}%)`;
        return BENEFITS.find((b) => b.key === key)?.label ?? key;
      });

    return {
      mode,
      title,
      companyMode,
      locationType,
      city,
      country,
      currency,
      salaryMin:
        typeof salaryMin === "number"
          ? salaryMin
          : typeof salaryMin === "string"
            ? Number(salaryMin) || null
            : null,
      salaryMax:
        typeof salaryMax === "number"
          ? salaryMax
          : typeof salaryMax === "string"
            ? Number(salaryMax) || null
            : null,
      employmentType,
      schedule,
      benefits: activeBenefits,
      assessmentSelected: !!assessmentTemplateId,
      currentDescriptionPlain: descriptionPlain,
      currentRequiredSkills: requiredSkills,
      currentNiceSkills: niceSkills,
      currentEduRequired: eduRequired,
      currentEduNice: eduNice,
      currentCerts: certs,
      currentLanguages: languages,
      currentMinDegree: minDegree,
    };
  }

  async function callAi(mode: AiMode) {
    const res = await fetch("/api/ai/job-wizard/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAiPayload(mode)),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || "No se pudo generar contenido con AI.");
    }

    const draft = data?.draft;
    if (!draft) {
      throw new Error("La respuesta de AI llegó vacía.");
    }

    const html =
      typeof draft.descriptionHtml === "string" && draft.descriptionHtml.trim()
        ? sanitizeHtml(draft.descriptionHtml)
        : sanitizeHtml(plainToBasicHtml(draft.descriptionPlain || ""));

    const plain =
      typeof draft.descriptionPlain === "string" && draft.descriptionPlain.trim()
        ? draft.descriptionPlain.trim()
        : htmlToPlain(html);

    const hasUsefulStringArray = (value: unknown, minItems = 1) =>
      Array.isArray(value) &&
      value.filter((item) => String(item || "").trim()).length >= minItems;

    const hasUsefulLanguages = (
      value: unknown,
      minItems = 1
    ): value is Array<{
      name: string;
      level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
    }> => {
      if (!Array.isArray(value)) return false;

      const valid = value.filter((item) => {
        if (!item || typeof item !== "object") return false;

        const name = String((item as { name?: unknown }).name || "").trim();
        const level = (item as { level?: unknown }).level;

        return (
          !!name &&
          (level === "NATIVE" ||
            level === "PROFESSIONAL" ||
            level === "CONVERSATIONAL" ||
            level === "BASIC")
        );
      });

      return valid.length >= minItems;
    };

    return {
      draft,
      html,
      plain,
      hasUsefulStringArray,
      hasUsefulLanguages,
    };
  }

  async function handleGenerateWithAi() {
    if (!title?.trim() || title.trim().length < 3) {
      toastError("Primero captura un título válido para la vacante.");
      return;
    }

    setIsGeneratingAi(true);

    try {
      const { draft, html, plain, hasUsefulStringArray, hasUsefulLanguages } =
        await callAi("generate-all");

      setValue("descriptionHtml", html, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("descriptionPlain", plain, {
        shouldDirty: true,
        shouldValidate: true,
      });

      const normalizedAiDegree = normalizeDegreeValue(draft.minDegree);
      if (normalizedAiDegree) {
        setValue("minDegree", normalizedAiDegree, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      setValue(
        "requiredSkills",
        hasUsefulStringArray(draft.requiredSkills, 1) ? draft.requiredSkills : [],
        { shouldDirty: true, shouldValidate: true }
      );

      setValue(
        "niceSkills",
        hasUsefulStringArray(draft.niceSkills, 1) ? draft.niceSkills : [],
        { shouldDirty: true, shouldValidate: true }
      );

      setValue(
        "eduRequired",
        hasUsefulStringArray(draft.eduRequired, 1) ? draft.eduRequired : [],
        { shouldDirty: true, shouldValidate: true }
      );

      setValue(
        "eduNice",
        hasUsefulStringArray(draft.eduNice, 1) ? draft.eduNice : [],
        { shouldDirty: true, shouldValidate: true }
      );

      setValue("certs", hasUsefulStringArray(draft.certs, 1) ? draft.certs : [], {
        shouldDirty: true,
        shouldValidate: true,
      });

      setValue(
        "languages",
        hasUsefulLanguages(draft.languages, 1) ? draft.languages : [],
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );

      changeTab("desc");
      toastSuccess("Contenido generado con AI");
    } catch (err: any) {
      toastError(err?.message || "Ocurrió un error al generar contenido con AI.");
    } finally {
      setIsGeneratingAi(false);
    }
  }

  async function handleImproveDescriptionWithAi() {
    if (!title?.trim() || title.trim().length < 3) {
      toastError("Primero captura un título válido para la vacante.");
      return;
    }

    if (!descriptionPlain.trim()) {
      toastError("Primero escribe una base de descripción para poder mejorarla.");
      return;
    }

    setIsImprovingDescription(true);

    try {
      const { draft, html, plain } = await callAi("improve-description");

      setValue("descriptionHtml", html, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setValue("descriptionPlain", plain, {
        shouldDirty: true,
        shouldValidate: true,
      });

      const normalizedAiDegree = normalizeDegreeValue(draft.minDegree);
      if (normalizedAiDegree) {
        setValue("minDegree", normalizedAiDegree, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      changeTab("desc");
      toastSuccess("Descripción mejorada con AI");
    } catch (err: any) {
      toastError(
        err?.message || "Ocurrió un error al mejorar la descripción con AI."
      );
    } finally {
      setIsImprovingDescription(false);
    }
  }

  async function handleExtractStructureWithAi() {
    if (!title?.trim() || title.trim().length < 3) {
      toastError("Primero captura un título válido para la vacante.");
      return;
    }

    if (!descriptionPlain.trim()) {
      toastError("Primero escribe o genera una descripción para extraer estructura.");
      return;
    }

    setIsExtractingStructure(true);

    try {
      const { draft, hasUsefulStringArray, hasUsefulLanguages } = await callAi(
        "extract-structure"
      );

      const currentRequiredSkills = getValues("requiredSkills") || [];
      const currentNiceSkills = getValues("niceSkills") || [];
      const currentEduRequired = getValues("eduRequired") || [];
      const currentEduNice = getValues("eduNice") || [];
      const currentCerts = getValues("certs") || [];
      const currentLanguages = getValues("languages") || [];
      const currentMinDegree = getValues("minDegree");

      const normalizedAiDegree = normalizeDegreeValue(draft.minDegree);

      if (normalizedAiDegree) {
        setValue("minDegree", normalizedAiDegree, {
          shouldDirty: true,
          shouldValidate: true,
        });
      } else if (currentMinDegree) {
        setValue("minDegree", currentMinDegree, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      setValue(
        "requiredSkills",
        hasUsefulStringArray(draft.requiredSkills, 2)
          ? draft.requiredSkills
          : currentRequiredSkills,
        { shouldDirty: true, shouldValidate: true }
      );

      setValue(
        "niceSkills",
        hasUsefulStringArray(draft.niceSkills, 1)
          ? draft.niceSkills
          : currentNiceSkills,
        { shouldDirty: true, shouldValidate: true }
      );

      setValue(
        "eduRequired",
        hasUsefulStringArray(draft.eduRequired, 1)
          ? draft.eduRequired
          : currentEduRequired,
        { shouldDirty: true, shouldValidate: true }
      );

      setValue(
        "eduNice",
        hasUsefulStringArray(draft.eduNice, 1)
          ? draft.eduNice
          : currentEduNice,
        { shouldDirty: true, shouldValidate: true }
      );

      setValue(
        "certs",
        hasUsefulStringArray(draft.certs, 1) ? draft.certs : currentCerts,
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );

      setValue(
        "languages",
        hasUsefulLanguages(draft.languages, 1) ? draft.languages : currentLanguages,
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );

      changeTab("skills");
      toastSuccess("Skills y requisitos extraídos con AI");
    } catch (err: any) {
      toastError(
        err?.message || "Ocurrió un error al extraer skills y requisitos con AI."
      );
    } finally {
      setIsExtractingStructure(false);
    }
  }

  function handleNextWithWarnings() {
    if (!canNext) return;

    if (!hasSkills) {
      setShowMissingSkillsModal(true);
      return;
    }

    onNext();
  }

  const tabItems = [
    { k: "desc" as Step5Tab, lbl: "Descripción", done: descLength > 0 },
    {
      k: "skills" as Step5Tab,
      lbl: "Skills / Certs",
      done: requiredSkills.length + niceSkills.length + certs.length > 0,
    },
    { k: "langs" as Step5Tab, lbl: "Idiomas", done: languageFields.length > 0 },
    {
      k: "edu" as Step5Tab,
      lbl: "Educación",
      done: eduRequired.length + eduNice.length > 0,
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:space-y-6 md:p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Asistente AI para redactar la vacante</span>
          </div>
          <p className="text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-300/80">
            Genera o mejora la descripción usando el título, el contexto capturado y
            la base escrita por el reclutador.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={handleGenerateWithAi}
            disabled={isGeneratingAi || isImprovingDescription || isExtractingStructure}
            className={clsx(
              "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition",
              isGeneratingAi || isImprovingDescription || isExtractingStructure
                ? "cursor-not-allowed bg-emerald-300 text-white"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            )}
          >
            {isGeneratingAi ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 shrink-0" />
                Generar con AI
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleImproveDescriptionWithAi}
            disabled={
              isGeneratingAi ||
              isImprovingDescription ||
              isExtractingStructure ||
              !descriptionPlain.trim()
            }
            className={clsx(
              "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-center text-sm font-semibold transition",
              isGeneratingAi || isImprovingDescription || isExtractingStructure
                ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
                : !descriptionPlain.trim()
                  ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
                  : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
            )}
          >
            {isImprovingDescription ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Mejorando...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 shrink-0" />
                Mejorar descripción
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExtractStructureWithAi}
            disabled={
              isGeneratingAi ||
              isImprovingDescription ||
              isExtractingStructure ||
              !descriptionPlain.trim()
            }
            className={clsx(
              "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-center text-sm font-semibold transition sm:col-span-2 xl:col-span-1",
              isGeneratingAi || isImprovingDescription || isExtractingStructure
                ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
                : !descriptionPlain.trim()
                  ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
                  : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
            )}
          >
            {isExtractingStructure ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Extrayendo...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 shrink-0" />
                Extraer skills y requisitos
              </>
            )}
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Detalles de la vacante"
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50/70 p-1 scrollbar-none md:mx-0 md:flex-wrap md:overflow-visible dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        {tabItems.map((t) => (
          <button
            key={t.k}
            type="button"
            role="tab"
            aria-selected={tab === t.k}
            className={clsx(
              "flex min-h-10 shrink-0 snap-start items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 md:min-h-9 md:justify-start",
              "min-w-[132px] md:min-w-0",
              tab === t.k
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
            onClick={() => changeTab(t.k)}
          >
            <span className="whitespace-nowrap">{t.lbl}</span>
            {t.done ? (
              <CheckCircle2
                className={clsx(
                  "h-3.5 w-3.5 shrink-0",
                  tab === t.k ? "text-white/90" : "text-emerald-500"
                )}
              />
            ) : (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            )}
          </button>
        ))}
      </div>

      {tab === "desc" && (
        <div className="mt-4 grid animate-fade-in-up gap-4">
          <label className="text-sm font-medium">Descripción de la vacante *</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Incluye responsabilidades, requisitos y beneficios.
          </p>

          <Controller
            name="descriptionHtml"
            control={control}
            render={({ field: { value, onChange } }) => {
              const isEmpty = !value || !value.trim();

              return (
                <div className="relative [&_.job-editor+div]:hidden [&_.job-editor]:min-h-[220px] [&_.job-editor~div]:hidden md:[&_.job-editor]:min-h-[320px]">
                  <JobRichTextEditor
                    valueHtml={value || ""}
                    onChangeHtml={(html, plain) => {
                      const safe = sanitizeHtml(html || "");
                      onChange(safe);
                      setValue("descriptionPlain", plain || htmlToPlain(safe), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                  {isEmpty && (
                    <div className="pointer-events-none absolute left-3 right-3 top-12 whitespace-pre-line text-xs leading-relaxed text-zinc-400 dark:text-zinc-500 md:left-4 md:right-4">
                      Ejemplo:{"\n"}- Responsabilidades principales{"\n"}- Requisitos clave y
                      tecnologías{"\n"}- Beneficios y cultura del equipo
                    </div>
                  )}
                </div>
              );
            }}
          />

          <div
            className={clsx(
              "text-xs leading-relaxed",
              canNext ? "text-emerald-600" : "text-red-500"
            )}
          >
            chars: {descLength}/500&nbsp;&nbsp;palabras: {wordCount}/80
          </div>

          {errors.descriptionPlain && (
            <p className="text-xs text-red-600">
              {errors.descriptionPlain.message}
            </p>
          )}
        </div>
      )}

      {tab === "skills" && (
        <div className="grid animate-fade-in-up gap-6">
          <div className="grid gap-3">
            <label className="text-sm font-medium">Skills / Certs</label>

            <div ref={skillsDropdownRef} className="relative">
              <input
                className="w-full rounded-md border border-zinc-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 md:p-4 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Busca (ej. Python, AWS, React Native...) y presiona Enter"
                value={skillQuery}
                onChange={(e) => {
                  setSkillQuery(e.target.value);
                  setHighlightedSkillIndex(0);
                }}
                onFocus={() => {
                  if (skillQuery.trim()) setHighlightedSkillIndex(0);
                }}
                onKeyDown={(e) => {
                  if (!skillQuery.trim()) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedSkillIndex((prev) =>
                      Math.min(prev + 1, Math.max(filteredSkills.length - 1, 0))
                    );
                    return;
                  }

                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedSkillIndex((prev) => Math.max(prev - 1, 0));
                    return;
                  }

                  if (e.key === "Escape") {
                    e.preventDefault();
                    setSkillQuery("");
                    setHighlightedSkillIndex(0);
                    return;
                  }

                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    addSkill(getHighlightedSkill() || skillQuery.trim(), "req");
                  }
                }}
              />

              {skillQuery && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  {filteredSkills.length === 0 ? (
                    <div className="p-3 text-sm text-zinc-500">Sin resultados</div>
                  ) : (
                    <>
                      <div className="border-b border-zinc-100 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        Enter agrega la opción seleccionada • ↑ ↓ para navegar
                      </div>

                      {filteredSkills.map((s, idx) => {
                        const isActive = idx === highlightedSkillIndex;

                        return (
                          <button
                            key={s}
                            type="button"
                            className={clsx(
                              "block w-full px-3 py-2.5 text-left text-sm transition",
                              isActive
                                ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                            )}
                            onMouseEnter={() => setHighlightedSkillIndex(idx)}
                            onClick={() => addSkill(s, "req")}
                          >
                            {renderHighlightedText(s, skillQuery)}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <SkillBin
                title="Obligatoria"
                items={requiredSkills}
                placeholder="Arrastra aquí"
                onRemove={(n) =>
                  setValue(
                    "requiredSkills",
                    requiredSkills.filter((x) => x !== n),
                    { shouldDirty: true }
                  )
                }
                onDragStart={(n, e) =>
                  onDragStart(e, { kind: "skill", name: n, from: "req" })
                }
                onDrop={(e) => onDropSkills(e, "req")}
              />
              <SkillBin
                title="Deseable"
                items={niceSkills}
                placeholder="Sin elementos"
                onRemove={(n) =>
                  setValue(
                    "niceSkills",
                    niceSkills.filter((x) => x !== n),
                    { shouldDirty: true }
                  )
                }
                onDragStart={(n, e) =>
                  onDragStart(e, { kind: "skill", name: n, from: "nice" })
                }
                onDrop={(e) => onDropSkills(e, "nice")}
              />
            </div>
          </div>

          <div className="grid gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <label className="text-sm font-medium">
              Certificaciones (opcional)
            </label>

            <div className="relative">
              <input
                className="w-full rounded-md border border-zinc-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 md:p-4 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Busca y selecciona (ej. AWS SAA, CCNA...)"
                value={certQuery}
                onChange={(e) => setCertQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === "Tab") && certQuery.trim()) {
                    e.preventDefault();
                    addCert(filteredCerts[0] || certQuery.trim());
                  }
                }}
              />

              {certQuery && (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  {filteredCerts.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
                  ) : (
                    filteredCerts.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        onClick={() => addCert(c)}
                      >
                        {c}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {certs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {certs.map((c) => (
                  <span
                    key={c}
                    className="group inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100"
                  >
                    <span className="truncate">{c}</span>
                    <button
                      type="button"
                      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-emerald-700/60 opacity-60 group-hover:opacity-100"
                      onClick={() =>
                        setValue(
                          "certs",
                          certs.filter((x) => x !== c),
                          { shouldDirty: true }
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Opcional.</p>
            )}
          </div>
        </div>
      )}

      {tab === "langs" && (
        <div className="grid animate-fade-in-up gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-medium">
              Idiomas requeridos (opcional)
            </label>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-xs hover:bg-zinc-50 sm:w-auto dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() =>
                addLanguageRow({ name: "Inglés", level: "PROFESSIONAL" })
              }
            >
              + Añadir idioma
            </button>
          </div>

          {languageFields.length === 0 && (
            <p className="text-xs text-zinc-500">
              Añade uno o más idiomas relevantes (ej. Inglés profesional).
            </p>
          )}

          <div className="grid gap-3">
            {languageFields.map((field, idx) => (
              <div
                key={field.id}
                className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] sm:items-center"
              >
                <select
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                  {...register(`languages.${idx}.name` as const)}
                >
                  {LANGUAGES_FALLBACK.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>

                <select
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                  {...register(`languages.${idx}.level` as const)}
                >
                  <option value="NATIVE">Nativo</option>
                  <option value="PROFESSIONAL">Profesional (C1-C2)</option>
                  <option value="CONVERSATIONAL">Conversacional (B1-B2)</option>
                  <option value="BASIC">Básico (A1-A2)</option>
                </select>

                <button
                  type="button"
                  aria-label="Remove"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-emerald-700/60 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700"
                  onClick={() => removeLanguageRow(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "edu" && (
        <div className="grid animate-fade-in-up gap-6">
          <div className="grid min-w-0 gap-4 md:gap-6 md:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <label className="text-sm font-medium">Nivel mínimo</label>
              <select
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                {...register("minDegree")}
              >
                <option value="">Sin especificar</option>
                {DEGREE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {!watch("minDegree") && (
                <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                  No es obligatorio, pero especificar un nivel mínimo ayuda a
                  filtrar mejor candidatos.
                </p>
              )}
            </div>

            <div className="grid min-w-0 gap-2">
              <label className="text-sm font-medium">
                Agregar Educación (programa / carrera)
              </label>

              <div className="relative" ref={educationDropdownRef}>
                <input
                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Ej. Ingeniería en Sistemas... (Enter agrega)"
                  value={educationQuery}
                  onChange={(e) => {
                    setEducationQuery(e.target.value);
                    setIsEducationOpen(!!e.target.value.trim());
                  }}
                  onFocus={() => {
                    if (educationQuery.trim()) setIsEducationOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === "Tab") &&
                      educationQuery.trim()
                    ) {
                      e.preventDefault();
                      addEdu(educationQuery.trim(), "req");
                    }
                  }}
                />

                {isEducationOpen && educationQuery && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                      onClick={() => addEdu(educationQuery.trim(), "req")}
                    >
                      {`Agregar "${educationQuery.trim()}"`}
                    </button>

                    {filteredEducation.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        onClick={() => addEdu(s, "req")}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            <SkillBin
              title="Obligatoria"
              items={eduRequired}
              placeholder="Sin elementos"
              onRemove={(n) =>
                setValue(
                  "eduRequired",
                  eduRequired.filter((x) => x !== n),
                  { shouldDirty: true }
                )
              }
              onDragStart={(n, e) =>
                onDragStart(e, { kind: "edu", name: n, from: "req" })
              }
              onDrop={(e) => onDropEdu(e, "req")}
            />
            <SkillBin
              title="Deseable"
              items={eduNice}
              placeholder="Sin elementos"
              onRemove={(n) =>
                setValue(
                  "eduNice",
                  eduNice.filter((x) => x !== n),
                  { shouldDirty: true }
                )
              }
              onDragStart={(n, e) =>
                onDragStart(e, { kind: "edu", name: n, from: "nice" })
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

      {!hasSkills && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          Aún no has agregado skills. No es obligatorio, pero sí recomendable para mejorar el filtrado y el match con candidatos.
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:justify-between dark:border-zinc-800">
        <button
          type="button"
          className="w-full rounded-md border border-zinc-300 px-6 py-2.5 text-sm font-medium transition hover:bg-zinc-50 sm:w-auto dark:border-zinc-700 dark:hover:bg-zinc-800"
          onClick={() => {
            setShowMissingSkillsModal(false);
            onBack();
          }}
        >
          Atrás
        </button>

        <button
          type="button"
          disabled={!canNext}
          className={clsx(
            "w-full rounded-md px-6 py-2.5 text-sm font-medium text-white transition sm:w-auto",
            canNext
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "cursor-not-allowed bg-emerald-300"
          )}
          onClick={handleNextWithWarnings}
        >
          Siguiente
        </button>
      </div>

      <WizardWarningModal
        open={showMissingSkillsModal}
        title="Continuar sin skills"
        description="Aún no has agregado skills. Esto puede reducir el filtrado y el match con candidatos."
        items={["Sin skills requeridas", "Menor precisión en el match"]}
        confirmLabel="Continuar de todos modos"
        cancelLabel="Volver"
        onCancel={() => setShowMissingSkillsModal(false)}
        onConfirm={() => {
          setShowMissingSkillsModal(false);
          onNext();
        }}
      />
    </div>
  );
}