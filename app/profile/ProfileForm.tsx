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

// ✅ Schema y tipos del perfil
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
const SUBTEXT_BASE =
  "mt-1 text-xs text-zinc-500 dark:text-zinc-400";

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
  languages?: Array<{
    termId: string;
    label: string;
    level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
  }>;
  skillsDetailed?: Array<{ termId: string; label: string; level: 1 | 2 | 3 | 4 | 5 }>;
  education?: EducationEntry[];
};

type LanguageOption = { id: string; label: string };
type SkillOption = { id: string; label: string };

type EducationLevel =
  | "NONE"
  | "PRIMARY"
  | "SECONDARY"
  | "HIGH_SCHOOL"
  | "TECHNICAL"
  | "BACHELOR"
  | "MASTER"
  | "DOCTORATE"
  | "OTHER";

type EducationStatus = "ONGOING" | "COMPLETED" | "INCOMPLETE";

const EDUCATION_LEVEL_OPTIONS = [
  { value: "HIGH_SCHOOL" as const, label: "Preparatoria / Bachillerato" },
  { value: "TECHNICAL" as const, label: "Técnico / TSU" },
  { value: "BACHELOR" as const, label: "Licenciatura / Ingeniería" },
  { value: "MASTER" as const, label: "Maestría" },
  { value: "DOCTORATE" as const, label: "Doctorado" },
  { value: "OTHER" as const, label: "Diplomado / Curso" },
];

type EducationEntry = {
  id?: string;
  level: EducationLevel | null;
  status: EducationStatus;
  institution: string;
  program?: string | null;
  startDate?: string | null; // YYYY-MM
  endDate?: string | null; // YYYY-MM (null si ONGOING)
  sortIndex: number;
};

