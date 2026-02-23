// app/profile/ProfileForm.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  useForm,
  useWatch,
  useFieldArray,
  FormProvider,
  useFormContext,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { PhoneNumberUtil } from "google-libphonenumber";
import { toastPromise } from "@/lib/ui/toast";
import UploadCvButton from "@/components/upload/UploadCvButton";
import { LANGUAGE_LEVELS } from "@/lib/shared/skills-data";
import PhoneInputField from "@/components/PhoneInputField";

import {
  ProfileFormSchema,
  type ProfileFormData,
} from "@/lib/shared/schemas/profile";

/* =========================
   Clases reutilizables UI
   ========================= */
const SECTION_CARD =
  "glass-card rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-4 md:p-6 space-y-4";
const LABEL_BASE =
  "block text-sm font-medium text-zinc-800 dark:text-zinc-100";
const INPUT_BASE =
  "block w-full rounded-xl border border-zinc-300 bg-white/90 px-3 py-2.5 text-sm text-zinc-900 shadow-sm " +
  "placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 " +
  "focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-50 " +
  "dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-50 dark:placeholder:text-zinc-500 " +
  "dark:focus-visible:ring-offset-zinc-900";
const SUBTEXT_BASE = "mt-1 text-xs text-zinc-500 dark:text-zinc-400";
const TAG_BASE =
  "inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700 " +
  "dark:border-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-100";
const BTN_OUTLINE =
  "text-xs md:text-sm rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 " +
  "hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60 transition-colors";
const BTN_DANGER =
  "text-xs font-medium text-red-500 hover:text-red-600 transition-colors";

/* ===== Tipos ===== */
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
  languages?: Array<{
    termId: string;
    label: string;
    level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
  }>;
  skillsDetailed?: Array<{ termId: string; label: string; level: 1 | 2 | 3 | 4 | 5 }>;
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
  { value: "TECHNICAL"  as const, label: "Técnico / TSU" },
  { value: "BACHELOR"   as const, label: "Licenciatura / Ingeniería" },
  { value: "MASTER"     as const, label: "Maestría" },
  { value: "DOCTORATE"  as const, label: "Doctorado" },
  { value: "OTHER"      as const, label: "Diplomado / Curso" },
];

type EducationEntry = {
  id?: string;
  level: EducationLevel | null;
  status: EducationStatus;
  institution: string;
  program?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sortIndex: number;
};

type WorkExperience = {
  id?: string;
  role: string;
  company: string;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
};

const SKILL_LEVELS = [
  { value: 1 as const, label: "Básico" },
  { value: 2 as const, label: "Junior" },
  { value: 3 as const, label: "Intermedio" },
  { value: 4 as const, label: "Avanzado" },
  { value: 5 as const, label: "Experto" },
];

const SKILL_BAR_COLORS: Record<number, string> = {
  1: "bg-zinc-300 dark:bg-zinc-600",
  2: "bg-blue-400",
  3: "bg-yellow-400",
  4: "bg-emerald-400",
  5: "bg-emerald-600",
};

const SKILL_PILL_ACTIVE: Record<number, string> = {
  1: "bg-zinc-400 text-white shadow-sm",
  2: "bg-blue-400 text-white shadow-sm",
  3: "bg-yellow-400 text-white shadow-sm",
  4: "bg-emerald-400 text-white shadow-sm",
  5: "bg-emerald-600 text-white shadow-sm",
};

/* ===== Phone helpers ===== */
const phoneUtil  = PhoneNumberUtil.getInstance();
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
function buildE164(countryDial: string, localRaw: string): string | null {
  const localDigits = onlyDigits(localRaw);
  if (!localDigits) return null;
  const full = `+${countryDial}${localDigits}`;
  try {
    const parsed = phoneUtil.parse(full);
    if (!phoneUtil.isValidNumber(parsed)) return null;
    const region = phoneUtil.getRegionCodeForNumber(parsed);
    const cc     = phoneUtil.getCountryCodeForRegion(region);
    const nsn    = phoneUtil.getNationalSignificantNumber(parsed);
    return `+${cc}${nsn}`;
  } catch { return null; }
}

/* ===== Fecha helpers ===== */
const MONTH_RE       = /^\d{4}-(0[1-9]|1[0-2])$/;
const toMonthStartDate = (ym: string): Date | null => {
  if (!MONTH_RE.test(ym)) return null;
  return new Date(`${ym}-01T00:00:00.000Z`);
};
const ymToISO = (ym?: string | null) =>
  ym && MONTH_RE.test(ym) ? `${ym}-01` : "";

