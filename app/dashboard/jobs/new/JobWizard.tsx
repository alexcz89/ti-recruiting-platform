// app/dashboard/jobs/new/JobWizard.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import clsx from "clsx";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { createStringFuse, searchStrings } from "@/lib/search/fuse";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type PresetCompany = { id: string | null; name: string | null };

// ➕ Tipo de plantilla mínima (vacantes anteriores)
type TemplateJob = {
  id: string;
  title?: string;
  locationType?: "REMOTE" | "HYBRID" | "ONSITE";
  // Ubicación
  city?: string | null;
  country?: string | null;
  admin1?: string | null;
  cityNorm?: string | null;
  admin1Norm?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;

  currency?: "MXN" | "USD";
  salaryMin?: number | null;
  salaryMax?: number | null;
  showSalary?: boolean | null;
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  schedule?: string | null;
  benefitsJson?: any | null;
  description?: string | null;
  education?: Array<{ name: string; required: boolean }> | null;
  minDegree?: DegreeLevel | null;
  skills?: Array<{ name: string; required: boolean }> | null;
  certs?: string[] | null;
};

type Props = {
  onSubmit: (fd: FormData) => Promise<any>;
  presetCompany: PresetCompany;
  skillsOptions: string[];
  certOptions: string[];
  templates?: TemplateJob[];
  initial?: {
    id?: string;
    // Paso 1
    title?: string;
    companyMode?: "own" | "other" | "confidential";
    companyOtherName?: string;
    locationType?: "REMOTE" | "HYBRID" | "ONSITE";
    // Ubicación estructurada
    city?: string;
    country?: string | null;
    admin1?: string | null;
    cityNorm?: string | null;
    admin1Norm?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;

    currency?: "MXN" | "USD";
    salaryMin?: number | string | null;
    salaryMax?: number | string | null;
    showSalary?: boolean;
    // Paso 2
    employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
    schedule?: string;
    // Paso 3
    showBenefits?: boolean;
    benefitsJson?: Record<string, any>;
    // Paso 4
    description?: string;
    responsibilities?: string; // legacy
    education?: Array<{ name: string; required: boolean }>;
    minDegree?: DegreeLevel;
    // Paso 4 (skills/certs)
    skills?: Array<{ name: string; required: boolean }>;
    certs?: string[];
  };
};

type LocationType = "REMOTE" | "HYBRID" | "ONSITE";
type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
type Currency = "MXN" | "USD";
type DegreeLevel = "HIGHSCHOOL" | "TECH" | "BACHELOR" | "MASTER" | "PHD";

const BENEFITS = [
  { key: "aguinaldo", label: "Aguinaldo", def: true },
  { key: "vacaciones", label: "Vacaciones", def: true },
  { key: "primaVac", label: "Prima vacacional", def: true },
  { key: "utilidades", label: "Utilidades", def: true },
  { key: "bonos", label: "Bonos", def: false },
  { key: "vales", label: "Vales de despensa", def: false },
  { key: "fondoAhorro", label: "Fondo de ahorro", def: false },
  { key: "combustible", label: "Combustible", def: false },
  { key: "comedor", label: "Comedor subsidiado", def: false },
  { key: "celular", label: "Celular", def: false },
  { key: "sgmm", label: "SGMM", def: false },
  { key: "vida", label: "Seguro de vida", def: false },
  { key: "auto", label: "Automóvil", def: false },
  { key: "otros", label: "Otros", def: false },
];

const reviewBox =
  "mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words break-all rounded border bg-gray-50 p-2";

// Sugerencias rápidas para Educación
const EDUCATION_SUGGESTIONS = [
  "Ingeniería en Sistemas",
  "Ingeniería en Tecnologías Computacionales",
  "Ingeniería en Robótica",
  "Licenciatura en Informática",
  "Licenciatura en Ciencias de la Computación",
  "Maestría en Tecnologías de Información",
  "Maestría en Ciencia de Datos",
  "MBA con enfoque en TI",
  "Técnico en Programación",
  "Técnico en Redes",
];