type WorkExperience = {
  id?: string;
  role: string;
  company: string;
  startDate: string; // YYYY-MM
  endDate?: string | null; // YYYY-MM | null
  isCurrent: boolean;
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

// ——— Helpers fechas
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const toMonthStartDate = (ym: string): Date | null => {
  if (!MONTH_RE.test(ym)) return null;
  return new Date(`${ym}-01T00:00:00.000Z`);
};
const ymToISO = (ym?: string | null) =>
  ym && MONTH_RE.test(ym) ? `${ym}-01` : "";

/* ========= Helpers ubicación ========= */
function stripDiacritics(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  mexico: "mx",
  méxico: "mx",
  "estados unidos": "us",
  eeuu: "us",
  eua: "us",
  usa: "us",
  canada: "ca",
  canadá: "ca",
  argentina: "ar",
  bolivia: "bo",
  brasil: "br",
  chile: "cl",
  colombia: "co",
  "costa rica": "cr",
  cuba: "cu",
  "republica dominicana": "do",
  "república dominicana": "do",
  ecuador: "ec",
  "el salvador": "sv",
  guatemala: "gt",
  honduras: "hn",
  haiti: "ht",
  haití: "ht",
  jamaica: "jm",
  nicaragua: "ni",
  panama: "pa",
  panamá: "pa",
  paraguay: "py",
  peru: "pe",
  perú: "pe",
  "puerto rico": "pr",
  uruguay: "uy",
  venezuela: "ve",
  bahamas: "bs",
  barbados: "bb",
  "trinidad y tobago": "tt",
  guyana: "gy",
  surinam: "sr",
  belice: "bz",
  "united states": "us",
  "united states of america": "us",
  brazil: "br",
};
function deriveLocationParts(label: string): {
  city?: string;
  admin1?: string;
  countryLabel?: string;
  countryCode?: string;
} {
  const parts = (label || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const city = parts[0];
  const admin1 =
    parts.length >= 3
      ? parts[parts.length - 2]
      : parts.length >= 2
      ? parts[1]
      : undefined;
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
  // 🔢 Valor inicial que verá el PhoneInputField (siempre internacional)
  const initialPhoneValue =
    initial.phoneCountry && initial.phoneLocal
      ? `+${initial.phoneCountry}${initial.phoneLocal}`
      : initial.phoneLocal || "";

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
      phoneLocal: initialPhoneValue,
      certifications: initial.certifications ?? [],
      experiences: (initial.experiences ?? []).map((e) => ({
        ...e,
        startDate: (e.startDate || "").slice(0, 7),
        endDate: e.endDate ? e.endDate.slice(0, 7) : null,
        isCurrent: !!e.isCurrent,
      })),
      languages: (initial.languages ?? []).map((l) => ({
        termId: l.termId,
        label: l.label,
        level: l.level,
      })),
      skillsDetailed: (initial.skillsDetailed ?? []).map((s) => ({
        termId: s.termId,
        label: s.label,
        level: s.level,
      })),
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
    getValues,
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
      phoneLocal:
        initial.phoneCountry && initial.phoneLocal
          ? `+${initial.phoneCountry}${initial.phoneLocal}`
          : initial.phoneLocal || "",
      certifications: initial.certifications ?? [],
      experiences: (initial.experiences ?? []).map((e) => ({
        ...e,
        startDate: (e.startDate || "").slice(0, 7),
        endDate: e.endDate ? e.endDate.slice(0, 7) : null,
        isCurrent: !!e.isCurrent,
      })),
      languages: (initial.languages ?? []).map((l) => ({
        termId: l.termId,
        label: l.label,
        level: l.level,
      })),
      skillsDetailed: (initial.skillsDetailed ?? []).map((s) => ({
        termId: s.termId,
        label: s.label,
        level: s.level,
      })),
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
  const expFA = useFieldArray({ control, name: "experiences" });
  const langFA = useFieldArray({ control, name: "languages" });
  const skillFA = useFieldArray({ control, name: "skillsDetailed" });
  const eduFA = useFieldArray({ control, name: "education" });

  // ✅ Observamos listas una sola vez, fuera del map
  const experiences = useWatch({ control, name: "experiences" }) || [];
  const languages = useWatch({ control, name: "languages" }) || [];
  const skillsDetailed = useWatch({ control, name: "skillsDetailed" }) || [];
  const certifications = useWatch({ control, name: "certifications" }) || [];
  const educationRows = useWatch({ control, name: "education" }) || [];

  // ===== Certificaciones =====
  const [certQuery, setCertQuery] = useState("");
  const filteredCerts = useMemo(() => {
    const q = certQuery.trim().toLowerCase();
    const chosen = new Set(
      (certifications as string[]).map((c) => c.toLowerCase())
    );
    const base = q
      ? certOptions.filter((c) => c.toLowerCase().includes(q))
      : certOptions;
    return base.filter((c) => !chosen.has(c.toLowerCase())).slice(0, 30);
  }, [certQuery, certOptions, certifications]);

  const addCert = (label: string) => {
    const v = (label || "").trim();
    if (!v) return;
    const exists = (certifications as string[]).some(
      (x) => x.toLowerCase() === v.toLowerCase()
    );
    if (exists) return;
    setValue("certifications", [...(certifications as string[]), v], {
      shouldValidate: true,
      shouldDirty: true,
    });
    setCertQuery("");
  };
  const removeCert = (label: string) => {
    setValue(
      "certifications",
      (certifications as string[]).filter(
        (x) => x.toLowerCase() !== label.toLowerCase()
      ),
      { shouldValidate: true, shouldDirty: true }
    );
  };

  // ====== EXPERIENCIAS ======
  const makeCurrent = useCallback(
    (idx: number, checked: boolean) => {
      const total = getValues("experiences")?.length || 0;
      for (let i = 0; i < total; i++) {
        const path = `experiences.${i}.isCurrent` as const;
        setValue(path, i === idx ? checked : false, {
          shouldDirty: true,
          shouldValidate: true,
        });
        if (i === idx && checked) {
          setValue(
            `experiences.${i}.endDate` as const,
            null as any,
            { shouldDirty: true, shouldValidate: true }
          );
        }
      }
    },
    [getValues, setValue]
  );

  // ====== SKILLS ======
  const [skillQuery, setSkillQuery] = useState("");
  const [pendingLevel, setPendingLevel] = useState<number>(3);

  const filteredSkillOptions = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    const addedIds = new Set((skillsDetailed as any[]).map((s) => s.termId));
    return (q
      ? skillTermOptions.filter((o) =>
          o.label.toLowerCase().includes(q)
        )
      : skillTermOptions)
      .filter((o) => !addedIds.has(o.id))
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
      status: "COMPLETED",
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
    const next = (educationRows as EducationEntry[]).map((r, i) => ({
      ...r,
      sortIndex: i,
    }));
    next.forEach((row, i) => eduFA.update(i, row));
  };

  // ====== Submit ======
  const MONTH_OVERLAPS = (
    rows: Array<{ startDate: string; endDate?: string | null }>
  ) => {
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

    // Teléfono (aceptamos tanto número plano como internacional)
    let phoneE164: string | null = null;
    const rawPhone = (vals.phoneLocal || "").trim();
    const rawDigits = rawPhone.replace(/\D+/g, "");
    let phoneCountryToSave = vals.phoneCountry || "52";
    let phoneLocalToSave = rawDigits;

    if (rawPhone) {
      try {
        if (rawPhone.startsWith("+")) {
          const parsed = phoneUtil.parse(rawPhone);
          if (!phoneUtil.isValidNumber(parsed)) {
            setError("root", {
              type: "manual",
              message: "Número de teléfono inválido.",
            });
            return;
          }
          const region = phoneUtil.getRegionCodeForNumber(parsed);
          const cc = phoneUtil.getCountryCodeForRegion(region);
          const nsn = phoneUtil.getNationalSignificantNumber(parsed);
          phoneE164 = `+${cc}${nsn}`;
          phoneCountryToSave = String(cc);
          phoneLocalToSave = nsn;
        } else {
          phoneE164 = buildE164(vals.phoneCountry || "52", rawPhone || "");
          if (!phoneE164) {
            setError("root", {
              type: "manual",
              message: "Número de teléfono inválido.",
            });
            return;
          }
        }
      } catch {
        setError("root", {
          type: "manual",
          message: "Número de teléfono inválido.",
        });
        return;
      }
    }

    // Experiencias
    const exps = vals.experiences || [];
    const currentCount = exps.filter((e) => e.isCurrent).length;
    if (currentCount > 1) {
      setError("root", {
        type: "manual",
        message: "Solo puedes marcar una experiencia como 'Actual'.",
      });
      return;
    }
    if (
      MONTH_OVERLAPS(
        exps.map((e) => ({
          startDate: e.startDate,
          endDate: e.isCurrent ? null : e.endDate || null,
        }))
      )
    ) {
      setError("root", {
        type: "manual",
        message: "Tus experiencias no pueden traslaparse.",
      });
      return;
    }

    // Ubicación
    const { city, admin1, countryCode } = deriveLocationParts(
      vals.location || ""
    );
    const cityNorm = stripDiacritics(city || "");
    const admin1Norm = stripDiacritics(admin1 || "");

    // Educación
    const edu = (vals.education || []).map((row, i) => {
      const startISO = ymToISO(row.startDate);
      const endISO = ymToISO(row.endDate);
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
    fd.set("phoneCountry", phoneCountryToSave);
    fd.set("phoneLocal", phoneLocalToSave);
    fd.set("certifications", (vals.certifications || []).join(", "));
    fd.set("experiences", JSON.stringify(exps));
    fd.set("languages", JSON.stringify(vals.languages || []));
    fd.set("skillsDetailed", JSON.stringify(vals.skillsDetailed || []));
    if (initial.resumeUrl) fd.set("resumeUrl", initial.resumeUrl);

    // Escolaridad
    const eduPayload = JSON.stringify(edu);
    fd.set("education", eduPayload);
    fd.set("educations", eduPayload);
    fd.set("educationJson", eduPayload);

    // Ubicación desglosada
    if (countryCode) fd.set("countryCode", countryCode);
    if (admin1) fd.set("admin1", admin1);
    if (city) fd.set("city", city);
    if (cityNorm) fd.set("cityNorm", cityNorm);
    if (admin1Norm) fd.set("admin1Norm", admin1Norm);

    try {
      await toastPromise(onSubmit(fd), {
        loading: "Guardando cambios…",
        success: "Perfil actualizado",
        error: (e) => e?.message || "No se pudo actualizar el perfil",
      });
    } catch (e: any) {
      setError("root", {
        type: "server",
        message: e?.message || "Error desconocido",
      });
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(onSubmitRHF)}
        className="space-y-8 max-w-5xl mx-auto"
        encType="multipart/form-data"
      >
        <SectionPersonal />
        <SectionContact />
        <SectionNetworks />
        <SectionCV initialResumeUrl={initial.resumeUrl} />
        <SectionExperience
          expFA={expFA}
          register={register}
          setValue={setValue}
          experiences={experiences as WorkExperience[]}
          makeCurrent={makeCurrent}
        />
        <SectionCerts
          certifications={certifications as string[]}
          certQuery={certQuery}
          setCertQuery={setCertQuery}
          filteredCerts={filteredCerts}
          addCert={addCert}
          removeCert={removeCert}
        />
        <SectionSkills
          skillsDetailed={skillsDetailed}
          filteredSkillOptions={filteredSkillOptions}
          skillFA={skillFA}
          pendingLevel={pendingLevel}
          setPendingLevel={setPendingLevel}
          skillQuery={skillQuery}
          setSkillQuery={setSkillQuery}
          addSkillWithLevel={addSkillWithLevel}
          removeSkillWithLevel={removeSkillWithLevel}
        />
        <SectionLanguages
          langFA={langFA}
          languages={languages}
          languageOptions={languageOptions}
          handlePatchLang={(idx, patch) => {
            const curr =
              languages[idx] || {
                termId: "",
                label: "",
                level: "CONVERSATIONAL",
              };
            langFA.update(idx, { ...curr, ...patch });
          }}
        />
        <SectionEducation
          eduFA={eduFA}
          addEducation={addEducation}
          moveEducation={moveEducation}
        />

        {errors.root?.message && (
          <div className="border border-red-300 bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-100">
            {errors.root.message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            disabled={isSubmitting}
            className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

/* =========================
   Sub-secciones internas
   ========================= */

function SectionPersonal() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ProfileFormData>();
  return (
    <section
      id="personal"
      className={`${SECTION_CARD} scroll-mt-24`}
    >
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Datos personales
        </h2>
        <p className={SUBTEXT_BASE}>
          Estos datos aparecerán en tu resumen y en las vacantes a las que apliques.
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className={LABEL_BASE}>Nombre(s) *</label>
          <input className={INPUT_BASE} {...register("firstName")} />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-500">
              {errors.firstName.message}
            </p>
          )}
        </div>
        <div>
          <label className={LABEL_BASE}>Apellido paterno *</label>
          <input className={INPUT_BASE} {...register("lastName1")} />
          {errors.lastName1 && (
            <p className="mt-1 text-xs text-red-500">
              {errors.lastName1.message}
            </p>
          )}
        </div>
        <div>
          <label className={LABEL_BASE}>Apellido materno</label>
          <input className={INPUT_BASE} {...register("lastName2")} />
        </div>
      </div>
    </section>
  );
}

function SectionContact() {
  const { control, setValue } = useFormContext<ProfileFormData>();
  const locationValue = useWatch({ control, name: "location" }) || "";
  const phoneLocalValue = useWatch({ control, name: "phoneLocal" }) || "";

  return (
    <section
      id="contacto"
      className={`${SECTION_CARD} scroll-mt-24`}
    >
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Teléfono y ubicación
        </h2>
        <p className={SUBTEXT_BASE}>
          Ayuda a que los reclutadores puedan contactarte fácilmente.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <PhoneInputField
            value={phoneLocalValue}
            onChange={(val) =>
              setValue("phoneLocal", val, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            label="Teléfono"
            helperText="Guardamos el número en formato internacional para que puedan contactarte por WhatsApp o llamada."
          />
        </div>

        <div>
          <label className={LABEL_BASE}>Ubicación</label>
          <LocationAutocomplete
            value={locationValue}
            onChange={(v) =>
              setValue("location", v, { shouldValidate: true, shouldDirty: true })
            }
            countries={["mx"]}
            className={INPUT_BASE}
          />
        </div>
      </div>
    </section>
  );
}

function SectionNetworks() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ProfileFormData>();
  return (
    <section className={SECTION_CARD}>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Información adicional
        </h2>
        <p className={SUBTEXT_BASE}>
          Opcional, pero muy útil para que el reclutador conozca tu perfil completo.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_BASE}>Fecha de nacimiento</label>
          <input
            type="date"
            className={INPUT_BASE}
            {...register("birthdate")}
          />
        </div>
        <div>
          <label className={LABEL_BASE}>LinkedIn</label>
          <input
            className={INPUT_BASE}
            placeholder="https://www.linkedin.com/in/tu-perfil"
            {...register("linkedin")}
          />
          {errors.linkedin && (
            <p className="mt-1 text-xs text-red-500">
              {errors.linkedin.message}
            </p>
          )}
        </div>
        <div>
          <label className={LABEL_BASE}>GitHub</label>
          <input
            className={INPUT_BASE}
            placeholder="https://github.com/tu-usuario"
            {...register("github")}
          />
          {errors.github && (
            <p className="mt-1 text-xs text-red-500">
              {errors.github.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionCV({ initialResumeUrl }: { initialResumeUrl?: string }) {
  const { setValue } = useFormContext<ProfileFormData>();
  return (
    <section
      id="cv"
      className={`${SECTION_CARD} scroll-mt-24`}
    >
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Currículum
        </h2>
        <p className={SUBTEXT_BASE}>
          Sube tu CV en PDF, DOC o DOCX. Máx. 8&nbsp;MB.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <UploadCvButton
          onUploaded={(url) =>
            setValue("resumeUrl" as any, url, { shouldDirty: true })
          }
        />
        {initialResumeUrl ? (
          <a
            href={initialResumeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Ver CV actual
          </a>
        ) : (
          <span className={SUBTEXT_BASE}>
            Aún no has subido un CV.
          </span>
        )}
      </div>
    </section>
  );
}

function SectionExperience({
  expFA,
  register,
  setValue,
  experiences,
  makeCurrent,
}: {
  expFA: ReturnType<typeof useFieldArray<ProfileFormData>>;
  register: ReturnType<typeof useForm<ProfileFormData>>["register"];
  setValue: ReturnType<typeof useForm<ProfileFormData>>["setValue"];
  experiences: WorkExperience[];
  makeCurrent: (idx: number, checked: boolean) => void;
}) {
  return (
    <section
      id="experiencia"
      className={`${SECTION_CARD} scroll-mt-24`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Experiencia laboral
          </h2>
          <p className={SUBTEXT_BASE}>
            Agrega tus experiencias en orden cronológico. Puedes marcar una como actual.
          </p>
        </div>
        <button
          type="button"
          className="text-xs md:text-sm rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
          onClick={() =>
            expFA.append({
              role: "",
              company: "",
              startDate: "",
              endDate: "",
              isCurrent: false,
            })
          }
        >
          + Añadir experiencia
        </button>
      </div>

      {expFA.fields.length === 0 ? (
        <p className={SUBTEXT_BASE}>
          Aún no has agregado experiencia.
        </p>
      ) : (
        <div className="space-y-3">
          {expFA.fields.map((fItem, idx) => {
            const item = (experiences[idx] || {
              role: "",
              company: "",
              startDate: "",
              endDate: "",
              isCurrent: false,
            }) as WorkExperience;
            const isCurrent = !!item.isCurrent;

            return (
              <div
                key={fItem.id ?? `${idx}`}
                className="glass-card border border-zinc-200/70 dark:border-zinc-700/60 rounded-2xl p-4 md:p-6 space-y-3"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_BASE}>Puesto</label>
                    <input
                      className={INPUT_BASE}
                      placeholder="Ej. Desarrollador Frontend"
                      {...register(`experiences.${idx}.role` as const)}
                    />
                  </div>
                  <div>
                    <label className={LABEL_BASE}>Empresa</label>
                    <input
                      className={INPUT_BASE}
                      placeholder="Ej. Acme Inc."
                      {...register(`experiences.${idx}.company` as const)}
                    />
                  </div>
                  <div>
                    <label className={LABEL_BASE}>Inicio (YYYY-MM)</label>
                    <input
                      type="month"
                      className={INPUT_BASE}
                      {...register(`experiences.${idx}.startDate` as const)}
                    />
                  </div>
                  <div>
                    <label className={LABEL_BASE}>Fin (YYYY-MM)</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="month"
                        className={`${INPUT_BASE} disabled:cursor-not-allowed`}
                        disabled={isCurrent}
                        {...register(`experiences.${idx}.endDate` as const, {
                          onChange: (e) => {
                            if (String(e.target.value || "") === "") {
                              setValue(
                                `experiences.${idx}.endDate` as const,
                                null as any,
                                {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                }
                              );
                            }
                          },
                        })}
                      />
                      <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 text-emerald-600 shadow-sm focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900"
                          {...register(
                            `experiences.${idx}.isCurrent` as const,
                            {
                              onChange: (e) =>
                                makeCurrent(idx, e.target.checked),
                            }
                          )}
                        />
                        Actual
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                    onClick={() => expFA.remove(idx)}
                  >
                    Eliminar
                  </button>
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
  certifications,
  certQuery,
  setCertQuery,
  filteredCerts,
  addCert,
  removeCert,
}: {
  certifications: string[];
  certQuery: string;
  setCertQuery: (s: string) => void;
  filteredCerts: string[];
  addCert: (label: string) => void;
  removeCert: (label: string) => void;
}) {
  return (
    <section
      id="certs"
      className={`${SECTION_CARD} scroll-mt-24`}
    >
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Certificaciones
        </h2>
        <p className={SUBTEXT_BASE}>
          Agrega certificaciones relevantes (AWS, Azure, Scrum, ITIL, etc.).
        </p>
      </header>

      {certifications.length ? (
        <div className="flex flex-wrap gap-2">
          {certifications.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-100"
            >
              {c}
              <button
                type="button"
                onClick={() => removeCert(c)}
                className="ml-1 text-zinc-400 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className={SUBTEXT_BASE}>
          Aún no has agregado certificaciones.
        </p>
      )}

      <div className="relative">
        <input
          className={INPUT_BASE}
          placeholder="Ej. AWS SAA, CKA, ITIL Foundation…"
          value={certQuery}
          onChange={(e) => setCertQuery(e.target.value)}
        />
        {certQuery.trim().length > 0 && (
          <ul className="absolute z-10 mt-1 w-full glass-card rounded-2xl border border-zinc-200/80 bg-white/95 p-1 text-sm shadow-lg dark:border-zinc-700/70 dark:bg-zinc-900/95">
            {filteredCerts.length === 0 ? (
              <li className="px-3 py-2 text-xs text-zinc-500">
                Sin coincidencias
              </li>
            ) : (
              filteredCerts.map((opt) => (
                <li
                  key={opt}
                  className="cursor-pointer rounded-xl px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addCert(opt);
                  }}
                >
                  {opt}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

function SectionSkills({
  skillsDetailed,
  filteredSkillOptions,
  skillFA,
  pendingLevel,
  setPendingLevel,
  skillQuery,
  setSkillQuery,
  addSkillWithLevel,
  removeSkillWithLevel,
}: {
  skillsDetailed: any[];
  filteredSkillOptions: { id: string; label: string }[];
  skillFA: ReturnType<typeof useFieldArray<ProfileFormData>>;
  pendingLevel: number;
  setPendingLevel: (n: number) => void;
  skillQuery: string;
  setSkillQuery: (s: string) => void;
  addSkillWithLevel: (opt: { id: string; label: string }) => void;
  removeSkillWithLevel: (termId: string) => void;
}) {
  return (
    <section
      id="skills"
      className={`${SECTION_CARD} scroll-mt-24`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Skills técnicos
          </h2>
          <p className={SUBTEXT_BASE}>
            Agrega tus tecnologías clave y el nivel que dominas.
          </p>
        </div>
        <button
          type="button"
          className="text-xs md:text-sm rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
          onClick={() => {
            const first = filteredSkillOptions[0] || null;
            if (first) addSkillWithLevel(first);
          }}
        >
          + Añadir skill
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <input
            className={INPUT_BASE}
            placeholder="Ej. React, Node.js, AWS..."
            value={skillQuery}
            onChange={(e) => setSkillQuery(e.target.value)}
          />
          {skillQuery.trim().length > 0 && (
            <ul className="absolute z-10 mt-1 w-full glass-card rounded-2xl border border-zinc-200/80 bg-white/95 p-1 text-sm shadow-lg dark:border-zinc-700/70 dark:bg-zinc-900/95">
              {filteredSkillOptions.length === 0 ? (
                <li className="px-3 py-2 text-xs text-zinc-500">
                  Sin coincidencias
                </li>
              ) : (
                filteredSkillOptions.map((opt) => (
                  <li
                    key={opt.id}
                    className="cursor-pointer rounded-xl px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addSkillWithLevel(opt);
                    }}
                  >
                    {opt.label}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="w-full md:w-44">
          <label className={LABEL_BASE}>Nivel por defecto</label>
          <select
            className={INPUT_BASE}
            value={pendingLevel}
            onChange={(e) => setPendingLevel(parseInt(e.target.value, 10))}
            aria-label="Nivel del skill a agregar"
          >
            {SKILL_LEVELS.map((lvl) => (
              <option key={lvl.value} value={lvl.value}>
                {lvl.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {skillsDetailed.length === 0 ? (
        <p className={SUBTEXT_BASE}>
          Aún no has agregado skills.
        </p>
      ) : (
        <ul className="space-y-2">
          {skillsDetailed.map((s: any, idx: number) => (
            <li
              key={s.termId}
              className="flex flex-col items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/70 md:flex-row md:items-center"
            >
              <span className="flex-1 text-zinc-800 dark:text-zinc-50">
                {s.label}
              </span>
              <select
                className={`${INPUT_BASE} w-full md:w-40`}
                value={s.level}
                onChange={(e) =>
                  skillFA.update(idx, {
                    ...s,
                    level: parseInt(e.target.value, 10),
                  })
                }
              >
                {SKILL_LEVELS.map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-xs font-medium text-red-500 hover:text-red-600 md:ml-2"
                onClick={() => removeSkillWithLevel(s.termId)}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionLanguages({
  langFA,
  languages,
  languageOptions,
  handlePatchLang,
}: {
  langFA: ReturnType<typeof useFieldArray<ProfileFormData>>;
  languages: any[];
  languageOptions: { id: string; label: string }[];
  handlePatchLang: (idx: number, patch: Partial<{
    termId: string;
    label: string;
    level: any;
  }>) => void;
}) {
  return (
    <section
      id="languages"
      className={`${SECTION_CARD} scroll-mt-24`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Idiomas
          </h2>
          <p className={SUBTEXT_BASE}>
            Indica los idiomas que hablas y tu nivel de dominio.
          </p>
        </div>
        <button
          type="button"
          className="text-xs md:text-sm rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
          onClick={() =>
            langFA.append({
              termId: languageOptions[0]?.id || "",
              label: languageOptions[0]?.label || "",
              level: "CONVERSATIONAL",
            })
          }
        >
          + Añadir idioma
        </button>
      </div>

      {langFA.fields.length === 0 ? (
        <p className={SUBTEXT_BASE}>
          Aún no has agregado idiomas.
        </p>
      ) : (
        <div className="space-y-3">
          {langFA.fields.map((f, idx) => {
            const item =
              languages[idx] || {
                termId: "",
                label: "",
                level: "CONVERSATIONAL",
              };
            return (
              <div
                key={f.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/70 md:flex-row md:items-center"
              >
                <select
                  className={`${INPUT_BASE} flex-1`}
                  value={item.termId}
                  onChange={(e) => {
                    const term = languageOptions.find(
                      (o) => o.id === e.target.value
                    );
                    handlePatchLang(idx, {
                      termId: term?.id || "",
                      label: term?.label || "",
                    });
                  }}
                >
                  <option value="">Selecciona idioma</option>
                  {languageOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  className={`${INPUT_BASE} w-full md:w-56`}
                  value={item.level}
                  onChange={(e) =>
                    handlePatchLang(idx, { level: e.target.value as any })
                  }
                >
                  {LANGUAGE_LEVELS.map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>
                      {lvl.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => langFA.remove(idx)}
                  className="text-xs font-medium text-red-500 hover:text-red-600 md:ml-2"
                >
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SectionEducation({
  eduFA,
  addEducation,
  moveEducation,
}: {
  eduFA: ReturnType<typeof useFieldArray<ProfileFormData>>;
  addEducation: () => void;
  moveEducation: (from: number, to: number) => void;
}) {
  const { register } = useFormContext<ProfileFormData>();
  return (
    <section
      id="education"
      className={`${SECTION_CARD} scroll-mt-24`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Educación
          </h2>
          <p className={SUBTEXT_BASE}>
            Agrega tus estudios más relevantes. Puedes cambiar el orden.
          </p>
        </div>
        <button
          type="button"
          className="text-xs md:text-sm rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
          onClick={addEducation}
        >
          + Añadir educación
        </button>
      </div>

      {eduFA.fields.length === 0 ? (
        <p className={SUBTEXT_BASE}>
          Aún no has agregado educación.
        </p>
      ) : (
        <div className="space-y-4">
          {eduFA.fields.map((f, idx) => {
            return (
              <div
                key={f.id}
                className="glass-card border border-zinc-200/70 dark:border-zinc-700/60 rounded-2xl p-4 md:p-6 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Entrada #{idx + 1}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-[11px] rounded-lg border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                      onClick={() => moveEducation(idx, idx - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-[11px] rounded-lg border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                      onClick={() => moveEducation(idx, idx + 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-[11px] rounded-lg border border-red-200 px-2 py-1 text-red-500 hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/50"
                      onClick={() => eduFA.remove(idx)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_BASE}>Nivel</label>
                    <select
                      className={INPUT_BASE}
                      {...register(`education.${idx}.level` as const)}
                    >
                      <option value="">—</option>
                      {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_BASE}>Institución *</label>
                    <input
                      className={INPUT_BASE}
                      {...register(`education.${idx}.institution` as const)}
                    />
                  </div>

                  <div>
                    <label className={LABEL_BASE}>Programa</label>
                    <input
                      className={INPUT_BASE}
                      placeholder="Ej. Ingeniería en Sistemas"
                      {...register(`education.${idx}.program` as const)}
                    />
                  </div>

                  <div>
                    <label className={LABEL_BASE}>Inicio</label>
                    <input
                      type="month"
                      className={INPUT_BASE}
                      {...register(`education.${idx}.startDate` as const)}
                    />
                  </div>
                  <div>
                    <label className={LABEL_BASE}>Fin</label>
                    <input
                      type="month"
                      className={INPUT_BASE}
                      {...register(`education.${idx}.endDate` as const)}
                    />
                    <p className={SUBTEXT_BASE}>
                      Déjalo vacío si sigues cursando (se marcará como “en
                      curso”).
                    </p>
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