/* ===== Ubicación helpers ===== */
function stripDiacritics(s: string) {
  return (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  mexico: "mx", méxico: "mx",
  "estados unidos": "us", eeuu: "us", eua: "us", usa: "us",
  canada: "ca", canadá: "ca",
  argentina: "ar", bolivia: "bo", brasil: "br", chile: "cl",
  colombia: "co", "costa rica": "cr", cuba: "cu",
  "republica dominicana": "do", "república dominicana": "do",
  ecuador: "ec", "el salvador": "sv", guatemala: "gt",
  honduras: "hn", haiti: "ht", haití: "ht", jamaica: "jm",
  nicaragua: "ni", panama: "pa", panamá: "pa", paraguay: "py",
  peru: "pe", perú: "pe", "puerto rico": "pr", uruguay: "uy",
  venezuela: "ve", bahamas: "bs", barbados: "bb",
  "trinidad y tobago": "tt", guyana: "gy", surinam: "sr", belice: "bz",
  "united states": "us", "united states of america": "us", brazil: "br",
};
function deriveLocationParts(label: string) {
  const parts = (label || "").split(",").map((p) => p.trim()).filter(Boolean);
  const city        = parts[0];
  const admin1      = parts.length >= 3 ? parts[parts.length - 2] : parts.length >= 2 ? parts[1] : undefined;
  const countryLabel = parts.length ? parts[parts.length - 1] : undefined;
  const countryCode  = countryLabel ? COUNTRY_NAME_TO_ISO2[stripDiacritics(countryLabel)] : undefined;
  return { city, admin1, countryLabel, countryCode };
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
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
  const [currentResumeUrl, setCurrentResumeUrl] = useState(initial.resumeUrl ?? "");

  const initialPhoneValue =
    initial.phoneCountry && initial.phoneLocal
      ? `+${initial.phoneCountry}${initial.phoneLocal}`
      : initial.phoneLocal || "";

  const methods = useForm<ProfileFormData>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      firstName:    initial.firstName ?? "",
      lastName1:    initial.lastName1 ?? "",
      lastName2:    initial.lastName2 ?? "",
      location:     initial.location  ?? "",
      birthdate:    initial.birthdate ?? "",
      linkedin:     initial.linkedin  ?? "",
      github:       initial.github    ?? "",
      phoneCountry: initial.phoneCountry || "52",
      phoneLocal:   initialPhoneValue,
      certifications: initial.certifications ?? [],
      experiences: (initial.experiences ?? []).map((e) => ({
        ...e,
        startDate: (e.startDate || "").slice(0, 7),
        endDate:   e.endDate ? e.endDate.slice(0, 7) : null,
        isCurrent: !!e.isCurrent,
      })),
      languages: (initial.languages ?? []).map((l) => ({
        termId: l.termId, label: l.label, level: l.level,
      })),
      skillsDetailed: (initial.skillsDetailed ?? []).map((s) => ({
        termId: s.termId, label: s.label, level: s.level,
      })),
      education: (initial.education ?? []).map((ed, i) => ({
        id: ed.id, level: ed.level ?? null, status: "COMPLETED",
        institution: ed.institution ?? "", program: ed.program ?? "",
        startDate: (ed.startDate || "")?.slice(0, 7) || "",
        endDate:   (ed.endDate   || "")?.slice(0, 7) || "",
        sortIndex: ed.sortIndex ?? i,
      })),
    },
  });

  const {
    register, handleSubmit, setValue, setError, clearErrors,
    formState: { errors, isSubmitting, isDirty },
    control, reset, getValues,
  } = methods;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitting) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isSubmitting]);

  useEffect(() => {
    setCurrentResumeUrl(initial.resumeUrl ?? "");
    reset({
      firstName:    initial.firstName ?? "",
      lastName1:    initial.lastName1 ?? "",
      lastName2:    initial.lastName2 ?? "",
      location:     initial.location  ?? "",
      birthdate:    initial.birthdate ?? "",
      linkedin:     initial.linkedin  ?? "",
      github:       initial.github    ?? "",
      phoneCountry: initial.phoneCountry || "52",
      phoneLocal:
        initial.phoneCountry && initial.phoneLocal
          ? `+${initial.phoneCountry}${initial.phoneLocal}`
          : initial.phoneLocal || "",
      certifications: initial.certifications ?? [],
      experiences: (initial.experiences ?? []).map((e) => ({
        ...e,
        startDate: (e.startDate || "").slice(0, 7),
        endDate:   e.endDate ? e.endDate.slice(0, 7) : null,
        isCurrent: !!e.isCurrent,
      })),
      languages: (initial.languages ?? []).map((l) => ({
        termId: l.termId, label: l.label, level: l.level,
      })),
      skillsDetailed: (initial.skillsDetailed ?? []).map((s) => ({
        termId: s.termId, label: s.label, level: s.level,
      })),
      education: (initial.education ?? []).map((ed, i) => ({
        id: ed.id, level: ed.level ?? null, status: "COMPLETED",
        institution: ed.institution ?? "", program: ed.program ?? "",
        startDate: (ed.startDate || "")?.slice(0, 7) || "",
        endDate:   (ed.endDate   || "")?.slice(0, 7) || "",
        sortIndex: ed.sortIndex ?? i,
      })),
    });
  }, [initial, reset]);

  const expFA   = useFieldArray({ control, name: "experiences" });
  const langFA  = useFieldArray({ control, name: "languages" });
  const skillFA = useFieldArray({ control, name: "skillsDetailed" });
  const eduFA   = useFieldArray({ control, name: "education" });

  const experiences    = useWatch({ control, name: "experiences"    }) || [];
  const languages      = useWatch({ control, name: "languages"      }) || [];
  const skillsDetailed = useWatch({ control, name: "skillsDetailed" }) || [];
  const certifications = useWatch({ control, name: "certifications" }) || [];
  const educationRows  = useWatch({ control, name: "education"      }) || [];

  /* ===== Certificaciones ===== */
  const [certQuery, setCertQuery] = useState("");
  const [isCertDropdownOpen, setIsCertDropdownOpen] = useState(false);

  const filteredCerts = useMemo(() => {
    const q      = certQuery.trim().toLowerCase();
    const chosen = new Set((certifications as string[]).map((c) => c.toLowerCase()));
    const base   = q ? certOptions.filter((c) => c.toLowerCase().includes(q)) : certOptions;
    return base.filter((c) => !chosen.has(c.toLowerCase())).slice(0, 30);
  }, [certQuery, certOptions, certifications]);

  const addCert = (label: string) => {
    const v = (label || "").trim();
    if (!v) return;
    if ((certifications as string[]).some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setValue("certifications", [...(certifications as string[]), v], { shouldValidate: true, shouldDirty: true });
    setCertQuery("");
    setIsCertDropdownOpen(false);
  };

  const removeCert = (label: string) => {
    setValue("certifications",
      (certifications as string[]).filter((x) => x.toLowerCase() !== label.toLowerCase()),
      { shouldValidate: true, shouldDirty: true }
    );
  };

  /* ===== Experiencias ===== */
  const makeCurrent = useCallback((idx: number, checked: boolean) => {
    const total = getValues("experiences")?.length || 0;
    for (let i = 0; i < total; i++) {
      setValue(`experiences.${i}.isCurrent` as const, i === idx ? checked : false, { shouldDirty: true, shouldValidate: true });
      if (i === idx && checked) setValue(`experiences.${i}.endDate` as const, null as any, { shouldDirty: true, shouldValidate: true });
    }
  }, [getValues, setValue]);

  /* ===== Skills ===== */
  const [skillQuery, setSkillQuery]     = useState("");
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);

  const filteredSkillOptions = useMemo(() => {
    const q        = skillQuery.trim().toLowerCase();
    const addedIds = new Set((skillsDetailed as any[]).map((s) => s.termId));
    return (q ? skillTermOptions.filter((o) => o.label.toLowerCase().includes(q)) : skillTermOptions)
      .filter((o) => !addedIds.has(o.id))
      .slice(0, 20);
  }, [skillQuery, skillTermOptions, skillsDetailed]);

  function addSkillWithLevel(opt: SkillOption) {
    if ((skillsDetailed as any[]).some((s) => s.termId === opt.id)) return;
    skillFA.append({ termId: opt.id, label: opt.label, level: 3 });
    setSkillQuery("");
    setIsSkillDropdownOpen(false);
  }

  function removeSkillWithLevel(termId: string) {
    const idx = (skillsDetailed as any[]).findIndex((s) => s.termId === termId);
    if (idx >= 0) skillFA.remove(idx);
  }

  /* ===== Educación ===== */
  const addEducation = () => {
    eduFA.append({ level: null, status: "COMPLETED", institution: "", program: "", startDate: "", endDate: "", sortIndex: educationRows.length });
  };
  const moveEducation = (from: number, to: number) => {
    if (to < 0 || to >= educationRows.length) return;
    eduFA.move(from, to);
    const next = (educationRows as EducationEntry[]).map((r, i) => ({ ...r, sortIndex: i }));
    next.forEach((row, i) => eduFA.update(i, row));
  };

  /* ===== Submit ===== */
  const MONTH_OVERLAPS = (rows: Array<{ startDate: string; endDate?: string | null }>) => {
    const ranges = rows
      .map((r) => ({ s: toMonthStartDate(r.startDate), e: r.endDate ? toMonthStartDate(r.endDate) : null }))
      .filter(({ s }) => !!s)
      .sort((a, b) => a.s!.getTime() - b.s!.getTime());
    for (let i = 0; i < ranges.length - 1; i++) {
      const aEnd = ranges[i].e ? ranges[i].e!.getTime() : Infinity;
      if (aEnd > ranges[i + 1].s!.getTime()) return true;
    }
    return false;
  };

  const onSubmitRHF = async (vals: ProfileFormData) => {
    clearErrors("root");

    let phoneE164: string | null      = null;
    let phoneCountryToSave            = vals.phoneCountry || "52";
    let phoneLocalToSave              = (vals.phoneLocal || "").replace(/\D+/g, "");
    const rawPhone                    = (vals.phoneLocal || "").trim();

    if (rawPhone) {
      try {
        if (rawPhone.startsWith("+")) {
          const parsed = phoneUtil.parse(rawPhone);
          if (!phoneUtil.isValidNumber(parsed)) { setError("root", { type: "manual", message: "Número de teléfono inválido." }); return; }
          const region = phoneUtil.getRegionCodeForNumber(parsed);
          const cc     = phoneUtil.getCountryCodeForRegion(region);
          const nsn    = phoneUtil.getNationalSignificantNumber(parsed);
          phoneE164           = `+${cc}${nsn}`;
          phoneCountryToSave  = String(cc);
          phoneLocalToSave    = nsn;
        } else {
          phoneE164 = buildE164(vals.phoneCountry || "52", rawPhone);
          if (!phoneE164) { setError("root", { type: "manual", message: "Número de teléfono inválido." }); return; }
        }
      } catch {
        setError("root", { type: "manual", message: "Número de teléfono inválido." });
        return;
      }
    }

    const exps = vals.experiences || [];
    if (exps.filter((e) => e.isCurrent).length > 1) { setError("root", { type: "manual", message: "Solo puedes marcar una experiencia como 'Actual'." }); return; }
    if (MONTH_OVERLAPS(exps.map((e) => ({ startDate: e.startDate, endDate: e.isCurrent ? null : e.endDate || null })))) {
      setError("root", { type: "manual", message: "Tus experiencias no pueden traslaparse." }); return;
    }

    const { city, admin1, countryCode } = deriveLocationParts(vals.location || "");
    const cityNorm   = stripDiacritics(city   || "");
    const admin1Norm = stripDiacritics(admin1 || "");

    const edu = (vals.education || []).map((row, i) => {
      const startISO = ymToISO(row.startDate);
      const endISO   = ymToISO(row.endDate);
      const status: EducationStatus = endISO ? "COMPLETED" : "ONGOING";
      return { id: row.id, level: row.level, status, institution: row.institution, program: row.program || null, startDate: startISO || "", endDate: status === "ONGOING" ? null : endISO, sortIndex: i };
    });

    const fd = new FormData();
    fd.set("firstName",    vals.firstName ?? "");
    fd.set("lastName1",    vals.lastName1 ?? "");
    fd.set("lastName2",    vals.lastName2 ?? "");
    fd.set("location",     vals.location  ?? "");
    fd.set("birthdate",    vals.birthdate ?? "");
    fd.set("linkedin",     vals.linkedin  ?? "");
    fd.set("github",       vals.github    ?? "");
    fd.set("phone",        phoneE164 || "");
    fd.set("phoneCountry", phoneCountryToSave);
    fd.set("phoneLocal",   phoneLocalToSave);
    fd.set("certifications", (vals.certifications || []).join(", "));
    fd.set("experiences",    JSON.stringify(exps));
    fd.set("languages",      JSON.stringify(vals.languages     || []));
    fd.set("skillsDetailed", JSON.stringify(vals.skillsDetailed || []));
    fd.set("resumeUrl", currentResumeUrl);

    const eduPayload = JSON.stringify(edu);
    fd.set("education",     eduPayload);
    fd.set("educations",    eduPayload);
    fd.set("educationJson", eduPayload);

    if (countryCode) fd.set("countryCode", countryCode);
    if (admin1)      fd.set("admin1",      admin1);
    if (city)        fd.set("city",        city);
    if (cityNorm)    fd.set("cityNorm",    cityNorm);
    if (admin1Norm)  fd.set("admin1Norm",  admin1Norm);

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
      <form
        onSubmit={handleSubmit(onSubmitRHF)}
        className="space-y-6 max-w-5xl mx-auto"
        encType="multipart/form-data"
      >
        <SectionPersonal />
        <SectionContact />
        <SectionNetworks />

        <SectionCV
          resumeUrl={currentResumeUrl}
          onUploaded={(url) => setCurrentResumeUrl(url)}
        />

        <SectionExperience
          expFA={expFA} register={register} setValue={setValue}
          experiences={experiences as WorkExperience[]} makeCurrent={makeCurrent}
        />

        <SectionCerts
          certifications={certifications as string[]}
          certQuery={certQuery}
          setCertQuery={setCertQuery}
          filteredCerts={filteredCerts}
          addCert={addCert}
          removeCert={removeCert}
          isCertDropdownOpen={isCertDropdownOpen}
          setIsCertDropdownOpen={setIsCertDropdownOpen}
        />

        <SectionSkills
          skillsDetailed={skillsDetailed}
          filteredSkillOptions={filteredSkillOptions}
          skillFA={skillFA}
          skillQuery={skillQuery}
          setSkillQuery={setSkillQuery}
          addSkillWithLevel={addSkillWithLevel}
          removeSkillWithLevel={removeSkillWithLevel}
          isSkillDropdownOpen={isSkillDropdownOpen}
          setIsSkillDropdownOpen={setIsSkillDropdownOpen}
        />

        <SectionLanguages
          langFA={langFA} languages={languages} languageOptions={languageOptions}
          handlePatchLang={(idx, patch) => {
            const curr = languages[idx] || { termId: "", label: "", level: "CONVERSATIONAL" };
            langFA.update(idx, { ...curr, ...patch });
          }}
        />

        <SectionEducation eduFA={eduFA} addEducation={addEducation} moveEducation={moveEducation} />

        {errors.root?.message && (
          <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-100">
            <span className="mt-0.5 text-base">⚠️</span>
            <span>{errors.root.message}</span>
          </div>
        )}

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-900/95">
          {isDirty ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              ● Tienes cambios sin guardar
            </p>
          ) : (
            <p className="text-xs text-zinc-400">Tu perfil está al día ✓</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Guardando...
              </>
            ) : (
              "Guardar cambios"
            )}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

