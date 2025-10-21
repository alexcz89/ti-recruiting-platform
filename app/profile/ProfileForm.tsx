// app/profile/ProfileForm.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, useWatch, useFieldArray, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { PhoneNumberUtil } from "google-libphonenumber";
import { toastPromise } from "@/lib/ui/toast";
import UploadCvButton from "@/components/upload/UploadCvButton";
import WorkExperienceCard, { WorkExperience, WorkExperienceErrors } from "@/components/WorkExperienceCard";
import { LANGUAGE_LEVELS } from "@/lib/skills";

// ✅ Schema y tipos del perfil
import {
  ProfileFormSchema,
  type ProfileFormData,
} from "@/lib/schemas/profile";

/** ===== Tipos ===== */
type Initial = {
  firstName: string;
  lastName1: string;
  lastName2: string;
  email: string;
  phoneCountry: string;
  phoneLocal: string;
  location: string;
  birthdate: string;
  linkedin: string;
  github: string;
  resumeUrl: string;
  certifications?: string[];
  experiences?: Array<WorkExperience>;
  languages?: Array<{ termId: string; label: string; level: "NATIVE"|"PROFESSIONAL"|"CONVERSATIONAL"|"BASIC" }>;
  skillsDetailed?: Array<{ termId: string; label: string; level: 1|2|3|4|5 }>;

  /** 🔹 Escolaridad (solo lista; SIN highestEducationLevel) */
  education?: EducationEntry[];
};

type LanguageOption = { id: string; label: string };
type SkillOption    = { id: string; label: string };

type EducationLevel =
  | "NONE" | "PRIMARY" | "SECONDARY" | "HIGH_SCHOOL"
  | "TECHNICAL" | "BACHELOR" | "MASTER" | "DOCTORATE" | "OTHER";

type EducationStatus = "ONGOING" | "COMPLETED" | "INCOMPLETE";

const EDUCATION_LEVEL_OPTIONS = [
  { value: "HIGH_SCHOOL" as const, label: "Preparatoria / Bachillerato" },
  { value: "TECHNICAL" as const,   label: "Técnico / TSU" },
  { value: "BACHELOR" as const,    label: "Licenciatura / Ingeniería" },
  { value: "MASTER" as const,      label: "Maestría" },
  { value: "DOCTORATE" as const,   label: "Doctorado" },
  { value: "OTHER" as const,       label: "Diplomado / Curso" },
];

type EducationEntry = {
  id?: string;
  level: EducationLevel | null;
  /** No se edita en UI; se deriva al guardar */
  status: EducationStatus;
  institution: string;
  program?: string | null;
  startDate?: string | null; // YYYY-MM
  endDate?: string | null;   // YYYY-MM (null si ONGOING)
  sortIndex: number;
};

const SKILL_LEVELS = [
  { value: 1 as const, label: "Básico" },
  { value: 2 as const, label: "Junior" },
  { value: 3 as const, label: "Intermedio" },
  { value: 4 as const, label: "Avanzado" },
  { value: 5 as const, label: "Experto" },
];

const phoneUtil = PhoneNumberUtil.getInstance();
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
function buildE164(countryDial: string, localRaw: string): string | null {
  const localDigits = onlyDigits(localRaw);
  if (!localDigits) return null;
  const full = `+${countryDial}${localDigits}`;
  try {
    const parsed = phoneUtil.parse(full);
    if (!phoneUtil.isValidNumber(parsed)) return null;
    const region = phoneUtil.getRegionCodeForNumber(parsed);
    const cc = phoneUtil.getCountryCodeForRegion(region);
    const nsn = phoneUtil.getNationalSignificantNumber(parsed);
    return `+${cc}${nsn}`;
  } catch {
    return null;
  }
}

function buildCountryOptions() {
  const regions = Array.from(phoneUtil.getSupportedRegions());
  const mapped = regions.map((iso) => {
    const dial = String(phoneUtil.getCountryCodeForRegion(iso));
    return { code: iso, dial, label: `${iso} (+${dial})` };
  });
  const mx = mapped.find((c) => c.code === "MX");
  const rest = mapped.filter((c) => c.code !== "MX").sort((a, b) => a.code.localeCompare(b.code));
  return mx ? [mx, ...rest] : rest;
}
const COUNTRY_OPTIONS = buildCountryOptions();