/* ---------------------------
   Utils de enriquecimiento
----------------------------*/
const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Sugerir skills/educación desde un texto cruzando catálogos */
function suggestFromText({
  text,
  skillsCatalog = [],
  educationCatalog = [],
}: {
  text: string;
  skillsCatalog?: string[];
  educationCatalog?: string[];
}) {
  const hay = norm(text)
    .split(/[^a-z0-9#+.]/gi)
    .filter(Boolean);

  const matchList = (catalog: string[]) =>
    catalog.filter((item) => {
      const tokens = norm(item).split(/\s+/);
      return tokens.every((t) => hay.some((w) => w.includes(t)));
    });

  return {
    skills: matchList(skillsCatalog).slice(0, 12),
    education: matchList(educationCatalog).slice(0, 8),
  };
}

/** Ring de progreso de caracteres */
function CharProgress({ current, min = 50 }: { current: number; min?: number }) {
  const pct = Math.min(100, Math.round((current / min) * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="relative h-5 w-5">
        <svg viewBox="0 0 36 36" className="h-5 w-5">
          <path
            className="text-zinc-200"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32"
          />
          <path
            className={pct >= 100 ? "text-emerald-500" : "text-zinc-400"}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${pct}, 100`}
            d="M18 2 a16 16 0 1 1 0 32 a16 16 0 1 1 0 -32"
          />
        </svg>
      </div>
      <span className={pct >= 100 ? "text-emerald-600" : "text-zinc-500"}>
        {current} / {min}
      </span>
    </div>
  );
}

export default function JobWizard({
  onSubmit,
  presetCompany,
  skillsOptions,
  certOptions,
  templates = [],
  initial,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState(1);

  // ---------- Paso 1 ----------
  const [title, setTitle] = useState("");
  const [companyMode, setCompanyMode] = useState<"own" | "confidential">(
    presetCompany?.id ? "own" : "confidential"
  );
  const [companyOtherName, setCompanyOtherName] = useState("");

  const [locationType, setLocationType] = useState<LocationType>("ONSITE");
  const [city, setCity] = useState(""); // etiqueta legible

  // ➕ Ubicación estructurada
  const [country, setCountry] = useState<string>("");
  const [admin1, setAdmin1] = useState<string>("");
  const [cityNorm, setCityNorm] = useState<string>("");
  const [admin1Norm, setAdmin1Norm] = useState<string>("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);

  const [currency, setCurrency] = useState<Currency>("MXN");
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [showSalary, setShowSalary] = useState(false);

  // ➕ Plantilla seleccionada
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // ---------- Paso 2 ----------
  const [employmentType, setEmploymentType] = useState<EmploymentType>("FULL_TIME");
  const [schedule, setSchedule] = useState("");

  // ---------- Paso 3 ----------
  const [showBenefits, setShowBenefits] = useState(true);
  const [benefits, setBenefits] = useState<Record<string, boolean>>(
    BENEFITS.reduce((acc, b) => ((acc[b.key] = b.def), acc), {} as Record<string, boolean>)
  );
  const [aguinaldoDias, setAguinaldoDias] = useState<number>(15);
  const [vacacionesDias, setVacacionesDias] = useState<number>(12);
  const [primaVacPct, setPrimaVacPct] = useState<number>(25);

  // ---------- Paso 4 ----------
  const [description, setDescription] = useState("");
  // EDUCACIÓN
  const [minDegree, setMinDegree] = useState<DegreeLevel>("BACHELOR");
  const [educationQuery, setEducationQuery] = useState("");
  const [educationAddAsRequired, setEducationAddAsRequired] = useState(true);
  const [education, setEducation] = useState<Array<{ name: string; required: boolean }>>([]);

  // Skills
  const [skillQuery, setSkillQuery] = useState("");
  const [addAsRequired, setAddAsRequired] = useState(true);
  const [skills, setSkills] = useState<Array<{ name: string; required: boolean }>>([]);

  // Certs
  const [certQuery, setCertQuery] = useState("");
  const [certs, setCerts] = useState<string[]>([]);

  // Prefill cuando venga initial (modo edición)
  useEffect(() => {
    if (!initial) return;

    // Paso 1
    setTitle(initial.title ?? "");
    const cm = initial.companyMode ?? (presetCompany?.id ? "own" : "confidential");
    setCompanyMode(cm === "other" ? "own" : cm);
    setCompanyOtherName(initial.companyOtherName ?? "");

    setLocationType(initial.locationType ?? "ONSITE");
    setCity(initial.city ?? "");
    setCountry(initial.country ?? "");
    setAdmin1(initial.admin1 ?? "");
    setCityNorm(initial.cityNorm ?? "");
    setAdmin1Norm(initial.admin1Norm ?? "");
    setLocationLat(initial.locationLat ?? null);
    setLocationLng(initial.locationLng ?? null);

    setCurrency((initial.currency as Currency) ?? "MXN");
    setSalaryMin(
      initial.salaryMin === null || initial.salaryMin === undefined ? "" : String(initial.salaryMin)
    );
    setSalaryMax(
      initial.salaryMax === null || initial.salaryMax === undefined ? "" : String(initial.salaryMax)
    );
    setShowSalary(!!initial.showSalary);

    // Paso 2
    setEmploymentType(initial.employmentType ?? "FULL_TIME");
    setSchedule(initial.schedule ?? "");

    // Paso 3
    setShowBenefits(typeof initial.showBenefits === "boolean" ? initial.showBenefits : true);
    if (initial.benefitsJson && typeof initial.benefitsJson === "object") {
      const b = initial.benefitsJson as any;
      const base = BENEFITS.reduce((acc, item) => {
        const v = b[item.key];
        acc[item.key] = typeof v === "boolean" ? v : item.def;
        return acc;
      }, {} as Record<string, boolean>);
      setBenefits(base);
      if (typeof b.aguinaldoDias === "number") setAguinaldoDias(b.aguinaldoDias);
      if (typeof b.vacacionesDias === "number") setVacacionesDias(b.vacacionesDias);
      if (typeof b.primaVacPct === "number") setPrimaVacPct(b.primaVacPct);
    }

    // Paso 4
    setDescription(initial.description ?? "");
    if (Array.isArray(initial.education)) setEducation(initial.education);
    if (initial.minDegree) setMinDegree(initial.minDegree);
    setSkills(Array.isArray(initial.skills) ? initial.skills : []);
    setCerts(Array.isArray(initial.certs) ? initial.certs : []);
  }, [initial, presetCompany?.id]);

  const canNext1 = useMemo(() => {
    if (!title.trim()) return false;
    if ((locationType === "HYBRID" || locationType === "ONSITE") && !city.trim()) return false;
    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) return false;
    return true;
  }, [title, locationType, city, salaryMin, salaryMax]);

  const canNext2 = true;
  const canNext4 = description.replace(/\s+/g, "").length >= 50;

  // ---- Buscadores Fuse ----
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

  // ---- Mutadores (skills/education/certs) ----
  const addSkill = (name: string, required = addAsRequired) => {
    const n = name.trim();
    if (!n) return;
    if (skills.some((s) => s.name.toLowerCase() === n.toLowerCase())) return;
    setSkills((prev) => [...prev, { name: n, required }]);
    setSkillQuery("");
  };
  const toggleSkillType = (name: string) =>
    setSkills((prev) => prev.map((s) => (s.name === name ? { ...s, required: !s.required } : s)));
  const removeSkill = (name: string) => setSkills((prev) => prev.filter((s) => s.name !== name));

  const addEducation = (name: string, required = educationAddAsRequired) => {
    const n = name.trim();
    if (!n) return;
    if (education.some((e) => e.name.toLowerCase() === n.toLowerCase())) return;
    setEducation((prev) => [...prev, { name: n, required }]);
    setEducationQuery("");
  };
  const toggleEducationType = (name: string) =>
    setEducation((prev) =>
      prev.map((e) => (e.name === name ? { ...e, required: !e.required } : e))
    );
  const removeEducation = (name: string) =>
    setEducation((prev) => prev.filter((e) => e.name !== name));

  const addCert = (c: string) => {
    const n = c.trim();
    if (!n) return;
    if (certs.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    setCerts((prev) => [...prev, n]);
    setCertQuery("");
  };
  const removeCert = (c: string) => setCerts((prev) => prev.filter((x) => x !== c));

  // ➕ Handler para ubicación estructurada (funciona si tu LocationAutocomplete lo soporta)
  function handlePlaceChange(next: any) {
    if (typeof next === "string") {
      setCity(next);
      return;
    }
    if (next && typeof next === "object") {
      setCity(next.label || next.city || "");
      setCountry(next.country || "");
      setAdmin1(next.admin1 || "");
      setCityNorm(next.cityNorm || "");
      setAdmin1Norm(next.admin1Norm || "");
      setLocationLat(typeof next.lat === "number" && Number.isFinite(next.lat) ? next.lat : null);
      setLocationLng(typeof next.lng === "number" && Number.isFinite(next.lng) ? next.lng : null);
      return;
    }
    setCity("");
    setCountry("");
    setAdmin1("");
    setCityNorm("");
    setAdmin1Norm("");
    setLocationLat(null);
    setLocationLng(null);
  }

  // ➕ Aplicar plantilla completa por id (incluye ubicación estructurada si viene)
  function applyTemplateById(id: string) {
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;

    // Paso 1
    if (tpl.title) setTitle(tpl.title);
    if (tpl.locationType) setLocationType(tpl.locationType);

    setCity(tpl.city ?? "");
    setCountry(tpl.country ?? "");
    setAdmin1(tpl.admin1 ?? "");
    setCityNorm(tpl.cityNorm ?? "");
    setAdmin1Norm(tpl.admin1Norm ?? "");
    setLocationLat(tpl.locationLat ?? null);
    setLocationLng(tpl.locationLng ?? null);

    if (tpl.currency) setCurrency(tpl.currency);
    setSalaryMin(tpl.salaryMin != null ? String(tpl.salaryMin) : "");
    setSalaryMax(tpl.salaryMax != null ? String(tpl.salaryMax) : "");
    setShowSalary(!!tpl.showSalary);

    // Paso 2
    if (tpl.employmentType) setEmploymentType(tpl.employmentType);
    setSchedule(tpl.schedule ?? "");

    // Paso 3
    if (tpl.benefitsJson && typeof tpl.benefitsJson === "object") {
      const b = tpl.benefitsJson as any;
      setShowBenefits(Boolean(b.showBenefits ?? true));
      setBenefits((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(prev)) next[k] = Boolean(b[k] ?? prev[k]);
        return next;
      });
      if (typeof b.aguinaldoDias === "number") setAguinaldoDias(b.aguinaldoDias);
      if (typeof b.vacacionesDias === "number") setVacacionesDias(b.vacacionesDias);
      if (typeof b.primaVacPct === "number") setPrimaVacPct(b.primaVacPct);
    }

    // Paso 4
    setDescription(tpl.description ?? "");
    if (Array.isArray(tpl.education)) setEducation(tpl.education);
    if (tpl.minDegree) setMinDegree(tpl.minDegree);
    if (Array.isArray(tpl.skills)) setSkills(tpl.skills);
    if (Array.isArray(tpl.certs)) setCerts(tpl.certs);

    toast.success("Plantilla aplicada");
  }

  // ---------- Submit ----------
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clampNonNegative(n: string) {
    const v = Math.max(0, Number(n || 0));
    if (!Number.isFinite(v)) return "";
    return String(v);
  }

  async function handlePublish() {
    setError(null);
    setBusy(true);

    const fd = new FormData();
    // p1
    fd.set("title", title.trim());
    fd.set("companyMode", companyMode);
    fd.set("companyOtherName", companyOtherName.trim());
    fd.set("locationType", locationType);
    fd.set("city", city.trim());

    // Ubicación estructurada
    if (country) fd.set("country", country);
    if (admin1) fd.set("admin1", admin1);
    if (cityNorm) fd.set("cityNorm", cityNorm);
    if (admin1Norm) fd.set("admin1Norm", admin1Norm);
    if (locationLat != null) fd.set("locationLat", String(locationLat));
    if (locationLng != null) fd.set("locationLng", String(locationLng));

    fd.set("currency", currency);
    if (salaryMin) fd.set("salaryMin", clampNonNegative(salaryMin));
    if (salaryMax) fd.set("salaryMax", clampNonNegative(salaryMax));
    fd.set("showSalary", String(showSalary));
    // p2
    fd.set("employmentType", employmentType);
    if (schedule) fd.set("schedule", schedule);
    // p3
    const benefitsPayload = {
      ...benefits,
      aguinaldoDias,
      vacacionesDias,
      primaVacPct,
      showBenefits,
    };
    fd.set("showBenefits", String(showBenefits));
    fd.set("benefitsJson", JSON.stringify(benefitsPayload));
    // p4
    fd.set("description", description.trim());
    fd.set("responsibilities", ""); // legacy
    fd.set("educationJson", JSON.stringify(education));
    fd.set("minDegree", minDegree);
    fd.set("skillsJson", JSON.stringify(skills));
    fd.set("certsJson", JSON.stringify(certs));

    const isEditing = !!initial?.id;
    if (isEditing && initial?.id) {
      fd.set("jobId", initial.id);
      try {
        const result = await onSubmit(fd);
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success("Cambios guardados correctamente");
          if (result?.redirectTo) router.push(result.redirectTo);
          else router.refresh();
        }
      } catch (e) {
        console.error("[JobWizard] update error", e);
        toast.error("No se pudo guardar la vacante");
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        console.error("Error al crear vacante:", data);
        toast.error(data?.error || "Error al publicar la vacante");
        setBusy(false);
        return;
      }
      toast.success("Vacante publicada correctamente 🎉");
      router.push(`/dashboard/jobs/${data.id}/applications`);
    } catch (err) {
      console.error("Error de red:", err);
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  }

  /* --------- Helpers UI: sugerir desde descripción + pegado masivo --------- */
  const handleSuggestFromDesc = () => {
    if (!description.trim()) {
      toast.message("Agrega una descripción primero");
      return;
    }
    const { skills: s, education: e } = suggestFromText({
      text: description,
      skillsCatalog: skillsOptions,
      educationCatalog: EDUCATION_SUGGESTIONS,
    });

    if (e.length) {
      setEducation((prev) => {
        const exists = new Set(prev.map((p) => p.name.toLowerCase()));
        const add = e
          .filter((x) => !exists.has(x.toLowerCase()))
          .map((name) => ({ name, required: educationAddAsRequired }));
        return [...prev, ...add];
      });
    }
    if (s.length) {
      setSkills((prev) => {
        const exists = new Set(prev.map((p) => p.name.toLowerCase()));
        const add = s
          .filter((x) => !exists.has(x.toLowerCase()))
          .map((name) => ({ name, required: addAsRequired }));
        return [...prev, ...add];
      });
    }
    if (!e.length && !s.length) toast.message("No encontré coincidencias claras");
    else toast.success("Sugerencias agregadas");
  };

  const handleEduBulkPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const raw = e.clipboardData.getData("text");
    if (!raw || !raw.includes("\n")) return;
    e.preventDefault();
    const lines = Array.from(
      new Set(raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
    ).slice(0, 50);
    setEducation((prev) => {
      const exists = new Set(prev.map((p) => p.name.toLowerCase()));
      const add = lines
        .filter((x) => !exists.has(x.toLowerCase()))
        .map((name) => ({ name, required: educationAddAsRequired }));
      return [...prev, ...add];
    });
    setEducationQuery("");
    toast.success("Formaciones agregadas");
  };

  const handleSkillBulkPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const raw = e.clipboardData.getData("text");
    if (!raw || !raw.includes("\n")) return;
    e.preventDefault();
    const lines = Array.from(
      new Set(raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
    ).slice(0, 80);
    setSkills((prev) => {
      const exists = new Set(prev.map((p) => p.name.toLowerCase()));
      const add = lines
        .filter((x) => !exists.has(x.toLowerCase()))
        .map((name) => ({ name, required: addAsRequired }));
      return [...prev, ...add];
    });
    setSkillQuery("");
    toast.success("Skills agregadas");
  };

  return (
    <div className="space-y-6">
      {/* pasos */}
      <ol className="flex items-center gap-2 text-xs">
        {[1, 2, 3, 4, 5].map((n) => (
          <li
            key={n}
            className={clsx(
              "px-2 py-1 rounded-full",
              n <= step ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-700"
            )}
          >
            Paso {n}
          </li>
        ))}
      </ol>

      {/* Paso 1 */}
      {step === 1 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">1) Datos básicos</h3>

          {/* ➕ Plantillas (si hay) */}
          {templates.length > 0 && (
            <div className="grid gap-1">
              <label className="text-sm">Usar vacante anterior (plantilla)</label>
              <div className="flex gap-2">
                <select
                  className="min-w-0 flex-1 rounded-md border p-2"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">— Selecciona una vacante —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title || `Vacante ${t.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={!selectedTemplateId}
                  onClick={() => applyTemplateById(selectedTemplateId)}
                >
                  Aplicar
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Rellena automáticamente título, ubicación, sueldo, tipo, prestaciones, descripción, educación, skills y certs.
              </p>
            </div>
          )}

          <div className="grid gap-1">
            <label className="text-sm">Nombre de la vacante *</label>
            <input
              className="rounded-md border p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm">Empresa *</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="companyMode"
                  value="own"
                  checked={companyMode === "own"}
                  onChange={() => setCompanyMode("own")}
                  disabled={!presetCompany?.id}
                />
                <span>
                  Mi empresa {presetCompany?.name ? `(${presetCompany.name})` : "(no asignada)"}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="companyMode"
                  value="confidential"
                  checked={companyMode === "confidential"}
                  onChange={() => setCompanyMode("confidential")}
                />
                <span>Confidencial (ocultar nombre)</span>
              </label>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Ubicación *</label>
              <select
                className="rounded-md border p-2"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType)}
              >
                <option value="REMOTE">Remoto</option>
                <option value="HYBRID">Híbrido</option>
                <option value="ONSITE">Presencial</option>
              </select>
              {(locationType === "HYBRID" || locationType === "ONSITE") && (
                <div className="mt-2">
                  {/* Soporta onChange(string) y onPlace(objeto) */}
                  <LocationAutocomplete
                    value={city}
                    onChange={handlePlaceChange as any}
                    onPlace={handlePlaceChange as any}
                    countries={["mx"]}
                    placeholder="Ciudad de la vacante (ej. CDMX, Monterrey)"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-1">
              <label className="text-sm">Sueldo (opcional)</label>
              {/* Layout robusto para evitar desbordes */}
              <div className="grid grid-cols-[minmax(84px,96px)_1fr_1fr] gap-2 items-center">
                <select
                  className="rounded-md border p-2 w-full"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
                <input
                  className="rounded-md border p-2 w-full min-w-0"
                  type="number"
                  placeholder="Mín."
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  min={0}
                />
                <input
                  className="rounded-md border p-2 w-full min-w-0"
                  type="number"
                  placeholder="Máx."
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  min={0}
                />
              </div>
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSalary}
                  onChange={(e) => setShowSalary(e.target.checked)}
                />
                Mostrar sueldo
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="rounded-md border px-4 py-2" disabled>
              Atrás
            </button>
            <button
              className={clsx(
                "rounded-md px-4 py-2 text-white",
                canNext1 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-300"
              )}
              disabled={!canNext1}
              onClick={() => setStep(2)}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}

      {/* Paso 2 */}
      {step === 2 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">2) Tipo de empleo</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Tipo *</label>
              <select
                className="rounded-md border p-2"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
              >
                <option value="FULL_TIME">Tiempo completo</option>
                <option value="PART_TIME">Medio tiempo</option>
                <option value="CONTRACT">Por periodo</option>
                <option value="INTERNSHIP">Prácticas profesionales</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Horario (opcional)</label>
              <input
                className="rounded-md border p-2"
                placeholder="Ej. L-V 9:00–18:00"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between">
            <button className="rounded-md border px-4 py-2" onClick={() => setStep(1)}>
              Atrás
            </button>
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
              onClick={() => setStep(3)}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}

      {/* Paso 3 */}
      {step === 3 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">3) Prestaciones</h3>

          <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 flex items-center justify-between">
            <div className="text-sm">
              <strong>Visibilidad:</strong> Mostrar prestaciones en la publicación
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showBenefits}
                onChange={(e) => setShowBenefits(e.target.checked)}
              />
              {showBenefits ? "Sí" : "No"}
            </label>
          </div>

          {/* Tarjetas con inputs alineados a la derecha */}
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {BENEFITS.map((b) => {
              const checked = !!benefits[b.key];
              const setChecked = (val: boolean) =>
                setBenefits((prev) => ({ ...prev, [b.key]: val }));

              return (
                <div key={b.key} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <input
                      id={`benefit-${b.key}`}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChecked(e.target.checked)}
                    />
                    <label
                      htmlFor={`benefit-${b.key}`}
                      className="text-sm cursor-pointer select-none"
                    >
                      {b.label}
                    </label>

                    {checked && b.key === "aguinaldo" && (
                      <div className="ml-auto flex items-center gap-2 text-xs">
                        <span className="text-zinc-500">Días:</span>
                        <input
                          type="number"
                          min={0}
                          className="w-20 rounded border p-1 text-sm"
                          value={aguinaldoDias}
                          onChange={(e) => setAguinaldoDias(Number(e.target.value || 0))}
                        />
                      </div>
                    )}

                    {checked && b.key === "vacaciones" && (
                      <div className="ml-auto flex items-center gap-2 text-xs">
                        <span className="text-zinc-500">Días:</span>
                        <input
                          type="number"
                          min={0}
                          className="w-20 rounded border p-1 text-sm"
                          value={vacacionesDias}
                          onChange={(e) => setVacacionesDias(Number(e.target.value || 0))}
                        />
                      </div>
                    )}

                    {checked && b.key === "primaVac" && (
                      <div className="ml-auto flex items-center gap-2 text-xs">
                        <span className="text-zinc-500">%</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="w-20 rounded border p-1 text-sm"
                          value={primaVacPct}
                          onChange={(e) => setPrimaVacPct(Number(e.target.value || 0))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button className="rounded-md border px-4 py-2" onClick={() => setStep(2)}>
              Atrás
            </button>
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
              onClick={() => setStep(4)}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}

      {/* Paso 4 */}
      {step === 4 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold">4) Descripción, educación y skills</h3>
              <p className="text-xs text-zinc-500">Cuéntanos del rol y perfila lo que necesitas</p>
            </div>
            <div className="flex items-center gap-3">
              <CharProgress current={description.replace(/\s+/g, "").length} />
              <button
                type="button"
                className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
                onClick={handleSuggestFromDesc}
                title="Sugerir skills y educación desde la descripción"
              >
                Sugerir desde descripción
              </button>
            </div>
          </div>

          {/* Descripción */}
          <div className="grid gap-1">
            <label className="text-sm">Descripción de la vacante *</label>
            <textarea
              className="min-h-[140px] rounded-md border p-3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe la posición, equipo, retos, etc."
            />
            <div className={clsx("text-xs", canNext4 ? "text-emerald-600" : "text-zinc-500")}>
              {description.replace(/\s+/g, "").length} / 50
            </div>
          </div>

          {/* Educación — layout en 2 columnas */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Nivel mínimo</label>
              <select
                className="rounded-md border p-2"
                value={minDegree}
                onChange={(e) => setMinDegree(e.target.value as DegreeLevel)}
              >
                <option value="HIGHSCHOOL">Bachillerato</option>
                <option value="TECH">Técnico</option>
                <option value="BACHELOR">Licenciatura / Ingeniería</option>
                <option value="MASTER">Maestría</option>
                <option value="PHD">Doctorado</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-sm">Agregar educación (programa / carrera)</label>
              <div className="relative">
                <input
                  className="w-full rounded-md border p-2"
                  placeholder="Ej. Ingeniería en Sistemas, Maestría en TI…"
                  value={educationQuery}
                  onChange={(e) => setEducationQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === "Tab") && educationQuery.trim()) {
                      e.preventDefault();
                      const req =
                        e.metaKey || e.ctrlKey ? !educationAddAsRequired : educationAddAsRequired;
                      addEducation(filteredEducation[0] || educationQuery.trim(), req);
                    }
                  }}
                  onPaste={handleEduBulkPaste}
                  aria-autocomplete="list"
                  aria-expanded={!!educationQuery}
                />

                {educationQuery && (
                  <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-white shadow">
                    {/* Opción para agregar el texto tal cual */}
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => addEducation(educationQuery.trim(), educationAddAsRequired)}
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border">
                        +
                      </span>
                      Agregar “{educationQuery.trim()}”
                      <span className="ml-auto text-xs text-zinc-500">
                        {educationAddAsRequired ? "Obligatoria" : "Deseable"}
                      </span>
                    </button>

                    {/* Sugerencias del catálogo */}
                    {filteredEducation.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-zinc-500">Sin resultados</div>
                    ) : (
                      filteredEducation.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => addEducation(s, educationAddAsRequired)}
                          role="option"
                        >
                          {s}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="mt-1 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={educationAddAsRequired}
                    onChange={(e) => setEducationAddAsRequired(e.target.checked)}
                  />
                  Agregar como <b>{educationAddAsRequired ? "Obligatoria" : "Deseable"}</b>
                </label>
                <span className="text-xs text-zinc-500">
                  Tip: <kbd>Enter</kbd> agrega; <kbd>Ctrl/⌘+Enter</kbd> agrega como{" "}
                  {educationAddAsRequired ? "Deseable" : "Obligatoria"}.
                </span>
              </div>
            </div>
          </div>

          {/* Sugeridos (chips) */}
          <div className="grid gap-2">
            <span className="text-xs font-medium text-zinc-600">Sugeridos</span>
            <div className="flex flex-wrap gap-2">
              {EDUCATION_SUGGESTIONS.slice(0, 12).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addEducation(s, educationAddAsRequired)}
                  className="rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                  title="Agregar"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Seleccionados (grupos Req/Dese) */}
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { title: "Obligatoria", filter: (e: any) => e.required },
              { title: "Deseable", filter: (e: any) => !e.required },
            ].map(({ title, filter }) => (
              <div key={title} className="rounded-md border p-3">
                <p className="text-xs font-medium text-zinc-600 mb-2">{title}</p>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {education.filter(filter).length === 0 ? (
                    <span className="text-xs text-zinc-400">Sin elementos</span>
                  ) : (
                    education
                      .filter(filter)
                      .map((e) => (
                        <span
                          key={e.name}
                          className={clsx(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                            e.required
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200"
                          )}
                        >
                          <span className="truncate max-w-[220px]" title={e.name}>
                            {e.name}
                          </span>
                          <button
                            type="button"
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[11px] border",
                              e.required
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-zinc-700 border-zinc-300"
                            )}
                            onClick={() => toggleEducationType(e.name)}
                            title={`Mover a ${e.required ? "Deseable" : "Obligatoria"}`}
                          >
                            {e.required ? "Req" : "Dese"}
                          </button>
                          <button
                            type="button"
                            className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-red-50 hover:text-red-600"
                            onClick={() => removeEducation(e.name)}
                            title="Quitar"
                          >
                            ×
                          </button>
                        </span>
                      ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm">Skills / Lenguajes</label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={addAsRequired}
                  onChange={(e) => setAddAsRequired(e.target.checked)}
                />
                Agregar como <b>{addAsRequired ? "Obligatoria" : "Deseable"}</b>
              </label>
            </div>

            <div className="relative">
              <input
                className="w-full rounded-md border p-2"
                placeholder="Busca (ej. Python, AWS, React Native...) y selecciona"
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === "Tab") && skillQuery.trim()) {
                    e.preventDefault();
                    const req = e.metaKey || e.ctrlKey ? !addAsRequired : addAsRequired;
                    addSkill(filteredSkills[0] || skillQuery.trim(), req);
                  }
                }}
                onPaste={handleSkillBulkPaste}
                aria-autocomplete="list"
                aria-expanded={!!skillQuery}
              />
              {skillQuery && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow">
                  {filteredSkills.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
                  ) : (
                    filteredSkills.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => addSkill(s, addAsRequired)}
                        role="option"
                      >
                        {s}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {skills.length ? (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={s.name}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                      s.required
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-zinc-100 text-zinc-700 border-zinc-200"
                    )}
                  >
                    {s.name}
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={s.required}
                        onChange={() => toggleSkillType(s.name)}
                      />
                      Obligatoria
                    </label>
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => removeSkill(s.name)}
                      title="Quitar"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Aún no has agregado skills.</p>
            )}
          </div>

          {/* Certificaciones */}
          <div className="grid gap-2">
            <label className="text-sm">Certificaciones (opcional)</label>
            <div className="relative">
              <input
                className="w-full rounded-md border p-2"
                placeholder="Busca y selecciona (ej. AWS SAA, CCNA...)"
                value={certQuery}
                onChange={(e) => setCertQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === "Tab") && certQuery.trim()) {
                    e.preventDefault();
                    addCert(filteredCerts[0] || certQuery.trim());
                  }
                }}
                aria-autocomplete="list"
                aria-expanded={!!certQuery}
              />
              {certQuery && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow">
                  {filteredCerts.length === 0 ? (
                    <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
                  ) : (
                    filteredCerts.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
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
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                  >
                    {c}
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => removeCert(c)}
                      title="Quitar"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Opcional.</p>
            )}
          </div>

          <div className="flex justify-between">
            <button className="rounded-md border px-4 py-2" onClick={() => setStep(3)}>
              Atrás
            </button>
            <button
              className={clsx(
                "rounded-md px-4 py-2 text-white",
                canNext4 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-300"
              )}
              disabled={!canNext4}
              onClick={() => setStep(5)}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}

      {/* Paso 5 */}
      {step === 5 && (
        <section className="grid gap-4 rounded-xl border p-4">
          <h3 className="font-semibold">5) Revisión y publicación</h3>

          <div className="grid gap-3 text-sm">
            <div>
              <strong>Vacante:</strong> {title}
            </div>
            <div>
              <strong>Empresa:</strong>{" "}
              {companyMode === "confidential" ? "Confidencial" : presetCompany?.name || "Mi empresa"}
            </div>
            <div>
              <strong>Ubicación:</strong>{" "}
              {locationType === "REMOTE"
                ? "Remoto"
                : `${locationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${city}`}
            </div>
            <div>
              <strong>Sueldo:</strong>{" "}
              {salaryMin || salaryMax
                ? `${currency} ${salaryMin || "—"} - ${salaryMax || "—"} ${
                    showSalary ? "(visible)" : "(oculto)"
                  }`
                : "No especificado"}
            </div>
            <div>
              <strong>Tipo:</strong> {labelEmployment(employmentType)}
            </div>
            {schedule && (
              <div>
                <strong>Horario:</strong> {schedule}
              </div>
            )}
            <div>
              <strong>Prestaciones visibles:</strong> {showBenefits ? "Sí" : "No"}
            </div>
            {showBenefits && (
              <ul className="ml-4 list-disc">
                {Object.entries(benefits)
                  .filter(([, v]) => v)
                  .map(([k]) => {
                    if (k === "aguinaldo") return <li key={k}>Aguinaldo: {aguinaldoDias} días</li>;
                    if (k === "vacaciones")
                      return <li key={k}>Vacaciones: {vacacionesDias} días</li>;
                    if (k === "primaVac")
                      return <li key={k}>Prima vacacional: {primaVacPct}%</li>;
                    const lbl = BENEFITS.find((b) => b.key === k)?.label ?? k;
                    return <li key={k}>{lbl}</li>;
                  })}
              </ul>
            )}

            <div>
              <strong>Descripción:</strong>
              <div className={reviewBox}>{description || "—"}</div>
            </div>

            <div>
              <strong>Educación — nivel mínimo:</strong> {labelDegree(minDegree)}
            </div>
            <div>
              <strong>Formación académica:</strong>{" "}
              {education.length
                ? education.map((e) => `${e.required ? "Req" : "Dese"}: ${e.name}`).join(", ")
                : "—"}
            </div>

            <div>
              <strong>Skills:</strong>{" "}
              {skills.length
                ? skills.map((s) => `${s.required ? "Req" : "Dese"}: ${s.name}`).join(", ")
                : "—"}
            </div>
            <div>
              <strong>Certificaciones:</strong> {certs.length ? certs.join(", ") : "—"}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="sticky bottom-0 mt-2 -mx-4 border-t bg-white/90 px-4 py-3 backdrop-blur">
            <div className="flex justify-between">
              <button className="rounded-md border px-4 py-2" onClick={() => setStep(4)}>
                Atrás
              </button>
              <button
                className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:bg-emerald-300"
                disabled={busy}
                onClick={handlePublish}
              >
                {busy
                  ? initial
                    ? "Guardando..."
                    : "Publicando..."
                  : initial
                  ? "Guardar cambios"
                  : "Publicar vacante"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function labelEmployment(e: EmploymentType) {
  switch (e) {
    case "FULL_TIME":
      return "Tiempo completo";
    case "PART_TIME":
      return "Medio tiempo";
    case "CONTRACT":
      return "Por periodo";
    case "INTERNSHIP":
      return "Prácticas profesionales";
  }
}

function labelDegree(d: DegreeLevel) {
  switch (d) {
    case "HIGHSCHOOL":
      return "Bachillerato";
    case "TECH":
      return "Técnico";
    case "BACHELOR":
      return "Licenciatura / Ingeniería";
    case "MASTER":
      return "Maestría";
    case "PHD":
      return "Doctorado";
  }
}