/* ============================================================
   Sub-secciones
   ============================================================ */

function SectionPersonal() {
  const { register, formState: { errors } } = useFormContext<ProfileFormData>();
  return (
    <section id="personal" className={`${SECTION_CARD} scroll-mt-24`}>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Datos personales</h2>
        <p className={SUBTEXT_BASE}>Estos datos aparecerán en tu resumen y en las vacantes a las que apliques.</p>
      </header>
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className={LABEL_BASE}>Nombre(s) *</label>
          <input className={INPUT_BASE} placeholder="Ej. María" {...register("firstName")} />
          {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className={LABEL_BASE}>Apellido paterno *</label>
          <input className={INPUT_BASE} placeholder="Ej. González" {...register("lastName1")} />
          {errors.lastName1 && <p className="mt-1 text-xs text-red-500">{errors.lastName1.message}</p>}
        </div>
        <div>
          <label className={LABEL_BASE}>
            Apellido materno <span className="text-zinc-400 font-normal">(opcional)</span>
          </label>
          <input className={INPUT_BASE} placeholder="Ej. López" {...register("lastName2")} />
        </div>
      </div>
    </section>
  );
}

function SectionContact() {
  const { control, setValue } = useFormContext<ProfileFormData>();
  const locationValue  = useWatch({ control, name: "location"   }) || "";
  const phoneLocalValue = useWatch({ control, name: "phoneLocal" }) || "";

  return (
    <section id="contacto" className={`${SECTION_CARD} scroll-mt-24`}>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Teléfono y ubicación</h2>
        <p className={SUBTEXT_BASE}>Ayuda a que los reclutadores puedan contactarte fácilmente.</p>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        <PhoneInputField
          value={phoneLocalValue}
          onChange={(val) => setValue("phoneLocal", val, { shouldDirty: true, shouldValidate: true })}
          label="Teléfono"
          helperText="Se guarda en formato internacional para WhatsApp o llamada."
        />
        <div>
          <label className={LABEL_BASE}>Ubicación</label>
          <LocationAutocomplete
            value={locationValue}
            onChange={(v) => setValue("location", v, { shouldValidate: true, shouldDirty: true })}
            countries={["mx"]}
            className={INPUT_BASE}
          />
          <p className={SUBTEXT_BASE}>Ciudad o municipio donde resides</p>
        </div>
      </div>
    </section>
  );
}

function SectionNetworks() {
  const { register, formState: { errors } } = useFormContext<ProfileFormData>();
  return (
    <section className={SECTION_CARD}>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Información adicional</h2>
        <p className={SUBTEXT_BASE}>Opcional, pero muy útil para que el reclutador conozca tu perfil completo.</p>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_BASE}>
            Fecha de nacimiento <span className="text-zinc-400 font-normal">(opcional)</span>
          </label>
          <input type="date" className={INPUT_BASE} {...register("birthdate")} />
          <p className={SUBTEXT_BASE}>Solo visible para ti y para los reclutadores que te contacten</p>
        </div>
        <div>
          <label className={LABEL_BASE}>LinkedIn <span className="text-zinc-400 font-normal">(opcional)</span></label>
          <input className={INPUT_BASE} placeholder="https://linkedin.com/in/tu-perfil" {...register("linkedin")} />
          {errors.linkedin && <p className="mt-1 text-xs text-red-500">{errors.linkedin.message}</p>}
        </div>
        <div>
          <label className={LABEL_BASE}>GitHub <span className="text-zinc-400 font-normal">(opcional)</span></label>
          <input className={INPUT_BASE} placeholder="https://github.com/tu-usuario" {...register("github")} />
          {errors.github && <p className="mt-1 text-xs text-red-500">{errors.github.message}</p>}
        </div>
      </div>
    </section>
  );
}

