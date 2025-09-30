// app/profile/ProfileForm.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch, useFieldArray, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import AutocompleteInput from "@/components/AutocompleteInput";
import { PhoneNumberUtil } from "google-libphonenumber";
import { toastPromise } from "@/lib/ui/toast";
import UploadCvButton from "@/components/upload/UploadCvButton";
import WorkExperienceCard, { WorkExperience, WorkExperienceErrors } from "@/components/WorkExperienceCard";
import LanguageRow, { LanguageItem } from "@/components/LanguageRow";
import { LANGUAGE_LEVELS } from "@/lib/skills";

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
  skills?: string[];
  certifications?: string[];
  experiences?: Array<WorkExperience>;
  languages?: Array<LanguageItem>;
};

type LanguageOption = { id: string; label: string };

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

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const toMonthStartDate = (ym: string): Date | null => {
  if (!MONTH_RE.test(ym)) return null;
  return new Date(`${ym}-01T00:00:00.000Z`);
};

const ExperienceSchema = z.object({
  role: z.string().min(2, "Rol requerido"),
  company: z.string().min(2, "Empresa requerida"),
  startDate: z.string().regex(MONTH_RE, "Formato inválido (YYYY-MM)"),
  endDate: z.string().regex(MONTH_RE, "Formato inválido (YYYY-MM)").optional().nullable(),
  isCurrent: z.boolean().optional().default(false),
}).refine(
  (v) => {
    if (v.isCurrent) return !v.endDate;
    if (!v.endDate) return false;
    const s = toMonthStartDate(v.startDate);
    const e = toMonthStartDate(v.endDate);
    return !!(s && e && s.getTime() <= e.getTime());
  },
  { message: "Rango de fechas inválido", path: ["endDate"] }
);

const LanguageSchema = z.object({
  termId: z.string().min(0), // puede quedar vacío si es texto libre
  label: z.string().min(1),
  level: z.enum(["NATIVE", "PROFESSIONAL", "CONVERSATIONAL", "BASIC"]),
});

const ProfileFormSchema = z.object({
  firstName: z.string().min(2, "Nombre requerido"),
  lastName1: z.string().min(2, "Apellido paterno requerido"),
  lastName2: z.string().optional(),
  location: z.string().min(2, "Ubicación requerida"),
  birthdate: z.string().optional(),
  linkedin: z.string().url("URL inválida").optional().or(z.literal("")),
  github: z.string().url("URL inválida").optional().or(z.literal("")),
  phoneCountry: z.string().default("52"),
  phoneLocal: z.string().optional(),
  skills: z.array(z.string()).optional().default([]),
  certifications: z.array(z.string()).optional().default([]),
  experiences: z.array(ExperienceSchema).optional().default([]),
  languages: z.array(LanguageSchema).optional().default([]),
});
type FormDataShape = z.infer<typeof ProfileFormSchema>;

