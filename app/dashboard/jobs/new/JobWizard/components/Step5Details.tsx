// app/dashboard/jobs/new/JobWizard/components/Step5Details.tsx
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Controller, useFormContext, useFieldArray } from "react-hook-form";
import { X, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { JobForm } from "../types";
import { EDUCATION_SUGGESTIONS } from "../constants";
import { sanitizeHtml, htmlToPlain } from "../utils/helpers";
import { createStringFuse, searchStrings } from "@/lib/search/fuse";
import { LANGUAGES_FALLBACK } from "@/lib/shared/skills-data";
import JobRichTextEditor from "@/components/jobs/JobRichTextEditor";
import SkillBin from "./SkillBin";

type Tab = "desc" | "skills" | "langs" | "edu";

type Props = {
  skillsOptions: string[];
  certOptions: string[];
  onNext: () => void;
  onBack: () => void;
};

export default function Step5Details({
  skillsOptions,
  certOptions,
  onNext,
  onBack,
}: Props) {
  const { watch, setValue, register, control, formState: { errors } } =
    useFormContext<JobForm>();

  const [tab, setTab] = useState<Tab>("desc");
  const [skillQuery, setSkillQuery] = useState("");
  const [certQuery, setCertQuery] = useState("");
  const [educationQuery, setEducationQuery] = useState("");
  const [isEducationOpen, setIsEducationOpen] = useState(false);
  const educationDropdownRef = useRef<HTMLDivElement | null>(null);

  const { fields: languageFields, append: addLanguageRow, remove: removeLanguageRow } =
    useFieldArray({ control, name: "languages" });

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

  // Fuse search
  const skillsFuse = useMemo(() => createStringFuse(skillsOptions || []), [skillsOptions]);
  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim();
    if (!q) return (skillsOptions || []).slice(0, 30);
    return searchStrings(skillsFuse, q, 50);
  }, [skillQuery, skillsOptions, skillsFuse]);

  const educationFuse = useMemo(() => createStringFuse(EDUCATION_SUGGESTIONS), []);
  const filteredEducation = useMemo(() => {
    const q = educationQuery.trim();
    if (!q) return EDUCATION_SUGGESTIONS.slice(0, 30);
    return searchStrings(educationFuse, q, 50);
  }, [educationQuery, educationFuse]);

  const certsFuse = useMemo(() => createStringFuse(certOptions || []), [certOptions]);
  const filteredCerts = useMemo(() => {
    const q = certQuery.trim();
    if (!q) return (certOptions || []).slice(0, 30);
    return searchStrings(certsFuse, q, 50);
  }, [certQuery, certsFuse, certOptions]);

  // Cerrar dropdown educación al click fuera
  useEffect(() => {
    function handlePointerDown(e: PointerEvent | MouseEvent) {
      const target = e.target as Node | null;
      if (!educationDropdownRef.current || !target || educationDropdownRef.current.contains(target)) return;
      setIsEducationOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsEducationOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Helpers
  function addSkill(name: string, to: "req" | "nice" = "req") {
    const n = name.trim();
    if (!n || requiredSkills.includes(n) || niceSkills.includes(n)) return;
    if (to === "req") setValue("requiredSkills", [...requiredSkills, n], { shouldDirty: true });
    else setValue("niceSkills", [...niceSkills, n], { shouldDirty: true });
    setSkillQuery("");
  }

  function addEdu(name: string, to: "req" | "nice" = "req") {
    const n = name.trim();
    if (!n || eduRequired.includes(n) || eduNice.includes(n)) return;
    if (to === "req") setValue("eduRequired", [...eduRequired, n], { shouldDirty: true });
    else setValue("eduNice", [...eduNice, n], { shouldDirty: true });
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

  function onDropSkills(e: React.DragEvent<HTMLDivElement>, to: "req" | "nice") {
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const payload = JSON.parse(data) as { kind: "skill" | "edu"; name: string; from: "req" | "nice" };
    if (payload.kind !== "skill" || payload.from === to) return;
    if (to === "req") {
      if (!requiredSkills.includes(payload.name)) setValue("requiredSkills", [...requiredSkills, payload.name], { shouldDirty: true });
      setValue("niceSkills", niceSkills.filter((n) => n !== payload.name), { shouldDirty: true });
    } else {
      if (!niceSkills.includes(payload.name)) setValue("niceSkills", [...niceSkills, payload.name], { shouldDirty: true });
      setValue("requiredSkills", requiredSkills.filter((n) => n !== payload.name), { shouldDirty: true });
    }
  }

  function onDropEdu(e: React.DragEvent<HTMLDivElement>, to: "req" | "nice") {
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const payload = JSON.parse(data) as { kind: "skill" | "edu"; name: string; from: "req" | "nice" };
    if (payload.kind !== "edu" || payload.from === to) return;
    if (to === "req") {
      if (!eduRequired.includes(payload.name)) setValue("eduRequired", [...eduRequired, payload.name], { shouldDirty: true });
      setValue("eduNice", eduNice.filter((n) => n !== payload.name), { shouldDirty: true });
    } else {
      if (!eduNice.includes(payload.name)) setValue("eduNice", [...eduNice, payload.name], { shouldDirty: true });
      setValue("eduRequired", eduRequired.filter((n) => n !== payload.name), { shouldDirty: true });
    }
  }

  const tabItems = [
    { k: "desc" as Tab, lbl: "Descripción", done: descLength > 0 },
    { k: "skills" as Tab, lbl: "Skills / Certs", done: requiredSkills.length + niceSkills.length + certs.length > 0 },
    { k: "langs" as Tab, lbl: "Idiomas", done: languageFields.length > 0 },
    { k: "edu" as Tab, lbl: "Educación", done: eduRequired.length + eduNice.length > 0 },
  ];

  return (
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
            aria-selected={tab === t.k}
            className={clsx(
              "flex items-center gap-2 rounded-lg h-9 px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
              tab === t.k
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            )}
            onClick={() => setTab(t.k)}
          >
            <span>{t.lbl}</span>
            {t.done ? (
              <CheckCircle2 className={clsx("h-3.5 w-3.5", tab === t.k ? "text-white/90" : "text-emerald-500")} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            )}
          </button>
        ))}
      </div>

      {/* Tab: Descripción */}
      {tab === "desc" && (
        <div className="animate-fade-in-up grid gap-4 mt-4">
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
                <div className="relative [&_.job-editor]:min-h-[260px] md:[&_.job-editor]:min-h-[320px] [&_.job-editor+div]:hidden [&_.job-editor~div]:hidden">
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
                    <div className="pointer-events-none absolute left-4 right-4 top-12 text-xs text-zinc-400 dark:text-zinc-500 whitespace-pre-line">
                      Ejemplo:{"\n"}- Responsabilidades principales{"\n"}- Requisitos clave y tecnologías{"\n"}- Beneficios y cultura del equipo
                    </div>
                  )}
                </div>
              );
            }}
          />
          <div className={clsx("text-xs", canNext ? "text-emerald-600" : "text-red-500")}>
            chars: {descLength}/500&nbsp;&nbsp;palabras: {wordCount}/80
          </div>
          {errors.descriptionPlain && (
            <p className="text-xs text-red-600">{errors.descriptionPlain.message}</p>
          )}
        </div>
      )}

      {/* Tab: Skills / Certs */}
      {tab === "skills" && (
        <div className="animate-fade-in-up grid gap-6">
          <div className="grid gap-3">
            <label className="text-sm font-medium">Skills / Certs</label>
            <div className="relative">
              <input
                className="w-full rounded-md border border-zinc-300 bg-white p-4 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Busca (ej. Python, AWS, React Native...) y presiona Enter"
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === "Tab") && skillQuery.trim()) {
                    e.preventDefault();
                    addSkill(filteredSkills[0] || skillQuery.trim(), "req");
                  }
                }}
              />
              {skillQuery && (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                  {filteredSkills.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
                  ) : (
                    filteredSkills.map((s) => (
                      <button key={s} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60" onClick={() => addSkill(s, "req")}>
                        {s}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <SkillBin title="Obligatoria" items={requiredSkills} placeholder="Arrastra aquí"
                onRemove={(n) => setValue("requiredSkills", requiredSkills.filter((x) => x !== n), { shouldDirty: true })}
                onDragStart={(n, e) => onDragStart(e, { kind: "skill", name: n, from: "req" })}
                onDrop={(e) => onDropSkills(e, "req")}
              />
              <SkillBin title="Deseable" items={niceSkills} placeholder="Sin elementos"
                onRemove={(n) => setValue("niceSkills", niceSkills.filter((x) => x !== n), { shouldDirty: true })}
                onDragStart={(n, e) => onDragStart(e, { kind: "skill", name: n, from: "nice" })}
                onDrop={(e) => onDropSkills(e, "nice")}
              />
            </div>
          </div>

          {/* Certificaciones */}
          <div className="grid gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <label className="text-sm font-medium">Certificaciones (opcional)</label>
            <div className="relative">
              <input
                className="w-full rounded-md border border-zinc-300 bg-white p-4 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                  {filteredCerts.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
                  ) : (
                    filteredCerts.map((c) => (
                      <button key={c} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60" onClick={() => addCert(c)}>
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
                  <span key={c} className="group inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100">
                    {c}
                    <button type="button" className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-emerald-700/60 opacity-60 group-hover:opacity-100" onClick={() => setValue("certs", certs.filter((x) => x !== c), { shouldDirty: true })}>
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

      {/* Tab: Idiomas */}
      {tab === "langs" && (
        <div className="animate-fade-in-up grid gap-6">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Idiomas requeridos (opcional)</label>
            <button
              type="button"
              className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => addLanguageRow({ name: "Inglés", level: "PROFESSIONAL" })}
            >
              + Añadir idioma
            </button>
          </div>
          {languageFields.length === 0 && (
            <p className="text-xs text-zinc-500">Añade uno o más idiomas relevantes (ej. Inglés profesional).</p>
          )}
          <div className="grid gap-2">
            {languageFields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] gap-2 items-center">
                <select className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900" {...register(`languages.${idx}.name` as const)}>
                  {LANGUAGES_FALLBACK.map((lang) => (<option key={lang} value={lang}>{lang}</option>))}
                </select>
                <select className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900" {...register(`languages.${idx}.level` as const)}>
                  <option value="NATIVE">Nativo</option>
                  <option value="PROFESSIONAL">Profesional (C1-C2)</option>
                  <option value="CONVERSATIONAL">Conversacional (B1-B2)</option>
                  <option value="BASIC">Básico (A1-A2)</option>
                </select>
                <button type="button" aria-label="Remove" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 text-emerald-700/60 transition hover:text-emerald-700 hover:border-emerald-300 dark:border-zinc-700" onClick={() => removeLanguageRow(idx)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Educación */}
      {tab === "edu" && (
        <div className="animate-fade-in-up grid gap-6">
          <div className="grid md:grid-cols-2 gap-6 min-w-0">
            <div className="grid gap-2 min-w-0">
              <label className="text-sm font-medium">Nivel mínimo</label>
              <select className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900" {...register("minDegree")}>
                <option value="HIGHSCHOOL">Bachillerato</option>
                <option value="TECH">Técnico</option>
                <option value="BACHELOR">Licenciatura / Ingeniería</option>
                <option value="MASTER">Maestría</option>
                <option value="PHD">Doctorado</option>
              </select>
            </div>
            <div className="grid gap-2 min-w-0">
              <label className="text-sm font-medium">Agregar Educación (programa / carrera)</label>
              <div className="relative" ref={educationDropdownRef}>
                <input
                  className="w-full min-w-0 h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Ej. Ingeniería en Sistemas... (Enter agrega)"
                  value={educationQuery}
                  onChange={(e) => { setEducationQuery(e.target.value); setIsEducationOpen(!!e.target.value.trim()); }}
                  onFocus={() => { if (educationQuery.trim()) setIsEducationOpen(true); }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === "Tab") && educationQuery.trim()) {
                      e.preventDefault();
                      addEdu(educationQuery.trim(), "req");
                    }
                  }}
                />
                {isEducationOpen && educationQuery && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                    <button type="button" className="block w-full px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20" onClick={() => addEdu(educationQuery.trim(), "req")}>
                      {`Agregar "${educationQuery.trim()}"`}
                    </button>
                    {filteredEducation.map((s) => (
                      <button key={s} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60" onClick={() => addEdu(s, "req")}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <SkillBin title="Obligatoria" items={eduRequired} placeholder="Sin elementos"
              onRemove={(n) => setValue("eduRequired", eduRequired.filter((x) => x !== n), { shouldDirty: true })}
              onDragStart={(n, e) => onDragStart(e, { kind: "edu", name: n, from: "req" })}
              onDrop={(e) => onDropEdu(e, "req")}
            />
            <SkillBin title="Deseable" items={eduNice} placeholder="Sin elementos"
              onRemove={(n) => setValue("eduNice", eduNice.filter((x) => x !== n), { shouldDirty: true })}
              onDragStart={(n, e) => onDragStart(e, { kind: "edu", name: n, from: "nice" })}
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

      {/* Navegación */}
      <div className="flex justify-between gap-4 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          onClick={onBack}
        >
          Atrás
        </button>
        <button
          type="button"
          disabled={!canNext}
          className={clsx(
            "rounded-md px-6 py-2.5 text-sm font-medium text-white transition",
            canNext ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-300 cursor-not-allowed"
          )}
          onClick={onNext}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}