function SectionCV({
  resumeUrl,
  onUploaded,
}: {
  resumeUrl: string;
  onUploaded: (url: string) => void;
}) {
  return (
    <section id="cv" className={`${SECTION_CARD} scroll-mt-24`}>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Currículum</h2>
        <p className={SUBTEXT_BASE}>Sube tu CV en PDF, DOC o DOCX. Máximo 8 MB.</p>
      </header>

      {resumeUrl ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    CV subido correctamente
                  </p>
                  <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    ✓ Activo
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                  Los reclutadores podrán ver y descargar tu currículum
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Ver CV
              </a>
              <a
                href={resumeUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar
              </a>
              <UploadCvButton onUploaded={onUploaded} variant="secondary" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-6 w-6 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              No has subido tu CV
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Sube tu currículum para que los reclutadores puedan conocer tu experiencia
            </p>
            <div className="mt-4">
              <UploadCvButton onUploaded={onUploaded} />
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
            <div className="flex gap-2">
              <svg className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-blue-900 dark:text-blue-100">
                <ul className="mt-1 space-y-0.5 list-disc list-inside text-blue-800 dark:text-blue-200">
                  <li>Formatos aceptados: PDF, DOC, DOCX (máx. 8 MB)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SectionExperience({
  expFA, register, setValue, experiences, makeCurrent,
}: {
  expFA: ReturnType<typeof useFieldArray<ProfileFormData>>;
  register: ReturnType<typeof useForm<ProfileFormData>>["register"];
  setValue: ReturnType<typeof useForm<ProfileFormData>>["setValue"];
  experiences: WorkExperience[];
  makeCurrent: (idx: number, checked: boolean) => void;
}) {
  return (
    <section id="experiencia" className={`${SECTION_CARD} scroll-mt-24`}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Experiencia laboral</h2>
          <p className={SUBTEXT_BASE}>Agrega tus experiencias en orden cronológico.</p>
        </div>
        <button type="button" className={BTN_OUTLINE}
          onClick={() => expFA.append({ role: "", company: "", startDate: "", endDate: "", isCurrent: false })}>
          + Añadir
        </button>
      </div>

      {expFA.fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-6 text-center">
          <p className="text-sm text-zinc-400">Sin experiencia registrada</p>
          <button type="button" className="mt-2 text-sm text-emerald-600 hover:underline dark:text-emerald-400"
            onClick={() => expFA.append({ role: "", company: "", startDate: "", endDate: "", isCurrent: false })}>
            + Agregar primera experiencia
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {expFA.fields.map((fItem, idx) => {
            const item     = (experiences[idx] || { role: "", company: "", startDate: "", endDate: "", isCurrent: false }) as WorkExperience;
            const isCurrent = !!item.isCurrent;
            return (
              <div key={fItem.id ?? `${idx}`}
                className="glass-card border border-zinc-200/70 dark:border-zinc-700/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Experiencia {idx + 1}
                  </span>
                  <button type="button" className={BTN_DANGER} onClick={() => expFA.remove(idx)}>Eliminar</button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_BASE}>Puesto *</label>
                    <input className={INPUT_BASE} placeholder="Ej. Desarrollador Frontend" {...register(`experiences.${idx}.role` as const)} />
                  </div>
                  <div>
                    <label className={LABEL_BASE}>Empresa *</label>
                    <input className={INPUT_BASE} placeholder="Ej. Acme Inc." {...register(`experiences.${idx}.company` as const)} />
                  </div>
                  <div>
                    <label className={LABEL_BASE}>Inicio</label>
                    <input type="month" className={INPUT_BASE} {...register(`experiences.${idx}.startDate` as const)} />
                  </div>
                  <div>
                    <label className={LABEL_BASE}>Fin</label>
                    <div className="flex gap-2 items-center">
                      <input type="month" className={`${INPUT_BASE} flex-1 disabled:cursor-not-allowed disabled:opacity-50`}
                        disabled={isCurrent}
                        {...register(`experiences.${idx}.endDate` as const, {
                          onChange: (e) => {
                            if (String(e.target.value || "") === "")
                              setValue(`experiences.${idx}.endDate` as const, null as any, { shouldDirty: true, shouldValidate: true });
                          },
                        })}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer whitespace-nowrap">
                        <input type="checkbox" className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900"
                          {...register(`experiences.${idx}.isCurrent` as const, { onChange: (e) => makeCurrent(idx, e.target.checked) })}
                        />
                        Trabajo actual
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SectionCerts({
  certifications, certQuery, setCertQuery, filteredCerts, addCert, removeCert,
  isCertDropdownOpen, setIsCertDropdownOpen,
}: {
  certifications: string[]; certQuery: string;
  setCertQuery: (s: string) => void; filteredCerts: string[];
  addCert: (label: string) => void; removeCert: (label: string) => void;
  isCertDropdownOpen: boolean; setIsCertDropdownOpen: (v: boolean) => void;
}) {
  return (
    <section id="certs" className={`${SECTION_CARD} scroll-mt-24`}>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Certificaciones</h2>
        <p className={SUBTEXT_BASE}>Agrega certificaciones relevantes (AWS, Azure, Scrum, ITIL, etc.).</p>
      </header>

      {certifications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {certifications.map((c) => (
            <span key={c} className={TAG_BASE}>
              {c}
              <button type="button" onClick={() => removeCert(c)}
                className="ml-1 text-zinc-400 hover:text-red-500 transition-colors text-sm leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          className={INPUT_BASE}
          placeholder="Busca o escribe una certificación…"
          value={certQuery}
          onChange={(e) => {
            setCertQuery(e.target.value);
            setIsCertDropdownOpen(true);
          }}
          onFocus={() => setIsCertDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsCertDropdownOpen(false), 200)}
        />
        {isCertDropdownOpen && certQuery.trim().length > 0 && (
          <ul className="absolute z-10 mt-1 w-full glass-card rounded-2xl border border-zinc-200/80 bg-white/95 p-1 text-sm shadow-lg dark:border-zinc-700/70 dark:bg-zinc-900/95 max-h-48 overflow-y-auto">
            {filteredCerts.length === 0 ? (
              <>
                <li className="px-3 py-2 text-xs text-zinc-500">Sin coincidencias en el catálogo</li>
                <li className="cursor-pointer rounded-xl px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30 font-medium"
                  onMouseDown={(e) => { e.preventDefault(); addCert(certQuery.trim()); }}>
                  + Agregar &quot;{certQuery.trim()}&quot;
                </li>
              </>
            ) : (
              <>
                {filteredCerts.map((opt) => (
                  <li key={opt} className="cursor-pointer rounded-xl px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                    onMouseDown={(e) => { e.preventDefault(); addCert(opt); }}>
                    {opt}
                  </li>
                ))}
                <li className="cursor-pointer rounded-xl px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30 border-t border-zinc-100 dark:border-zinc-700/50 mt-1"
                  onMouseDown={(e) => { e.preventDefault(); addCert(certQuery.trim()); }}>
                  + Agregar &quot;{certQuery.trim()}&quot; como personalizada
                </li>
              </>
            )}
          </ul>
        )}
      </div>

      {certifications.length === 0 && certQuery.trim().length === 0 && (
        <p className={SUBTEXT_BASE}>Aún no has agregado certificaciones.</p>
      )}
    </section>
  );
}

function SectionSkills({
  skillsDetailed, filteredSkillOptions, skillFA,
  skillQuery, setSkillQuery, addSkillWithLevel, removeSkillWithLevel,
  isSkillDropdownOpen, setIsSkillDropdownOpen,
}: {
  skillsDetailed: any[];
  filteredSkillOptions: { id: string; label: string }[];
  skillFA: ReturnType<typeof useFieldArray<ProfileFormData>>;
  skillQuery: string;
  setSkillQuery: (s: string) => void;
  addSkillWithLevel: (opt: { id: string; label: string }) => void;
  removeSkillWithLevel: (termId: string) => void;
  isSkillDropdownOpen: boolean;
  setIsSkillDropdownOpen: (v: boolean) => void;
}) {
  return (
    <section id="skills" className={`${SECTION_CARD} scroll-mt-24`}>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Skills</h2>
        <p className={SUBTEXT_BASE}>Agrega tus tecnologías clave y ajusta el nivel en cada una.</p>
      </header>

      <div className="relative">
        <input
          className={INPUT_BASE}
          placeholder="Ej. React, Node.js, AWS…"
          value={skillQuery}
          onChange={(e) => {
            setSkillQuery(e.target.value);
            setIsSkillDropdownOpen(true);
          }}
          onFocus={() => setIsSkillDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsSkillDropdownOpen(false), 200)}
        />
        {isSkillDropdownOpen && skillQuery.trim().length > 0 && (
          <ul className="absolute z-10 mt-1 w-full glass-card rounded-2xl border border-zinc-200/80 bg-white/95 p-1 text-sm shadow-lg dark:border-zinc-700/70 dark:bg-zinc-900/95 max-h-48 overflow-y-auto">
            {filteredSkillOptions.length === 0 ? (
              <li className="px-3 py-2 text-xs text-zinc-500">Sin coincidencias</li>
            ) : (
              filteredSkillOptions.map((opt) => (
                <li
                  key={opt.id}
                  className="cursor-pointer rounded-xl px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                  onMouseDown={(e) => { e.preventDefault(); addSkillWithLevel(opt); }}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {skillsDetailed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-6 text-center">
          <p className="text-sm text-zinc-400">Sin skills registrados</p>
          <p className={`${SUBTEXT_BASE} mt-1`}>Escribe un skill arriba para agregarlo</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {skillsDetailed.map((s: any, idx: number) => {
            const pct = Math.round((s.level / 5) * 100);
            return (
              <li
                key={s.termId}
                className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-50 min-w-[80px]">
                    {s.label}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {SKILL_LEVELS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => skillFA.update(idx, { ...s, level: lvl.value })}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          s.level === lvl.value
                            ? SKILL_PILL_ACTIVE[lvl.value]
                            : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="ml-1 text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
                      onClick={() => removeSkillWithLevel(s.termId)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className={`h-1 rounded-full transition-all ${SKILL_BAR_COLORS[s.level] ?? "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SectionLanguages({
  langFA, languages, languageOptions, handlePatchLang,
}: {
  langFA: ReturnType<typeof useFieldArray<ProfileFormData>>;
  languages: any[];
  languageOptions: { id: string; label: string }[];
  handlePatchLang: (idx: number, patch: Partial<{ termId: string; label: string; level: any }>) => void;
}) {
  const LANG_LEVELS = [
    { value: "NATIVE",         label: "Nativo",                 color: "bg-emerald-600 text-white shadow-sm" },
    { value: "PROFESSIONAL",   label: "Profesional (C1–C2)",    color: "bg-emerald-400 text-white shadow-sm" },
    { value: "CONVERSATIONAL", label: "Conversacional (B1–B2)", color: "bg-yellow-400 text-white shadow-sm"  },
    { value: "BASIC",          label: "Básico (A1–A2)",          color: "bg-blue-400 text-white shadow-sm"   },
  ];

  const addedIds = new Set(languages.map((l: any) => l.termId));
  const availableLanguages = languageOptions.filter((o) => !addedIds.has(o.id));
  const firstAvailable = availableLanguages[0];

  return (
    <section id="languages" className={`${SECTION_CARD} scroll-mt-24`}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Idiomas</h2>
          <p className={SUBTEXT_BASE}>Indica los idiomas que hablas y tu nivel.</p>
        </div>
        <button
          type="button"
          className={BTN_OUTLINE}
          disabled={!firstAvailable}
          onClick={() => {
            if (!firstAvailable) return;
            langFA.append({ termId: firstAvailable.id, label: firstAvailable.label, level: "CONVERSATIONAL" });
          }}
        >
          + Añadir
        </button>
      </div>

      {langFA.fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-6 text-center">
          <p className="text-sm text-zinc-400">Sin idiomas registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {langFA.fields.map((f, idx) => {
            const item = languages[idx] || { termId: "", label: "", level: "CONVERSATIONAL" };
            const currentOpt = languageOptions.find((o) => o.id === item.termId);
            const optionsForRow = [
              ...(currentOpt ? [currentOpt] : []),
              ...languageOptions.filter((o) => !addedIds.has(o.id)),
            ];
            return (
              <div
                key={f.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <select
                    className={`${INPUT_BASE} w-auto max-w-[200px]`}
                    value={item.termId}
                    onChange={(e) => {
                      const term = languageOptions.find((o) => o.id === e.target.value);
                      handlePatchLang(idx, { termId: term?.id || "", label: term?.label || "" });
                    }}
                  >
                    <option value="">Selecciona idioma</option>
                    {optionsForRow.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {LANG_LEVELS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => handlePatchLang(idx, { level: lvl.value })}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          item.level === lvl.value
                            ? lvl.color
                            : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="ml-1 text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
                      onClick={() => langFA.remove(idx)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SectionEducation({
  eduFA, addEducation, moveEducation,
}: {
  eduFA: ReturnType<typeof useFieldArray<ProfileFormData>>;
  addEducation: () => void;
  moveEducation: (from: number, to: number) => void;
}) {
  const { register } = useFormContext<ProfileFormData>();
  return (
    <section id="education" className={`${SECTION_CARD} scroll-mt-24`}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Educación</h2>
          <p className={SUBTEXT_BASE}>Agrega tus estudios más relevantes. Puedes reordenarlos.</p>
        </div>
        <button type="button" className={BTN_OUTLINE} onClick={addEducation}>+ Añadir</button>
      </div>

      {eduFA.fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-6 text-center">
          <p className="text-sm text-zinc-400">Sin educación registrada</p>
          <button type="button" onClick={addEducation}
            className="mt-2 text-sm text-emerald-600 hover:underline dark:text-emerald-400">
            + Agregar educación
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {eduFA.fields.map((f, idx) => (
            <div key={f.id}
              className="glass-card border border-zinc-200/70 dark:border-zinc-700/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Entrada #{idx + 1}
                </span>
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={idx === 0}
                    className="text-[11px] rounded-lg border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                    onClick={() => moveEducation(idx, idx - 1)}>↑</button>
                  <button type="button" disabled={idx === eduFA.fields.length - 1}
                    className="text-[11px] rounded-lg border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                    onClick={() => moveEducation(idx, idx + 1)}>↓</button>
                  <button type="button"
                    className="text-[11px] rounded-lg border border-red-200 px-2 py-1 text-red-500 hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/50 transition-colors"
                    onClick={() => eduFA.remove(idx)}>Eliminar</button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_BASE}>Nivel</label>
                  <select className={INPUT_BASE} {...register(`education.${idx}.level` as const)}>
                    <option value="">— Sin especificar —</option>
                    {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_BASE}>Institución *</label>
                  <input className={INPUT_BASE} placeholder="Ej. UANL, Tec de Monterrey…"
                    {...register(`education.${idx}.institution` as const)} />
                </div>
                <div>
                  <label className={LABEL_BASE}>Programa / Carrera</label>
                  <input className={INPUT_BASE} placeholder="Ej. Ingeniería en Sistemas"
                    {...register(`education.${idx}.program` as const)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL_BASE}>Inicio</label>
                    <input type="month" className={INPUT_BASE} {...register(`education.${idx}.startDate` as const)} />
                  </div>
                  <div>
                    <label className={LABEL_BASE}>Fin</label>
                    <input type="month" className={INPUT_BASE} {...register(`education.${idx}.endDate` as const)} />
                    <p className={SUBTEXT_BASE}>Vacío = en curso</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}