// ——— Helpers fechas
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const toMonthStartDate = (ym: string): Date | null => {
  if (!MONTH_RE.test(ym)) return null;
  return new Date(`${ym}-01T00:00:00.000Z`);
};
const ymToISO = (ym?: string | null) => (ym && MONTH_RE.test(ym) ? `${ym}-01` : "");

/* ========= Helpers ubicación ========= */
function stripDiacritics(s: string) {
  return (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  "mexico": "mx", "méxico": "mx",
  "estados unidos": "us", "eeuu": "us", "eua": "us", "usa": "us",
  "canada": "ca", "canadá": "ca",
  "argentina": "ar", "bolivia": "bo", "brasil": "br", "chile": "cl", "colombia": "co",
  "costa rica": "cr", "cuba": "cu", "republica dominicana": "do", "república dominicana": "do",
  "ecuador": "ec", "el salvador": "sv", "guatemala": "gt", "honduras": "hn",
  "haiti": "ht", "haití": "ht", "jamaica": "jm", "nicaragua": "ni", "panama": "pa", "panamá": "pa",
  "paraguay": "py", "peru": "pe", "perú": "pe", "puerto rico": "pr",
  "uruguay": "uy", "venezuela": "ve", "bahamas": "bs", "barbados": "bb", "trinidad y tobago": "tt",
  "guyana": "gy", "surinam": "sr", "belice": "bz",
  "united states": "us", "united states of america": "us",
  "brazil": "br",
};
function deriveLocationParts(label: string): { city?: string; admin1?: string; countryLabel?: string; countryCode?: string } {
  const parts = (label || "").split(",").map(p => p.trim()).filter(Boolean);
  const city = parts[0];
  const admin1 = parts.length >= 3 ? parts[parts.length - 2] : parts.length >= 2 ? parts[1] : undefined;
  const countryLabel = parts.length ? parts[parts.length - 1] : undefined;
  let countryCode: string | undefined = undefined;
  if (countryLabel) {
    const key = stripDiacritics(countryLabel);
    countryCode = COUNTRY_NAME_TO_ISO2[key];
  }
  return { city, admin1, countryLabel, countryCode };
}
/* =============================== FIN helpers =============================== */

export default function ProfileForm({
  initial,
  certOptions,
  languageOptions,
  skillTermOptions,
  onSubmit,
}: {
  initial: Initial;
  certOptions: string[];
  languageOptions: LanguageOption[];
  skillTermOptions: SkillOption[];
  onSubmit: (fd: FormData) => Promise<any>;
}) {
  const methods = useForm<ProfileFormData>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      firstName: initial.firstName ?? "",
      lastName1: initial.lastName1 ?? "",
      lastName2: initial.lastName2 ?? "",
      location: initial.location ?? "",
      birthdate: initial.birthdate ?? "",
      linkedin: initial.linkedin ?? "",
      github: initial.github ?? "",
      phoneCountry: initial.phoneCountry || "52",
      phoneLocal: initial.phoneLocal || "",
      certifications: initial.certifications ?? [],
      experiences: (initial.experiences ?? []).map((e) => ({
        ...e,
        startDate: (e.startDate || "").slice(0, 7),
        endDate: e.endDate ? e.endDate.slice(0, 7) : null,
        isCurrent: !!e.isCurrent,
      })),
      languages: (initial.languages ?? []).map((l) => ({ termId: l.termId, label: l.label, level: l.level })),
      skillsDetailed: (initial.skillsDetailed ?? []).map((s) => ({ termId: s.termId, label: s.label, level: s.level })),
      // 🔹 Escolaridad: UI sin estado; lo derivamos al guardar
      education: (initial.education ?? []).map((ed, i) => ({
        id: ed.id,
        level: ed.level ?? null,
        status: "COMPLETED",
        institution: ed.institution ?? "",
        program: ed.program ?? "",
        startDate: (ed.startDate || "")?.slice(0, 7) || "",
        endDate: (ed.endDate || "")?.slice(0, 7) || "",
        sortIndex: ed.sortIndex ?? i,
      })),
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
    control,
    reset,
  } = methods;

  // ⚠️ Aviso si hay cambios sin guardar (navegación/recarga)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (methods.formState.isDirty && !methods.formState.isSubmitting) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [methods.formState.isDirty, methods.formState.isSubmitting]);

  useEffect(() => {
    reset({
      firstName: initial.firstName ?? "",
      lastName1: initial.lastName1 ?? "",
      lastName2: initial.lastName2 ?? "",
      location: initial.location ?? "",
      birthdate: initial.birthdate ?? "",
      linkedin: initial.linkedin ?? "",
      github: initial.github ?? "",
      phoneCountry: initial.phoneCountry || "52",
      phoneLocal: initial.phoneLocal || "",
      certifications: initial.certifications ?? [],
      experiences: (initial.experiences ?? []).map((e) => ({
        ...e,
        startDate: (e.startDate || "").slice(0, 7),
        endDate: e.endDate ? e.endDate.slice(0, 7) : null,
        isCurrent: !!e.isCurrent,
      })),
      languages: (initial.languages ?? []).map((l) => ({ termId: l.termId, label: l.label, level: l.level })),
      skillsDetailed: (initial.skillsDetailed ?? []).map((s) => ({ termId: s.termId, label: s.label, level: s.level })),
      education: (initial.education ?? []).map((ed, i) => ({
        id: ed.id,
        level: ed.level ?? null,
        status: "COMPLETED",
        institution: ed.institution ?? "",
        program: ed.program ?? "",
        startDate: (ed.startDate || "")?.slice(0, 7) || "",
        endDate: (ed.endDate || "")?.slice(0, 7) || "",
        sortIndex: ed.sortIndex ?? i,
      })),
    });
  }, [initial, reset]);

  // Field arrays
  const expFA   = useFieldArray({ control, name: "experiences" });
  const langFA  = useFieldArray({ control, name: "languages" });
  const skillFA = useFieldArray({ control, name: "skillsDetailed" });
  const eduFA   = useFieldArray({ control, name: "education" });

  const experiences    = useWatch({ control, name: "experiences" }) || [];
  const languages      = useWatch({ control, name: "languages" }) || [];
  const skillsDetailed = useWatch({ control, name: "skillsDetailed" }) || [];
  const certifications = useWatch({ control, name: "certifications" }) || [];
  const educationRows  = useWatch({ control, name: "education" }) || [];

  // ===== Certificaciones =====
  const [certQuery, setCertQuery] = useState("");
  const filteredCerts = useMemo(() => {
    const q = certQuery.trim().toLowerCase();
    const chosen = new Set((certifications as string[]).map((c) => c.toLowerCase()));
    const base = q ? certOptions.filter(c => c.toLowerCase().includes(q)) : certOptions;
    return base.filter(c => !chosen.has(c.toLowerCase())).slice(0, 30);
  }, [certQuery, certOptions, certifications]);

  const addCert = (label: string) => {
    const v = (label || "").trim();
    if (!v) return;
    const exists = (certifications as string[]).some((x) => x.toLowerCase() === v.toLowerCase());
    if (exists) return;
    setValue("certifications", [...(certifications as string[]), v], { shouldValidate: true, shouldDirty: true });
    setCertQuery("");
  };
  const removeCert = (label: string) => {
    setValue(
      "certifications",
      (certifications as string[]).filter((x) => x.toLowerCase() !== label.toLowerCase()),
      { shouldValidate: true, shouldDirty: true }
    );
  };

  // ===== Teléfono / ubicación =====
  const phoneCountry = useWatch({ control, name: "phoneCountry" });
  const isMX = phoneCountry === "52";

  // ====== EXPERIENCIAS ======
  const handlePatchExp = useCallback((idx: number, patch: Partial<WorkExperience>) => {
    const curr = (experiences[idx] || {}) as WorkExperience;
    expFA.update(idx, { ...curr, ...patch });
  }, [experiences, expFA]);

  const handleMakeCurrent = useCallback((idx: number, checked: boolean) => {
    const next = (experiences as WorkExperience[]).map((e, i) => ({
      ...e,
      isCurrent: i === idx ? checked : false,
      endDate: i === idx && checked ? null : e.endDate ?? "",
    }));
    next.forEach((row, i) => expFA.update(i, row));
  }, [experiences, expFA]);

  // ====== IDIOMAS ======
  const handlePatchLang = useCallback((idx: number, patch: Partial<{ termId: string; label: string; level: any }>) => {
    const curr = (languages[idx] || { termId: "", label: "", level: "CONVERSATIONAL" });
    langFA.update(idx, { ...curr, ...patch });
  }, [languages, langFA]);

  // ====== SKILLS ======
  const [skillQuery, setSkillQuery] = useState("");
  const [pendingLevel, setPendingLevel] = useState<number>(3);

  const filteredSkillOptions = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    const addedIds = new Set((skillsDetailed as any[]).map((s) => s.termId));
    return (q ? skillTermOptions.filter(o => o.label.toLowerCase().includes(q)) : skillTermOptions)
      .filter(o => !addedIds.has(o.id))
      .slice(0, 20);
  }, [skillQuery, skillTermOptions, skillsDetailed]);

  function addSkillWithLevel(opt: SkillOption) {
    if ((skillsDetailed as any[]).some((s) => s.termId === opt.id)) return;
    skillFA.append({ termId: opt.id, label: opt.label, level: pendingLevel });
    setSkillQuery("");
  }
  function removeSkillWithLevel(termId: string) {
    const idx = (skillsDetailed as any[]).findIndex((s) => s.termId === termId);
    if (idx >= 0) skillFA.remove(idx);
  }

  // ====== EDUCACIÓN ======
  const addEducation = () => {
    eduFA.append({
      level: null,
      status: "COMPLETED", // no se muestra; se recalcula al guardar
      institution: "",
      program: "",
      startDate: "",
      endDate: "",
      sortIndex: educationRows.length,
    });
  };

  const moveEducation = (from: number, to: number) => {
    if (to < 0 || to >= educationRows.length) return;
    eduFA.move(from, to);
    const next = (educationRows as EducationEntry[]).map((r, i) => ({ ...r, sortIndex: i }));
    next.forEach((row, i) => eduFA.update(i, row));
  };

  // ====== Submit ======
  const MONTH_OVERLAPS = (rows: Array<{ startDate: string; endDate?: string | null }>) => {
    const ranges = rows
      .map((r) => {
        const s = toMonthStartDate(r.startDate);
        const e = r.endDate ? toMonthStartDate(r.endDate) : null;
        return { s, e };
      })
      .filter(({ s }) => !!s)
      .sort((a, b) => a.s!.getTime() - b.s!.getTime());
    for (let i = 0; i < ranges.length - 1; i++) {
      const a = ranges[i];
      const b = ranges[i + 1];
      const aEnd = a.e ? a.e.getTime() : Infinity;
      if (aEnd > b.s!.getTime()) return true;
    }
    return false;
  };

  const onSubmitRHF = async (vals: ProfileFormData) => {
    clearErrors("root");

    // Tel
    let phoneE164: string | null = null;
    if ((vals.phoneLocal || "").trim()) {
      phoneE164 = buildE164(vals.phoneCountry || "52", vals.phoneLocal || "");
      if (!phoneE164) {
        setError("root", { type: "manual", message: "Número de teléfono inválido." });
        return;
      }
    }

    // Experiencias
    const exps = vals.experiences || [];
    const currentCount = exps.filter((e) => e.isCurrent).length;
    if (currentCount > 1) {
      setError("root", { type: "manual", message: "Solo puedes marcar una experiencia como 'Actual'." });
      return;
    }
    if (MONTH_OVERLAPS(
      exps.map((e) => ({ startDate: e.startDate, endDate: e.isCurrent ? null : e.endDate || null }))
    )) {
      setError("root", { type: "manual", message: "Tus experiencias no pueden traslaparse." });
      return;
    }

    // Ubicación
    const { city, admin1, countryCode } = deriveLocationParts(vals.location || "");
    const cityNorm   = stripDiacritics(city || "");
    const admin1Norm = stripDiacritics(admin1 || "");

    // Educación (normaliza fechas y DERIVA status por endDate)
    const edu = (vals.education || []).map((row, i) => {
      const startISO = ymToISO(row.startDate);
      const endISO   = ymToISO(row.endDate);
      const status: EducationStatus = endISO ? "COMPLETED" : "ONGOING";
      return {
        id: row.id,
        level: row.level,
        status,
        institution: row.institution,
        program: (row.program || "") || null,
        startDate: startISO || "",
        endDate: status === "ONGOING" ? null : endISO,
        sortIndex: i,
      };
    });

    // Build FormData
    const fd = new FormData();
    fd.set("firstName", vals.firstName ?? "");
    fd.set("lastName1", vals.lastName1 ?? "");
    fd.set("lastName2", vals.lastName2 ?? "");
    fd.set("location", vals.location ?? "");
    fd.set("birthdate", vals.birthdate ?? "");
    fd.set("linkedin", vals.linkedin ?? "");
    fd.set("github", vals.github ?? "");
    fd.set("phone", phoneE164 || "");
    fd.set("phoneCountry", vals.phoneCountry || "52");
    fd.set("phoneLocal", (vals.phoneLocal || "").replace(/\D+/g, ""));
    fd.set("certifications", (vals.certifications || []).join(", "));
    fd.set("experiences", JSON.stringify(exps));
    fd.set("languages", JSON.stringify(vals.languages || []));
    fd.set("skillsDetailed", JSON.stringify(vals.skillsDetailed || []));
    if (initial.resumeUrl) fd.set("resumeUrl", initial.resumeUrl);

    // 🔹 Escolaridad: mandamos en 3 claves por compatibilidad
    const eduPayload = JSON.stringify(edu);
    fd.set("education", eduPayload);
    fd.set("educations", eduPayload);
    fd.set("educationJson", eduPayload);

    // Ubicación desglosada
    if (countryCode) fd.set("countryCode", countryCode);
    if (admin1)      fd.set("admin1", admin1);
    if (city)        fd.set("city", city);
    if (cityNorm)    fd.set("cityNorm", cityNorm);
    if (admin1Norm)  fd.set("admin1Norm", admin1Norm);

    try {
      await toastPromise(onSubmit(fd), {
        loading: "Guardando cambios…",
        success: "Perfil actualizado",
        error: (e) => e?.message || "No se pudo actualizar el perfil",
      });
    } catch (e: any) {
      setError("root", { type: "server", message: e?.message || "Error desconocido" });
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmitRHF)} className="space-y-8" encType="multipart/form-data">
        {/* Datos personales */}
        <section id="personal" className="grid md:grid-cols-3 gap-4 scroll-mt-24">
          <div>
            <label className="text-sm">Nombre(s) *</label>
            <input className="border rounded-xl p-3 w-full" {...register("firstName")} />
            {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="text-sm">Apellido paterno *</label>
            <input className="border rounded-xl p-3 w-full" {...register("lastName1")} />
            {errors.lastName1 && <p className="text-xs text-red-600">{errors.lastName1.message}</p>}
          </div>
          <div>
            <label className="text-sm">Apellido materno</label>
            <input className="border rounded-xl p-3 w-full" {...register("lastName2")} />
          </div>
        </section>

        {/* Teléfono + ubicación */}
        <section id="contacto" className="grid md:grid-cols-2 gap-4 scroll-mt-24">
          <div>
            <label className="text-sm">Teléfono</label>
            <div className="flex gap-2">
              <select className="border rounded-xl p-3 w-40" {...register("phoneCountry")}>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={`${c.code}-${c.dial}`} value={c.dial}>{c.label}</option>
                ))}
              </select>
              <input
                type="tel"
                className="border rounded-xl p-3 flex-1"
                placeholder={isMX ? "10 dígitos (solo números)" : "solo números"}
                {...register("phoneLocal", {
                  onChange: (e) => { e.target.value = String(e.target.value).replace(/\D+/g, "").slice(0, 15); },
                })}
                inputMode="numeric"
                autoComplete="tel-national"
              />
            </div>
          </div>

          <div>
            <label className="text-sm">Ubicación</label>
            <LocationAutocomplete
              value={useWatch({ control, name: "location" }) || ""}
              onChange={(v) => setValue("location", v, { shouldValidate: true })}
              countries={["mx"]}
              className="border rounded-xl p-3 w-full"
              fetchOnMount={false}
              openOnFocus={true}
              minChars={2}
              debounceMs={250}
              debug={true}
            />
          </div>
        </section>

        {/* Fecha + redes */}
        <section className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Fecha de nacimiento</label>
            <input type="date" className="border rounded-xl p-3 w-full" {...register("birthdate")} />
          </div>
          <div>
            <label className="text-sm">LinkedIn</label>
            <input className="border rounded-xl p-3 w-full" placeholder="https://www.linkedin.com/in/tu-perfil" {...register("linkedin")} />
            {errors.linkedin && <p className="text-xs text-red-600">{errors.linkedin.message}</p>}
          </div>
          <div>
            <label className="text-sm">GitHub</label>
            <input className="border rounded-xl p-3 w-full" placeholder="https://github.com/tu-usuario" {...register("github")} />
            {errors.github && <p className="text-xs text-red-600">{errors.github.message}</p>}
          </div>
        </section>

        {/* CV */}
        <section id="cv" className="grid gap-2 scroll-mt-24">
          <label className="text-sm">Currículum (PDF/DOC/DOCX)</label>
          <div className="flex flex-wrap items-center gap-3">
            <UploadCvButton onUploaded={(url) => setValue("resumeUrl" as any, url, { shouldDirty: true })} />
            {initial.resumeUrl ? (
              <a href={initial.resumeUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                Ver CV actual
              </a>
            ) : (
              <span className="text-xs text-zinc-500">Aún no has subido un CV.</span>
            )}
          </div>
        </section>

        {/* === Certificaciones === */}
        <section id="certs" className="space-y-2 scroll-mt-24">
          <label className="text-sm font-semibold">Certificaciones</label>

          {certifications.length ? (
            <div className="flex flex-wrap gap-2">
              {(certifications as string[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded-full px-2 py-1">
                  {c}
                  <button type="button" onClick={() => removeCert(c)} className="hover:text-red-600">×</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Aún no has agregado certificaciones.</p>
          )}

          <div className="relative">
            <input
              className="border rounded-xl p-3 w-full"
              placeholder="Ej. AWS SAA, CKA, ITIL Foundation…"
              value={certQuery}
              onChange={(e) => setCertQuery(e.target.value)}
            />
            {certQuery.trim().length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow max-h-60 overflow-auto">
                {filteredCerts.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-zinc-500">Sin coincidencias</li>
                ) : (
                  filteredCerts.map((opt) => (
                    <li
                      key={opt}
                      className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      onMouseDown={(e) => { e.preventDefault(); addCert(opt); }}
                    >
                      {opt}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </section>

        {/* === Skills con nivel === */}
        <section id="skills" className="space-y-3 scroll-mt-24">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Skills con nivel</label>
            <button
              type="button"
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() => {
                const first = (filteredSkillOptions[0] || null);
                if (first) addSkillWithLevel(first);
              }}
            >
              + Añadir skill
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                className="border rounded-xl p-3 w-full"
                placeholder="Ej. React, Node.js, AWS..."
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
              />
              {skillQuery.trim().length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow max-h-60 overflow-auto">
                  {filteredSkillOptions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-zinc-500">Sin coincidencias</li>
                  ) : filteredSkillOptions.map((opt) => (
                    <li
                      key={opt.id}
                      className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      onMouseDown={(e) => { e.preventDefault(); addSkillWithLevel(opt); }}
                    >
                      {opt.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <select
              className="border rounded-xl p-3 w-44"
              value={pendingLevel}
              onChange={(e) => setPendingLevel(parseInt(e.target.value, 10))}
              aria-label="Nivel del skill a agregar"
            >
              {SKILL_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
              ))}
            </select>
          </div>

          {skillsDetailed.length === 0 ? (
            <p className="text-xs text-zinc-500">Aún no has agregado skills.</p>
          ) : (
            <ul className="space-y-2">
              {skillsDetailed.map((s: any, idx: number) => (
                <li key={s.termId} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{s.label}</span>
                  <select
                    className="border rounded-xl p-2 w-40"
                    value={s.level}
                    onChange={(e) => skillFA.update(idx, { ...s, level: parseInt(e.target.value,10) })}
                  >
                    {SKILL_LEVELS.map((lvl) => (
                      <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                    ))}
                  </select>
                  <button type="button" className="text-red-500 hover:text-red-700 text-sm" onClick={() => removeSkillWithLevel(s.termId)}>×</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Idiomas */}
        <section id="languages" className="space-y-3 scroll-mt-24">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Idiomas</label>
            <button
              type="button"
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() => langFA.append({
                termId: languageOptions[0]?.id || "",
                label: languageOptions[0]?.label || "",
                level: "CONVERSATIONAL",
              })}
            >
              + Añadir idioma
            </button>
          </div>

          {langFA.fields.length === 0 ? (
            <p className="text-xs text-zinc-500">Aún no has agregado idiomas.</p>
          ) : (
            <div className="space-y-3">
              {langFA.fields.map((f, idx) => {
                const item = (languages[idx] || { termId: "", label: "", level: "CONVERSATIONAL" });
                return (
                  <div key={f.id} className="flex gap-2 items-center">
                    <select
                      className="border rounded-xl p-2 flex-1"
                      value={item.termId}
                      onChange={(e) => {
                        const term = languageOptions.find((o) => o.id === e.target.value);
                        handlePatchLang(idx, { termId: term?.id || "", label: term?.label || "" });
                      }}
                    >
                      <option value="">Selecciona idioma</option>
                      {languageOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>

                    <select
                      className="border rounded-xl p-2"
                      value={item.level}
                      onChange={(e) => handlePatchLang(idx, { level: e.target.value as any })}
                    >
                      {LANGUAGE_LEVELS.map((lvl) => (
                        <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                      ))}
                    </select>

                    <button type="button" onClick={() => langFA.remove(idx)} className="text-red-500 hover:text-red-700 text-sm">×</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 🔹 Escolaridad — Nivel antes que institución/programa */}
        <section id="education" className="space-y-3 scroll-mt-24">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Educación</label>
            <button
              type="button"
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={addEducation}
            >
              + Añadir educación
            </button>
          </div>

          {eduFA.fields.length === 0 ? (
            <p className="text-xs text-zinc-500">Aún no has agregado educación.</p>
          ) : (
            <div className="space-y-4">
              {eduFA.fields.map((f, idx) => {
                return (
                  <div key={f.id} className="border rounded-xl p-4 space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Entrada #{idx + 1}</div>
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-xs border rounded px-2 py-1 hover:bg-gray-50" onClick={() => moveEducation(idx, idx - 1)}>↑</button>
                        <button type="button" className="text-xs border rounded px-2 py-1 hover:bg-gray-50" onClick={() => moveEducation(idx, idx + 1)}>↓</button>
                        <button type="button" className="text-xs border rounded px-2 py-1 hover:bg-gray-50" onClick={() => eduFA.remove(idx)}>Eliminar</button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      {/* 1) Nivel primero */}
                      <div>
                        <label className="text-sm">Nivel</label>
                        <select className="border rounded-xl p-3 w-full" {...register(`education.${idx}.level` as const)}>
                          <option value="">—</option>
                          {EDUCATION_LEVEL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* 2) Institución */}
                      <div>
                        <label className="text-sm">Institución *</label>
                        <input className="border rounded-xl p-3 w-full" {...register(`education.${idx}.institution` as const)} />
                      </div>

                      {/* 3) Programa */}
                      <div>
                        <label className="text-sm">Programa</label>
                        <input className="border rounded-xl p-3 w-full" placeholder="Ej. Ingeniería en Sistemas" {...register(`education.${idx}.program` as const)} />
                      </div>

                      {/* 4) Fechas */}
                      <div>
                        <label className="text-sm">Inicio</label>
                        <input type="month" className="border rounded-xl p-3 w-full" {...register(`education.${idx}.startDate` as const)} />
                      </div>
                      <div>
                        <label className="text-sm">Fin</label>
                        <input
                          type="month"
                          className="border rounded-xl p-3 w-full"
                          {...register(`education.${idx}.endDate` as const)}
                        />
                        <p className="text-[11px] text-zinc-500 mt-1">
                          Déjalo vacío si sigues cursando (se marcará como “en curso”).
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {errors.root?.message && (
          <div className="border border-red-300 bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">
            {errors.root.message}
          </div>
        )}

        <div className="flex justify-end">
          <button disabled={isSubmitting} className="rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-500">
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
