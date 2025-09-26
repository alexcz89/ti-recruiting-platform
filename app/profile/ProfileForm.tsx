// app/profile/ProfileForm.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { PhoneNumberUtil } from "google-libphonenumber";
import { toast } from "sonner";

// --------- Tipos / Props ----------
type Initial = {
  firstName: string;
  lastName1: string;
  lastName2: string;
  email: string;
  phoneCountry: string; // ej "52"
  phoneLocal: string;   // ej "8112345678"
  location: string;
  birthdate: string;
  linkedin: string;
  github: string;
  resumeUrl: string;
  skills?: string[];
  certifications?: string[];
};

export default function ProfileForm({
  initial,
  skillsOptions,
  certOptions,
  onSubmit,
}: {
  initial: Initial;
  skillsOptions: string[];
  certOptions: string[];
  onSubmit: (fd: FormData) => Promise<any>;
}) {
  // ---------- PHONE helpers ----------
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

  // ---------- Países para teléfono ----------
  function buildCountryOptions() {
    const regions = Array.from(phoneUtil.getSupportedRegions()); // ['MX','US',...]
    const mapped = regions.map((iso) => {
      const dial = String(phoneUtil.getCountryCodeForRegion(iso));
      return { code: iso, dial, label: `${iso} (+${dial})` };
    });
    const mx = mapped.find((c) => c.code === "MX");
    const rest = mapped.filter((c) => c.code !== "MX").sort((a, b) => a.code.localeCompare(b.code));
    return mx ? [mx, ...rest] : rest;
  }
  const COUNTRY_OPTIONS = useMemo(buildCountryOptions, []);

  // ---------- Zod schema (cliente) ----------
  const ProfileFormSchema = z.object({
    firstName: z.string().min(2, "Nombre requerido"),
    lastName1: z.string().min(2, "Apellido paterno requerido"),
    lastName2: z.string().optional(),
    location: z.string().min(2, "Ubicación requerida"),
    birthdate: z.string().optional(), // la parsea el servidor si hace falta
    linkedin: z.string().url("URL inválida").optional().or(z.literal("")),
    github: z.string().url("URL inválida").optional().or(z.literal("")),
    phoneCountry: z.string().default("52"),
    phoneLocal: z.string().optional(), // validamos E.164 más abajo (libphonenumber)
    skills: z.array(z.string()).optional().default([]),
    certifications: z.array(z.string()).optional().default([]),
  });

  type FormDataShape = z.infer<typeof ProfileFormSchema>;

  // ---------- RHF ----------
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
    control,
    reset,
  } = useForm<FormDataShape>({
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
      skills: Array.isArray(initial.skills) ? initial.skills : [],
      certifications: Array.isArray(initial.certifications) ? initial.certifications : [],
    },
  });

  // sincroniza si cambian las props (SSR→CSR)
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
      skills: Array.isArray(initial.skills) ? initial.skills : [],
      certifications: Array.isArray(initial.certifications) ? initial.certifications : [],
    });
  }, [initial, reset]);

  // ---------- Skills & Certs helpers ----------
  const skills = useWatch({ control, name: "skills" }) || [];
  const certifications = useWatch({ control, name: "certifications" }) || [];

  const addCI = (arr: string[], value: string) => {
    const v = value.trim();
    if (!v) return arr;
    const exists = arr.some((x) => x.toLowerCase() === v.toLowerCase());
    return exists ? arr : [...arr, v];
  };
  const removeCI = (arr: string[], value: string) =>
    arr.filter((x) => x.toLowerCase() !== value.toLowerCase());

  // Skills search UI
  const [skillQuery, setSkillQuery] = useState("");
  const skillListRef = useRef<HTMLDivElement | null>(null);
  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    if (!q) return skillsOptions.slice(0, 20);
    return skillsOptions.filter((s) => s.toLowerCase().includes(q)).slice(0, 30);
  }, [skillQuery, skillsOptions]);

  function addSkill(s: string) {
    setValue("skills", addCI(skills, s), { shouldValidate: true });
  }
  function removeSkill(s: string) {
    setValue("skills", removeCI(skills, s), { shouldValidate: true });
  }
  function handleSkillsKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "Tab") && skillQuery.trim()) {
      e.preventDefault();
      const suggestion = filteredSkills[0];
      addSkill(suggestion || skillQuery.trim());
      setSkillQuery("");
    }
  }

  // Certs search UI
  const [certQuery, setCertQuery] = useState("");
  const certListRef = useRef<HTMLDivElement | null>(null);
  const filteredCerts = useMemo(() => {
    const q = certQuery.trim().toLowerCase();
    if (!q) return certOptions.slice(0, 20);
    return certOptions.filter((s) => s.toLowerCase().includes(q)).slice(0, 30);
  }, [certQuery, certOptions]);

  function addCert(s: string) {
    setValue("certifications", addCI(certifications, s), { shouldValidate: true });
  }
  function removeCert(s: string) {
    setValue("certifications", removeCI(certifications, s), { shouldValidate: true });
  }
  function handleCertsKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "Tab") && certQuery.trim()) {
      e.preventDefault();
      const suggestion = filteredCerts[0];
      addCert(suggestion || certQuery.trim());
      setCertQuery("");
    }
  }

  // Archivo de CV
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Submit
  const onSubmitRHF = async (vals: FormDataShape) => {
    clearErrors("root");

    // Validación de teléfono con libphonenumber (si se proporcionó)
    let phoneE164: string | null = null;
    if (vals.phoneLocal?.trim()) {
      phoneE164 = buildE164(vals.phoneCountry || "52", vals.phoneLocal || "");
      if (!phoneE164) {
        setError("phoneLocal", { type: "manual", message: "Número inválido para el país seleccionado" });
        return;
      }
    }

    const fd = new FormData();
    fd.set("firstName", vals.firstName ?? "");
    fd.set("lastName1", vals.lastName1 ?? "");
    fd.set("lastName2", vals.lastName2 ?? "");
    fd.set("location", vals.location ?? "");
    fd.set("birthdate", vals.birthdate ?? "");
    fd.set("linkedin", vals.linkedin ?? "");
    fd.set("github", vals.github ?? "");

    // Teléfono
    fd.set("phone", phoneE164 || "");
    fd.set("phoneCountry", vals.phoneCountry || "52");
    fd.set("phoneLocal", (vals.phoneLocal || "").replace(/\D+/g, ""));

    // Skills & Certs
    fd.set("skills", (vals.skills || []).join(", "));
    fd.set("certifications", (vals.certifications || []).join(", "));

    // CV (archivo opcional) o URL actual
    if (resumeFile) {
      fd.set("resume", resumeFile);
    } else if (initial.resumeUrl) {
      fd.set("resumeUrl", initial.resumeUrl);
    }

    const res = await onSubmit(fd);
    if (res?.error) {
      setError("root", { type: "server", message: res.error });
      toast.error(res.error);
      return;
    }
    toast.success("Perfil actualizado");
    // el servidor puede redirigir a /profile/summary
  };

  const phoneCountry = useWatch({ control, name: "phoneCountry" });
  const isMX = phoneCountry === "52";

  return (
    <form onSubmit={handleSubmit(onSubmitRHF)} className="space-y-6" encType="multipart/form-data">
      {/* Nombre separado */}
      <section className="grid md:grid-cols-3 gap-3">
        <div className="grid gap-1">
          <label className="text-sm">Nombre(s) *</label>
          <input className="border rounded-xl p-3" {...register("firstName")} />
          {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
        </div>
        <div className="grid gap-1">
          <label className="text-sm">Apellido paterno *</label>
          <input className="border rounded-xl p-3" {...register("lastName1")} />
          {errors.lastName1 && <p className="text-xs text-red-600">{errors.lastName1.message}</p>}
        </div>
        <div className="grid gap-1">
          <label className="text-sm">Apellido materno</label>
          <input className="border rounded-xl p-3" {...register("lastName2")} />
        </div>
      </section>

      {/* Datos básicos */}
      <section className="grid md:grid-cols-2 gap-3">
        {/* Teléfono */}
        <div className="grid gap-1">
          <label className="text-sm">Teléfono</label>
          <div className="flex gap-2">
            <select
              className="border rounded-xl p-3 w-44"
              {...register("phoneCountry")}
              title="LADA / Código de país"
              autoComplete="tel-country-code"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={`${c.code}-${c.dial}`} value={c.dial}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              type="tel"
              className="border rounded-xl p-3 flex-1"
              placeholder={isMX ? "10 dígitos (solo números)" : "solo dígitos"}
              {...register("phoneLocal", {
                onChange: (e) => {
                  const digits = e.target.value.replace(/\D+/g, "");
                  e.target.value = digits.slice(0, 15);
                },
              })}
              inputMode="numeric"
              autoComplete="tel-national"
            />
          </div>
          {errors.phoneLocal && <p className="text-xs text-red-600">{errors.phoneLocal.message}</p>}
          <p className="text-xs text-zinc-500">
            Guardamos tu teléfono en formato internacional (E.164) para que funcione en WhatsApp.
          </p>
        </div>

        {/* Ubicación con autocomplete */}
        <div className="grid gap-1">
          <label className="text-sm">Ubicación</label>
          <LocationAutocomplete
            value={useWatch({ control, name: "location" }) || ""}
            onChange={(v) => setValue("location", v, { shouldValidate: true })}
            countries={["mx"]}
            className="border rounded-xl p-3 w-full"
            placeholder="Ciudad (ej. CDMX, Monterrey) o Remoto"
          />
          {errors.location && <p className="text-xs text-red-600">{errors.location.message}</p>}
        </div>

        <div className="grid gap-1">
          <label className="text-sm">Fecha de nacimiento</label>
          <input type="date" className="border rounded-xl p-3" {...register("birthdate")} />
        </div>

        <div className="grid gap-1">
          <label className="text-sm">LinkedIn</label>
          <input
            className="border rounded-xl p-3"
            placeholder="https://www.linkedin.com/in/tu-perfil"
            {...register("linkedin")}
          />
          {errors.linkedin && <p className="text-xs text-red-600">{errors.linkedin.message}</p>}
        </div>

        <div className="grid gap-1">
          <label className="text-sm">GitHub</label>
          <input
            className="border rounded-xl p-3"
            placeholder="https://github.com/tu-usuario"
            {...register("github")}
          />
          {errors.github && <p className="text-xs text-red-600">{errors.github.message}</p>}
        </div>

        {/* CV */}
        <div className="grid gap-1 md:col-span-2">
          <label className="text-sm">Currículum (PDF/DOC/DOCX)</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            />
            {initial.resumeUrl ? (
              <a
                href={initial.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline"
                title="Ver CV actual"
              >
                Ver CV actual
              </a>
            ) : (
              <span className="text-xs text-zinc-500">Aún no has subido un CV.</span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Si eliges un archivo, reemplazará el CV actual. También puedes dejarlo en blanco para mantenerlo.
          </p>
        </div>
      </section>

      {/* Skills */}
      <section className="grid gap-2">
        <label className="text-sm font-semibold">Skills / Tecnologías (opcional)</label>

        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded-full px-2 py-1">
                {s}
                <button type="button" aria-label={`Quitar ${s}`} className="hover:text-red-600" onClick={() => removeSkill(s)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Aún no has agregado skills.</p>
        )}

        <SkillSearchInput
          query={skillQuery}
          setQuery={setSkillQuery}
          listRef={skillListRef}
          results={filteredSkills}
          onPick={(s) => {
            addSkill(s);
            setSkillQuery("");
          }}
          onKeyDown={handleSkillsKeyDown}
          placeholder="Busca y selecciona (ej. Python, AWS, React Native...)"
        />
      </section>

      {/* Certificaciones */}
      <section className="grid gap-2">
        <label className="text-sm font-semibold">Certificaciones (opcional)</label>

        {certifications.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {certifications.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs bg-gray-100 border rounded-full px-2 py-1">
                {s}
                <button type="button" aria-label={`Quitar ${s}`} className="hover:text-red-600" onClick={() => removeCert(s)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Aún no has agregado certificaciones.</p>
        )}

        <SkillSearchInput
          query={certQuery}
          setQuery={setCertQuery}
          listRef={certListRef}
          results={filteredCerts}
          onPick={(s) => {
            addCert(s);
            setCertQuery("");
          }}
          onKeyDown={handleCertsKeyDown}
          placeholder="Busca y selecciona (ej. AWS SAA, CCNA, Scrum Master...)"
        />
      </section>

      {errors.root?.message && (
        <div className="border border-red-300 bg-red-50 text-red-700 text-sm rounded-xl px-3 py-2">
          {errors.root.message}
        </div>
      )}

      <button disabled={isSubmitting} className="border rounded-xl px-4 py-2">
        {isSubmitting ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

/** Input + lista reutilizable para skills/certs */
function SkillSearchInput({
  query,
  setQuery,
  listRef,
  results,
  onPick,
  onKeyDown,
  placeholder,
}: {
  query: string;
  setQuery: (s: string) => void;
  listRef: React.MutableRefObject<HTMLDivElement | null>;
  results: string[];
  onPick: (s: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        className="w-full border rounded-xl p-3"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={!!query}
        aria-controls="skills-suggestions"
      />
      {query && (
        <div
          ref={listRef}
          id="skills-suggestions"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-white shadow"
          role="listbox"
        >
          {results.length === 0 ? (
            <div className="p-3 text-sm text-zinc-500">Sin resultados</div>
          ) : (
            results.map((s) => (
              <button
                type="button"
                key={s}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => onPick(s)}
                role="option"
              >
                {s}
              </button>
            ))
          )}
        </div>
      )}
      <p className="text-xs text-zinc-500 mt-1">
        Escribe para buscar y presiona Enter/Tab o haz clic en una sugerencia para agregarla.
      </p>
    </div>
  );
}