export default function ProfileForm({
  initial,
  skillsOptions,
  certOptions,
  languageOptions,
  onSubmit,
}: {
  initial: Initial;
  skillsOptions: string[];
  certOptions: string[];
  languageOptions: LanguageOption[];
  onSubmit: (fd: FormData) => Promise<any>;
}) {
  const methods = useForm<FormDataShape>({
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
      skills: initial.skills ?? [],
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
      skills: initial.skills ?? [],
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
    });
  }, [initial, reset]);

  // Field arrays
  const expFA  = useFieldArray({ control, name: "experiences" });
  const langFA = useFieldArray({ control, name: "languages" });

  const experiences   = useWatch({ control, name: "experiences" }) || [];
  const languages     = useWatch({ control, name: "languages" }) || [];
  const skills        = useWatch({ control, name: "skills" }) || [];
  const certifications= useWatch({ control, name: "certifications" }) || [];

  // Helpers chips
  const addCI = (arr: string[], value: string) => {
    const v = (value ?? "").trim();
    if (!v) return arr;
    const exists = arr.some((x) => x.toLowerCase() === v.toLowerCase());
    return exists ? arr : [...arr, v];
  };
  const removeCI = (arr: string[], value: string) =>
    arr.filter((x) => x.toLowerCase() !== (value ?? "").toLowerCase());

  function addSkill(s: string) {
    setValue("skills", addCI(skills, s), { shouldValidate: true });
  }
  function removeSkill(s: string) {
    setValue("skills", removeCI(skills, s), { shouldValidate: true });
  }
  function addCert(s: string) {
    setValue("certifications", addCI(certifications, s), { shouldValidate: true });
  }
  function removeCert(s: string) {
    setValue("certifications", removeCI(certifications, s), { shouldValidate: true });
  }

  const [resumeUrl, setResumeUrl] = useState<string>(initial.resumeUrl || "");

  function hasOverlaps(rows: Array<{ startDate: string; endDate?: string | null }>) {
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
  }

  const onSubmitRHF = async (vals: FormDataShape) => {
    clearErrors("root");

    let phoneE164: string | null = null;
    if ((vals.phoneLocal || "").trim()) {
      phoneE164 = buildE164(vals.phoneCountry || "52", vals.phoneLocal || "");
      if (!phoneE164) {
        setError("root", { type: "manual", message: "Número de teléfono inválido." });
        return;
      }
    }

    const exps = vals.experiences || [];
    const currentCount = exps.filter((e) => e.isCurrent).length;
    if (currentCount > 1) {
      setError("root", { type: "manual", message: "Solo puedes marcar una experiencia como 'Actual'." });
      return;
    }
    if (hasOverlaps(
      exps.map((e) => ({
        startDate: e.startDate,
        endDate: e.isCurrent ? null : e.endDate || null,
      }))
    )) {
      setError("root", { type: "manual", message: "Tus experiencias no pueden traslaparse." });
      return;
    }

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
    fd.set("skills", (vals.skills || []).join(", "));
    fd.set("certifications", (vals.certifications || []).join(", "));
    fd.set("experiences", JSON.stringify(exps));            // YYYY-MM
    fd.set("languages", JSON.stringify(vals.languages||[])); // idiomas + nivel
    if (resumeUrl) fd.set("resumeUrl", resumeUrl);

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

  const phoneCountry = useWatch({ control, name: "phoneCountry" });
  const isMX = phoneCountry === "52";
  const [skillQuery, setSkillQuery] = useState("");
  const [certQuery, setCertQuery] = useState("");

  // EXPERIENCIAS: se mantiene igual
  const handlePatchExp = useCallback((idx: number, patch: Partial<WorkExperience>) => {
    const curr = (experiences[idx] || {}) as WorkExperience;
    expFA.update(idx, { ...curr, ...patch }); // ← usa update del fieldArray
  }, [experiences, expFA]);

  const handleMakeCurrent = useCallback((idx: number, checked: boolean) => {
    const next = (experiences as WorkExperience[]).map((e, i) => ({
      ...e,
      isCurrent: i === idx ? checked : false,
      endDate: i === idx && checked ? null : e.endDate ?? "",
    }));
    // aplicamos todos en bloque respetando ids
    next.forEach((row, i) => expFA.update(i, row));
  }, [experiences, expFA]);

  // 👇👇 IDIOMAS: **usar langFA.update** en lugar de setValue("languages", …)
  const handlePatchLang = useCallback((idx: number, patch: Partial<LanguageItem>) => {
    const curr = (languages[idx] || { termId: "", label: "", level: "CONVERSATIONAL" }) as LanguageItem;
    langFA.update(idx, { ...curr, ...patch });
  }, [languages, langFA]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmitRHF)} className="space-y-8" encType="multipart/form-data">
        {/* Datos personales */}
        <section className="grid md:grid-cols-3 gap-4">
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
        <section className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Teléfono</label>
            <div className="flex gap-2">
              <select className="border rounded-xl p-3 w-40" {...register("phoneCountry")}>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={`${c.code}-${c.dial}`} value={c.dial}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                className="border rounded-xl p-3 flex-1"
                placeholder={isMX ? "10 dígitos (solo números)" : "solo números"}
                {...register("phoneLocal", {
                  onChange: (e) => {
                    const digits = String(e.target.value).replace(/\D+/g, "");
                    e.target.value = digits.slice(0, 15);
                  },
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
              openOnFocus={false}
              minChars={3}
              debounceMs={350}
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
        <section className="grid gap-2">
          <label className="text-sm">Currículum (PDF/DOC/DOCX)</label>
          <div className="flex flex-wrap items-center gap-3">
            <UploadCvButton onUploaded={(url) => setResumeUrl(url)} />
            {resumeUrl ? (
              <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                Ver CV actual
              </a>
            ) : (
              <span className="text-xs text-zinc-500">Aún no has subido un CV.</span>
            )}
          </div>
        </section>

        {/* Skills */}
        <section className="space-y-2">
          <label className="text-sm font-semibold">Skills</label>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded-full px-2 py-1">
                {s}
                <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-600">×</button>
              </span>
            ))}
          </div>
          <AutocompleteInput
            query={skillQuery}
            setQuery={setSkillQuery}
            options={skillsOptions}
            onPick={(s) => { addSkill(s); setSkillQuery(""); }}
            placeholder="Ej. Python, AWS, React..."
          />
        </section>

        {/* Certificaciones */}
        <section className="space-y-2">
          <label className="text-sm font-semibold">Certificaciones</label>
          <div className="flex flex-wrap gap-2">
            {certifications.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded-full px-2 py-1">
                {c}
                <button type="button" onClick={() => removeCert(c)} className="hover:text-red-600">×</button>
              </span>
            ))}
          </div>
          <AutocompleteInput
            query={certQuery}
            setQuery={setCertQuery}
            options={certOptions}
            onPick={(s) => { addCert(s); setCertQuery(""); }}
            placeholder="Ej. AWS SAA, CCNA..."
          />
        </section>

        {/* Idiomas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Idiomas</label>
            <button
              type="button"
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() =>
                langFA.append({
                  termId: "",
                  label: "",
                  level: LANGUAGE_LEVELS[2].value, // Conversacional
                })
              }
            >
              + Añadir idioma
            </button>
          </div>

          {langFA.fields.length === 0 ? (
            <p className="text-xs text-zinc-500">Aún no has agregado idiomas.</p>
          ) : (
            <div className="space-y-3">
              {langFA.fields.map((f, idx) => {
                const item = (languages[idx] || { termId: "", label: "", level: "CONVERSATIONAL" }) as LanguageItem;
                return (
                  <LanguageRow
                    key={f.id}
                    idx={idx}
                    item={item}
                    options={languageOptions}
                    onChange={handlePatchLang}   // <- usa langFA.update internamente
                    onRemove={langFA.remove}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Historial de trabajo */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Historial de trabajo</label>
            <button
              type="button"
              className="text-sm border rounded-lg px-3 py-1 hover:bg-gray-50"
              onClick={() =>
                expFA.append({ role: "", company: "", startDate: "", endDate: "", isCurrent: false })
              }
            >
              + Añadir experiencia
            </button>
          </div>

          {expFA.fields.length === 0 ? (
            <p className="text-xs text-zinc-500">Aún no has agregado experiencias.</p>
          ) : (
            <div className="space-y-4">
              {expFA.fields.map((f, idx) => {
                const exp = (experiences[idx] || {}) as WorkExperience;
                const fieldErr = errors.experiences?.[idx] as any as WorkExperienceErrors | undefined;
                return (
                  <WorkExperienceCard
                    key={f.id}
                    idx={idx}
                    exp={exp}
                    error={{
                      role: fieldErr?.role as any,
                      company: fieldErr?.company as any,
                      startDate: fieldErr?.startDate as any,
                      endDate: fieldErr?.endDate as any,
                    }}
                    onChange={handlePatchExp}
                    onRemove={expFA.remove}
                    onMakeCurrent={handleMakeCurrent}
                  />
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
