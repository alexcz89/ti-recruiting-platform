// app/dashboard/jobs/new/JobWizard.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import DOMPurify from "dompurify";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { createStringFuse, searchStrings } from "@/lib/search/fuse";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/* =============================
   Tipos
============================= */
type PresetCompany = { id: string | null; name: string | null };

type LocationType = "REMOTE" | "HYBRID" | "ONSITE";
type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
type Currency = "MXN" | "USD";
type DegreeLevel = "HIGHSCHOOL" | "TECH" | "BACHELOR" | "MASTER" | "PHD";

type TemplateJob = {
  id: string;
  title?: string;
  locationType?: LocationType;
  city?: string | null;
  country?: string | null;
  admin1?: string | null;
  cityNorm?: string | null;
  admin1Norm?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  currency?: Currency;
  salaryMin?: number | null;
  salaryMax?: number | null;
  showSalary?: boolean | null;
  employmentType?: EmploymentType;
  schedule?: string | null;
  benefitsJson?: any | null;
  description?: string | null; // legacy plain
  descriptionHtml?: string | null;
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
    locationType?: LocationType;
    city?: string;
    country?: string | null;
    admin1?: string | null;
    cityNorm?: string | null;
    admin1Norm?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;
    currency?: Currency;
    salaryMin?: number | string | null;
    salaryMax?: number | string | null;
    showSalary?: boolean;
    // Paso 2
    employmentType?: EmploymentType;
    schedule?: string;
    // Paso 3
    showBenefits?: boolean;
    benefitsJson?: Record<string, any>;
    // Paso 4
    description?: string; // legacy plain
    descriptionHtml?: string | null;
    education?: Array<{ name: string; required: boolean }>;
    minDegree?: DegreeLevel;
    // Paso 4 (skills/certs)
    skills?: Array<{ name: string; required: boolean }>;
    certs?: string[];
  };
};

/* =============================
   Utils
============================= */
function sanitizeHtml(html: string) {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "strong", "em", "ul", "ol", "li", "p", "br"],
    ALLOWED_ATTR: [],
  });
}

function htmlToPlain(html: string) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

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

// --- Draft utils ---
const DRAFT_VERSION = 1;
const draftKeyFor = (initial?: Props["initial"]) =>
  `jobwizard:draft:${initial?.id ?? "new"}`;

type DraftPayload = {
  __v: number;
  step: number;
  tab4: "desc" | "skills" | "edu";
  // p1
  title: string;
  companyMode: "own" | "confidential";
  companyOtherName: string;
  locationType: LocationType;
  city: string;
  country: string;
  admin1: string;
  cityNorm: string;
  admin1Norm: string;
  locationLat: number | null;
  locationLng: number | null;
  currency: Currency;
  salaryMin: string;
  salaryMax: string;
  showSalary: boolean;
  // p2
  employmentType: EmploymentType;
  schedule: string;
  // p3
  showBenefits: boolean;
  benefits: Record<string, boolean>;
  aguinaldoDias: number;
  vacacionesDias: number;
  primaVacPct: number;
  // p4
  descriptionHtml: string;
  descriptionPlain: string;
  minDegree: DegreeLevel;
  eduRequired: string[];
  eduNice: string[];
  requiredSkills: string[];
  niceSkills: string[];
  certs: string[];
};

/* =============================
   Stepper (sin sticky)
============================= */
function Stepper({
  step,
  total = 5,
  onJump,
}: {
  step: number;
  total?: number;
  onJump?: (n: number) => void;
}) {
  const items = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <ol className="-mx-1 mb-3 flex items-center gap-2 px-1">
      {items.map((n) => {
        const done = n < step;
        const active = n === step;
        return (
          <li key={n}>
            <button
              type="button"
              onClick={() => onJump?.(n)}
              className={[
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
                done &&
                  "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                active &&
                  "border-emerald-600 bg-emerald-600 text-white shadow-sm",
                !done &&
                  !active &&
                  "border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/70",
              ].join(" ")}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={[
                  "grid h-5 w-5 place-content-center rounded-full text-[11px] font-semibold",
                  active
                    ? "bg-white/20 text-white"
                    : done
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
                ].join(" ")}
              >
                {n}
              </span>
              <span className="hidden sm:inline">Paso {n}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* =============================
   Editor con B/I/• (contenteditable)
============================= */
function RichTextBox({
  valueHtml,
  onChangeHtml,
}: {
  valueHtml: string;
  onChangeHtml: (html: string, plain: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (sanitizeHtml(ref.current.innerHTML) !== sanitizeHtml(valueHtml)) {
      ref.current.innerHTML = sanitizeHtml(valueHtml || "");
    }
  }, [valueHtml]);

  function exec(cmd: "bold" | "italic" | "insertUnorderedList") {
    if (!ref.current) return;
    ref.current.focus();
    document.execCommand(cmd, false);
    handleInput();
    ref.current.focus();
  }

  function handleInput() {
    if (!ref.current) return;
    const html = sanitizeHtml(
      ref.current.innerHTML.replace(/<div>/g, "<p>").replace(/<\/div>/g, "</p>")
    );
    const plain = htmlToPlain(html);
    onChangeHtml(html, plain);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    handleInput();
  }

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="mb-2 flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <button
          type="button"
          className="rounded px-2 py-1 text-sm font-semibold hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:hover:bg-zinc-800"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("bold");
          }}
          aria-label="Negritas"
          title="Negritas"
        >
          B
        </button>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm italic hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:hover:bg-zinc-800"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("italic");
          }}
          aria-label="Itálicas"
          title="Itálicas"
        >
          /
        </button>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:hover:bg-zinc-800"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("insertUnorderedList");
          }}
          aria-label="Viñetas"
          title="Viñetas"
        >
          •
        </button>
      </div>

      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="
          min-h-[220px] w-full rounded-md border border-zinc-300 bg-white p-3
          text-[15px] leading-relaxed outline-none dark:border-zinc-700 dark:bg-zinc-900
          whitespace-pre-wrap
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:list-item
          [&_p]:mb-2
          focus:ring-2 focus:ring-emerald-400/50
        "
        suppressContentEditableWarning
        aria-multiline
      />
    </div>
  );
}

/* =============================
   Datos constantes
============================= */
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
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Subtabs del paso 4
  const [tab4, setTab4] = useState<"desc" | "skills" | "edu">("desc");

  // --- Draft state/refs ---
  const draftKey = useMemo(() => draftKeyFor(initial), [initial?.id]);
  const [hasDraft, setHasDraft] = useState(false);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedDraftRef = useRef<DraftPayload | null>(null);

  // ---------- Paso 1 ----------
  const [title, setTitle] = useState("");
  const [companyMode, setCompanyMode] = useState<"own" | "confidential">(
    presetCompany?.id ? "own" : "confidential"
  );
  const [companyOtherName, setCompanyOtherName] = useState("");

  const [locationType, setLocationType] = useState<LocationType>("ONSITE");
  const [city, setCity] = useState("");

  // Ubicación estructurada
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

  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // ---------- Paso 2 ----------
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("FULL_TIME");
  const [schedule, setSchedule] = useState("");

  // ---------- Paso 3 ----------
  const [showBenefits, setShowBenefits] = useState(true);
  const [benefits, setBenefits] = useState<Record<string, boolean>>(
    BENEFITS.reduce(
      (acc, b) => ((acc[b.key] = b.def), acc),
      {} as Record<string, boolean>
    )
  );
  const [aguinaldoDias, setAguinaldoDias] = useState<number>(15);
  const [vacacionesDias, setVacacionesDias] = useState<number>(12);
  const [primaVacPct, setPrimaVacPct] = useState<number>(25);

  // ---------- Paso 4 ----------
  const [descriptionHtml, setDescriptionHtml] = useState<string>("");
  const [descriptionPlain, setDescriptionPlain] = useState<string>("");

  const [minDegree, setMinDegree] = useState<DegreeLevel>("BACHELOR");

  // Educación DnD
  const [eduRequired, setEduRequired] = useState<string[]>([]);
  const [eduNice, setEduNice] = useState<string[]>([]);
  const [educationQuery, setEducationQuery] = useState("");

  // Skills DnD
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [niceSkills, setNiceSkills] = useState<string[]>([]);
  const [skillQuery, setSkillQuery] = useState("");

  // Certs (simples)
  const [certQuery, setCertQuery] = useState("");
  const [certs, setCerts] = useState<string[]>([]);

  // Prefill initial
  useEffect(() => {
    if (!initial) return;

    // Paso 1
    setTitle(initial.title ?? "");
    const cm =
      initial.companyMode ?? (presetCompany?.id ? "own" : "confidential");
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
      initial.salaryMin === null || initial.salaryMin === undefined
        ? ""
        : String(initial.salaryMin)
    );
    setSalaryMax(
      initial.salaryMax === null || initial.salaryMax === undefined
        ? ""
        : String(initial.salaryMax)
    );
    setShowSalary(!!initial.showSalary);

    // Paso 2
    setEmploymentType(initial.employmentType ?? "FULL_TIME");
    setSchedule(initial.schedule ?? "");

    // Paso 3
    setShowBenefits(
      typeof initial.showBenefits === "boolean" ? initial.showBenefits : true
    );
    if (initial.benefitsJson && typeof initial.benefitsJson === "object") {
      const b = initial.benefitsJson as any;
      const base = BENEFITS.reduce((acc, item) => {
        const v = b[item.key];
        acc[item.key] = typeof v === "boolean" ? v : item.def;
        return acc;
      }, {} as Record<string, boolean>);
      setBenefits(base);
      if (typeof b.aguinaldoDias === "number") setAguinaldoDias(b.aguinaldoDias);
      if (typeof b.vacacionesDias === "number")
        setVacacionesDias(b.vacacionesDias);
      if (typeof b.primaVacPct === "number") setPrimaVacPct(b.primaVacPct);
    }

    // Paso 4
    const html = sanitizeHtml(initial.descriptionHtml || "");
    const plain = initial.description
      ? initial.description
      : html
      ? htmlToPlain(html)
      : "";
    setDescriptionHtml(html);
    setDescriptionPlain(plain);

    setMinDegree(initial.minDegree ?? "BACHELOR");

    const initEdu = Array.isArray(initial.education) ? initial.education : [];
    setEduRequired(initEdu.filter((e) => e.required).map((e) => e.name));
    setEduNice(initEdu.filter((e) => !e.required).map((e) => e.name));

    const initSkills = Array.isArray(initial.skills) ? initial.skills : [];
    setRequiredSkills(initSkills.filter((s) => s.required).map((s) => s.name));
    setNiceSkills(initSkills.filter((s) => !s.required).map((s) => s.name));

    setCerts(Array.isArray(initial.certs) ? initial.certs : []);
  }, [initial, presetCompany?.id]);

  // --- Cargar borrador si existe al montar (separado del prefill) ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftPayload;
      if (!parsed || parsed.__v !== DRAFT_VERSION) return;
      loadedDraftRef.current = parsed;
      setHasDraft(true); // mostrará banner para restaurar
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Fuse filters
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

  // Validaciones básicas
  const canNext1 = useMemo(() => {
    if (!title.trim()) return false;
    if (
      (locationType === "HYBRID" || locationType === "ONSITE") &&
      !city.trim()
    )
      return false;
    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax))
      return false;
    return true;
  }, [title, locationType, city, salaryMin, salaryMax]);

  const descLength = descriptionPlain.replace(/\s+/g, "").length;
  const canNext4 = descLength >= 50;

  // ---------- Draft: snapshot + autosave ----------
  function snapshot(): DraftPayload {
    return {
      __v: DRAFT_VERSION,
      step,
      tab4,
      // p1
      title,
      companyMode,
      companyOtherName,
      locationType,
      city,
      country,
      admin1,
      cityNorm,
      admin1Norm,
      locationLat,
      locationLng,
      currency,
      salaryMin,
      salaryMax,
      showSalary,
      // p2
      employmentType,
      schedule,
      // p3
      showBenefits,
      benefits,
      aguinaldoDias,
      vacacionesDias,
      primaVacPct,
      // p4
      descriptionHtml,
      descriptionPlain,
      minDegree,
      eduRequired,
      eduNice,
      requiredSkills,
      niceSkills,
      certs,
    };
  }

  // Autosave con debounce
  useEffect(() => {
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(snapshot()));
      } catch {}
    }, 800);
    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    tab4,
    title,
    companyMode,
    companyOtherName,
    locationType,
    city,
    country,
    admin1,
    cityNorm,
    admin1Norm,
    locationLat,
    locationLng,
    currency,
    salaryMin,
    salaryMax,
    showSalary,
    employmentType,
    schedule,
    showBenefits,
    benefits,
    aguinaldoDias,
    vacacionesDias,
    primaVacPct,
    descriptionHtml,
    descriptionPlain,
    minDegree,
    eduRequired,
    eduNice,
    requiredSkills,
    niceSkills,
    certs,
  ]);

  // Guardar al salir
  useEffect(() => {
    const handler = () => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(snapshot()));
      } catch {}
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  function restoreDraft() {
    const d = loadedDraftRef.current;
    if (!d) return;
    // navegación
    setStep(d.step);
    setTab4(d.tab4);
    // p1
    setTitle(d.title);
    setCompanyMode(d.companyMode);
    setCompanyOtherName(d.companyOtherName);
    setLocationType(d.locationType);
    setCity(d.city);
    setCountry(d.country);
    setAdmin1(d.admin1);
    setCityNorm(d.cityNorm);
    setAdmin1Norm(d.admin1Norm);
    setLocationLat(d.locationLat);
    setLocationLng(d.locationLng);
    setCurrency(d.currency);
    setSalaryMin(d.salaryMin);
    setSalaryMax(d.salaryMax);
    setShowSalary(d.showSalary);
    // p2
    setEmploymentType(d.employmentType);
    setSchedule(d.schedule);
    // p3
    setShowBenefits(d.showBenefits);
    setBenefits(d.benefits);
    setAguinaldoDias(d.aguinaldoDias);
    setVacacionesDias(d.vacacionesDias);
    setPrimaVacPct(d.primaVacPct);
    // p4
    setDescriptionHtml(d.descriptionHtml);
    setDescriptionPlain(d.descriptionPlain);
    setMinDegree(d.minDegree);
    setEduRequired(d.eduRequired);
    setEduNice(d.eduNice);
    setRequiredSkills(d.requiredSkills);
    setNiceSkills(d.niceSkills);
    setCerts(d.certs);

    setHasDraft(false);
    toast.success("Borrador restaurado");
  }

  function discardDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setHasDraft(false);
    loadedDraftRef.current = null;
    toast.message("Borrador descartado");
  }

  // Template apply
  function applyTemplateById(id: string) {
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;

    setTitle(tpl.title ?? "");
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

    if (tpl.employmentType) setEmploymentType(tpl.employmentType);
    setSchedule(tpl.schedule ?? "");

    if (tpl.benefitsJson && typeof tpl.benefitsJson === "object") {
      const b = tpl.benefitsJson as any;
      setShowBenefits(Boolean(b.showBenefits ?? true));
      setBenefits((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(prev)) next[k] = Boolean(b[k] ?? prev[k]);
        return next;
      });
      if (typeof b.aguinaldoDias === "number") setAguinaldoDias(b.aguinaldoDias);
      if (typeof b.vacacionesDias === "number")
        setVacacionesDias(b.vacacionesDias);
      if (typeof b.primaVacPct === "number") setPrimaVacPct(b.primaVacPct);
    }

    const html = sanitizeHtml(tpl.descriptionHtml || "");
    setDescriptionHtml(html);
    setDescriptionPlain(
      tpl.description ? tpl.description : html ? htmlToPlain(html) : ""
    );

    if (Array.isArray(tpl.education)) {
      setEduRequired(tpl.education.filter((e) => e.required).map((e) => e.name));
      setEduNice(tpl.education.filter((e) => !e.required).map((e) => e.name));
    }
    if (tpl.minDegree) setMinDegree(tpl.minDegree);
    if (Array.isArray(tpl.skills)) {
      setRequiredSkills(tpl.skills.filter((s) => s.required).map((s) => s.name));
      setNiceSkills(tpl.skills.filter((s) => !s.required).map((s) => s.name));
    }
    if (Array.isArray(tpl.certs)) setCerts(tpl.certs);

    toast.success("Plantilla aplicada");
  }

  // Submit
  const [busy, setBusy] = useState(false);

  function clampNonNegative(n: string) {
    const v = Math.max(0, Number(n || 0));
    if (!Number.isFinite(v)) return "";
    return String(v);
  }

async function handlePublish() {
  setBusy(true);

  try {
    const fd = new FormData();

    // p1
    fd.set("title", title.trim());
    fd.set("companyMode", companyMode);
    fd.set("companyOtherName", companyOtherName.trim());
    fd.set("locationType", locationType);
    fd.set("city", city.trim());

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

    // p4 — HTML + Plain
    const safeHtml = sanitizeHtml(descriptionHtml.trim());
    const safePlain = descriptionPlain.trim() || htmlToPlain(safeHtml);

    fd.set("descriptionHtml", safeHtml);
    fd.set("description", safePlain); // compatibilidad / búsqueda

    fd.set("minDegree", minDegree);

    const eduPack = [
      ...eduRequired.map((name) => ({ name, required: true })),
      ...eduNice.map((name) => ({ name, required: false })),
    ];
    fd.set("educationJson", JSON.stringify(eduPack));

    const skillsPack = [
      ...requiredSkills.map((name) => ({ name, required: true })),
      ...niceSkills.map((name) => ({ name, required: false })),
    ];
    fd.set("skillsJson", JSON.stringify(skillsPack));

    fd.set("certsJson", JSON.stringify(certs));

    const isEditing = !!initial?.id;

    // 🔁 MODO EDICIÓN
    if (isEditing && initial?.id) {
      fd.set("jobId", initial.id);

      const result = await onSubmit(fd);

      if (result?.error) {
        // Un solo lugar que lanza el error; el catch muestra el toast
        throw new Error(result.error);
      }

      toast.success("Cambios guardados correctamente");
      try {
        localStorage.removeItem(draftKey);
      } catch {}

      if (result?.redirectTo) {
        router.push(result.redirectTo);
      } else {
        router.refresh();
      }

      return;
    }

    // 🆕 CREACIÓN (incluye límite por plan)
    const res = await fetch("/api/jobs", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      console.error("Error al crear vacante:", data);

      // Caso especial: límite de vacantes activas por plan
      if (res.status === 402 && data?.code === "PLAN_LIMIT_REACHED") {
        toast.error(
          data?.error ||
            "Has alcanzado el límite de vacantes activas para tu plan.",
          {
            description:
              typeof data?.maxActiveJobs === "number"
                ? `Vacantes activas: ${data.currentActiveJobs ?? "?"} / ${
                    data.maxActiveJobs
                  }. Cierra una vacante o mejora tu plan para publicar más.`
                : undefined,
          }
        );
        // ⛔️ Importante: NO lanzamos error aquí para no duplicar toast
        return;
      }

      // Para otros errores, lanzamos y dejamos que el catch muestre el toast
      throw new Error(data?.error || "Error al publicar la vacante");
    }

    toast.success("Vacante publicada correctamente 🎉");
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    router.push(`/dashboard/jobs/${data.id}/applications`);
  } catch (err: any) {
    console.error("Error en handlePublish:", err);

    const msg =
      (err && typeof err.message === "string" && err.message) ||
      "Ocurrió un error al guardar la vacante";

    toast.error(msg);
  } finally {
    setBusy(false);
  }
}

  // DnD helpers
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
    const payload = JSON.parse(data) as {
      kind: "skill" | "edu";
      name: string;
      from: "req" | "nice";
    };
    if (payload.kind !== "skill" || payload.from === to) return;

    if (to === "req") {
      if (!requiredSkills.includes(payload.name)) {
        setRequiredSkills((p) => [...p, payload.name]);
      }
      setNiceSkills((p) => p.filter((n) => n !== payload.name));
    } else {
      if (!niceSkills.includes(payload.name)) {
        setNiceSkills((p) => [...p, payload.name]);
      }
      setRequiredSkills((p) => p.filter((n) => n !== payload.name));
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
        setEduRequired((p) => [...p, payload.name]);
      }
      setEduNice((p) => p.filter((n) => n !== payload.name));
    } else {
      if (!eduNice.includes(payload.name)) {
        setEduNice((p) => [...p, payload.name]);
      }
      setEduRequired((p) => p.filter((n) => n !== payload.name));
    }
  }

  // adders
  function addSkillByName(name: string, to: "req" | "nice" = "req") {
    const n = name.trim();
    if (!n) return;
    if (requiredSkills.includes(n) || niceSkills.includes(n)) return;
    if (to === "req") setRequiredSkills((p) => [...p, n]);
    else setNiceSkills((p) => [...p, n]);
    setSkillQuery("");
  }
  function addEduByName(name: string, to: "req" | "nice" = "req") {
    const n = name.trim();
    if (!n) return;
    if (eduRequired.includes(n) || eduNice.includes(n)) return;
    if (to === "req") setEduRequired((p) => [...p, n]);
    else setEduNice((p) => [...p, n]);
    setEducationQuery("");
  }
  function addCert(c: string) {
    const n = c.trim();
    if (!n) return;
    if (certs.includes(n)) return;
    setCerts((p) => [...p, n]);
    setCertQuery("");
  }

  // location structured handler
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
      setLocationLat(
        typeof next.lat === "number" && Number.isFinite(next.lat) ? next.lat : null
      );
      setLocationLng(
        typeof next.lng === "number" && Number.isFinite(next.lng) ? next.lng : null
      );
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

  /* =============================
     RENDER
  ============================= */
  return (
    <div className="space-y-6">
      <Stepper step={step} onJump={(n) => setStep(n)} />

      {/* Banner de borrador */}
      {hasDraft && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800/70 dark:bg-amber-900/20">
          <span>Tienes un borrador sin publicar. ¿Deseas restaurarlo?</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1 hover:bg-white/60 dark:border-amber-700"
              onClick={restoreDraft}
            >
              Restaurar
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1 hover:bg-white/60 dark:border-amber-700"
              onClick={discardDraft}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Paso 1 */}
      {step === 1 && (
        <section
          className="
            grid gap-4 rounded-2xl
            border border-zinc-200/70 dark:border-zinc-800/70
            bg-white/70 dark:bg-zinc-900/50 backdrop-blur
            p-4 md:p-6
          "
        >
          <h3 className="font-semibold">1) Datos básicos</h3>

          {/* Plantillas */}
          {templates.length > 0 && (
            <div className="grid gap-1">
              <label className="text-sm">Usar vacante anterior (plantilla)</label>
              <div className="flex gap-2">
                <select
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
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
                  className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  disabled={!selectedTemplateId}
                  onClick={() => applyTemplateById(selectedTemplateId)}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-1">
            <label className="text-sm">Nombre de la vacante *</label>
            <input
              className="rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
                  Mi empresa{" "}
                  {presetCompany?.name ? `(${presetCompany.name})` : "(no asignada)"}
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
                className="rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType)}
              >
                <option value="REMOTE">Remoto</option>
                <option value="HYBRID">Híbrido</option>
                <option value="ONSITE">Presencial</option>
              </select>

              {(locationType === "HYBRID" || locationType === "ONSITE") && (
                <div className="mt-2">
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

            {/* Sueldo */}
            <div className="grid gap-1">
              <label className="text-sm">Sueldo (opcional)</label>
              <div className="grid grid-cols-[minmax(84px,96px)_1fr_1fr] gap-2 items-center">
                <select
                  className="rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
                <input
                  className="min-w-0 rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                  type="number"
                  placeholder="Mín."
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  min={0}
                />
                <input
                  className="min-w-0 rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
        <section
          className="
            grid gap-4 rounded-2xl
            border border-zinc-200/70 dark:border-zinc-800/70
            bg-white/70 dark:bg-zinc-900/50 backdrop-blur
            p-4 md:p-6
          "
        >
          <h3 className="font-semibold">2) Tipo de empleo</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-sm">Tipo *</label>
              <select
                className="rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
                className="rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
        <section
          className="
            grid gap-4 rounded-2xl
            border border-zinc-200/70 dark:border-zinc-800/70
            bg-white/70 dark:bg-zinc-900/50 backdrop-blur
            p-4 md:p-6
          "
        >
          <h3 className="font-semibold">3) Prestaciones</h3>

          <div
            className="
              rounded-lg border
              border-emerald-300/70 dark:border-emerald-800/70
              bg-emerald-50/80 dark:bg-emerald-900/20
              p-3 flex items-center justify-between
            "
          >
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

          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {BENEFITS.map((b) => {
              const checked = !!benefits[b.key];
              const setChecked = (val: boolean) =>
                setBenefits((prev) => ({ ...prev, [b.key]: val }));

              return (
                <div
                  key={b.key}
                  className="
                    rounded-md border
                    border-zinc-200/70 dark:border-zinc-800/70
                    bg-white/60 dark:bg-zinc-900/40
                    p-3
                  "
                >
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
                          className="w-20 rounded border border-zinc-300 bg-white p-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                          className="w-20 rounded border border-zinc-300 bg-white p-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
                          className="w-20 rounded border border-zinc-300 bg-white p-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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

      {/* Paso 4 con Tabs reales */}
      {step === 4 && (
        <section
          className="
            grid gap-4 rounded-2xl
            border border-zinc-200/70 dark:border-zinc-800/70
            bg-white/70 dark:bg-zinc-900/50 backdrop-blur
            p-4 md:p-6
          "
        >
          {/* Tabs */}
          <div className="flex items-center gap-2">
            {[
              { k: "desc", lbl: "Descripción" },
              { k: "skills", lbl: "Skills / Certs" },
              { k: "edu", lbl: "Educación" },
            ].map((t) => (
              <button
                key={t.k}
                className={clsx(
                  "rounded-md px-3 py-1.5",
                  tab4 === (t.k as any)
                    ? "bg-emerald-600 text-white"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
                onClick={() => setTab4(t.k as any)}
              >
                {t.lbl}
              </button>
            ))}
          </div>

          {/* DESCRIPCIÓN */}
          {tab4 === "desc" && (
            <div className="grid gap-2">
              <label className="text-sm">Descripción de la vacante *</label>
              <RichTextBox
                valueHtml={descriptionHtml}
                onChangeHtml={(html, plain) => {
                  setDescriptionHtml(html);
                  setDescriptionPlain(plain);
                }}
              />
              <div
                className={clsx(
                  "text-xs",
                  descLength < 20 && "text-red-500",
                  descLength >= 20 && descLength < 50 && "text-amber-600",
                  descLength >= 50 && "text-emerald-600"
                )}
              >
                {descLength} / 50
              </div>
            </div>
          )}

          {/* SKILLS / CERTS */}
          {tab4 === "skills" && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Skills / Lenguajes</label>
                </div>

                <div className="relative">
                  <input
                    className="w-full rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                    placeholder="Busca (ej. Python, AWS, React Native...) y presiona Enter"
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === "Tab") && skillQuery.trim()) {
                        e.preventDefault();
                        addSkillByName(
                          filteredSkills[0] || skillQuery.trim(),
                          "req"
                        );
                      }
                    }}
                    aria-autocomplete="list"
                    aria-expanded={!!skillQuery}
                  />
                  {skillQuery && (
                    <div
                      className="
                        absolute z-20 mt-1 max-h-60 w-full overflow-auto
                        rounded-md border border-zinc-200 dark:border-zinc-800
                        bg-white dark:bg-zinc-900 shadow-lg
                      "
                    >
                      {filteredSkills.length === 0 ? (
                        <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
                      ) : (
                        filteredSkills.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                            onClick={() => addSkillByName(s, "req")}
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
                <div className="grid sm:grid-cols-2 gap-3">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropSkills(e, "req")}
                    className="rounded-md border border-zinc-200/70 bg-white/60 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/40"
                  >
                    <p className="mb-2 text-xs font-medium text-zinc-600">Obligatoria</p>
                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                      {requiredSkills.length === 0 ? (
                        <span className="text-xs text-zinc-400">Arrastra aquí</span>
                      ) : (
                        requiredSkills.map((name) => (
                          <span
                            key={name}
                            draggable
                            onDragStart={(e) =>
                              onDragStart(e, { kind: "skill", name, from: "req" })
                            }
                            className="
                              inline-flex items-center gap-2 rounded-full border
                              border-zinc-200 bg-zinc-50 px-3 py-1 text-xs
                              dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200
                            "
                          >
                            {name}
                            <button
                              type="button"
                              className="text-zinc-500 hover:text-red-600"
                              onClick={() =>
                                setRequiredSkills((p) => p.filter((x) => x !== name))
                              }
                              title="Quitar"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropSkills(e, "nice")}
                    className="rounded-md border border-zinc-200/70 bg-white/60 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/40"
                  >
                    <p className="mb-2 text-xs font-medium text-zinc-600">Deseable</p>
                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                      {niceSkills.length === 0 ? (
                        <span className="text-xs text-zinc-400">Sin elementos</span>
                      ) : (
                        niceSkills.map((name) => (
                          <span
                            key={name}
                            draggable
                            onDragStart={(e) =>
                              onDragStart(e, { kind: "skill", name, from: "nice" })
                            }
                            className="
                              inline-flex items-center gap-2 rounded-full border
                              border-zinc-200 bg-zinc-50 px-3 py-1 text-xs
                              dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200
                            "
                          >
                            {name}
                            <button
                              type="button"
                              className="text-zinc-500 hover:text-red-600"
                              onClick={() =>
                                setNiceSkills((p) => p.filter((x) => x !== name))
                              }
                              title="Quitar"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Certificaciones */}
              <div className="grid gap-2">
                <label className="text-sm">Certificaciones (opcional)</label>
                <div className="relative">
                  <input
                    className="w-full rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
                    <div
                      className="
                        absolute z-20 mt-1 max-h-60 w-full overflow-auto
                        rounded-md border border-zinc-200 dark:border-zinc-800
                        bg-white dark:bg-zinc-900 shadow-lg
                      "
                    >
                      {filteredCerts.length === 0 ? (
                        <div className="p-2 text-sm text-zinc-500">Sin resultados</div>
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
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        {c}
                        <button
                          type="button"
                          className="text-zinc-500 hover:text-red-600"
                          onClick={() => setCerts((p) => p.filter((x) => x !== c))}
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
            </div>
          )}

          {/* EDUCACIÓN */}
          {tab4 === "edu" && (
            <div className="grid gap-2">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-sm">Nivel mínimo</label>
                  <select
                    className="rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
                      className="w-full rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                      placeholder="Ej. Ingeniería en Sistemas, Maestría en TI... (Enter agrega)"
                      value={educationQuery}
                      onChange={(e) => setEducationQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === "Tab") && educationQuery.trim()) {
                          e.preventDefault();
                          addEduByName(
                            filteredEducation[0] || educationQuery.trim(),
                            "req"
                          );
                        }
                      }}
                      aria-autocomplete="list"
                      aria-expanded={!!educationQuery}
                    />
                    {educationQuery && (
                      <div
                        className="
                          absolute z-20 mt-1 max-h-72 w-full overflow-auto
                          rounded-md border border-zinc-200 dark:border-zinc-800
                          bg-white dark:bg-zinc-900 shadow-lg
                        "
                      >
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
                              onClick={() => addEduByName(s, "req")}
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

              {/* bins educación */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropEdu(e, "req")}
                  className="rounded-md border border-zinc-200/70 bg-white/60 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/40"
                >
                  <p className="mb-2 text-xs font-medium text-zinc-600">Obligatoria</p>
                  <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {eduRequired.length === 0 ? (
                      <span className="text-xs text-zinc-400">Sin elementos</span>
                    ) : (
                      eduRequired.map((name) => (
                        <span
                          key={name}
                          draggable
                          onDragStart={(e) =>
                            onDragStart(e, { kind: "edu", name, from: "req" })
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          {name}
                          <button
                            type="button"
                            className="text-zinc-500 hover:text-red-600"
                            onClick={() =>
                              setEduRequired((p) => p.filter((x) => x !== name))
                            }
                            title="Quitar"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropEdu(e, "nice")}
                  className="rounded-md border border-zinc-200/70 bg-white/60 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/40"
                >
                  <p className="mb-2 text-xs font-medium text-zinc-600">Deseable</p>
                  <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {eduNice.length === 0 ? (
                      <span className="text-xs text-zinc-400">Sin elementos</span>
                    ) : (
                      eduNice.map((name) => (
                        <span
                          key={name}
                          draggable
                          onDragStart={(e) =>
                            onDragStart(e, { kind: "edu", name, from: "nice" })
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          {name}
                          <button
                            type="button"
                            className="text-zinc-500 hover:text-red-600"
                            onClick={() => setEduNice((p) => p.filter((x) => x !== name))}
                            title="Quitar"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navegación */}
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

      {/* Paso 5 (Revisión) */}
      {step === 5 && (
        <section
          className="
            grid gap-4 rounded-2xl
            border border-zinc-200/70 dark:border-zinc-800/70
            bg-white/70 dark:bg-zinc-950/50 backdrop-blur
            p-4 md:p-6
          "
        >
          <h3 className="font-semibold">5) Revisión y publicación</h3>

          <div className="grid gap-3 text-sm">
            <div>
              <strong>Vacante:</strong> {title}
            </div>
            <div>
              <strong>Empresa:</strong>{" "}
              {companyMode === "confidential"
                ? "Confidencial"
                : presetCompany?.name || "Mi empresa"}
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
                    if (k === "aguinaldo")
                      return <li key={k}>Aguinaldo: {aguinaldoDias} días</li>;
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
              <div
                className={`${reviewBox} prose prose-zinc dark:prose-invert`}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(descriptionHtml) }}
              />
            </div>

            <div>
              <strong>Educación — nivel mínimo:</strong> {labelDegree(minDegree)}
            </div>
            <div>
              <strong>Formación académica:</strong>{" "}
              {[
                ...eduRequired.map((n) => `Req: ${n}`),
                ...eduNice.map((n) => `Dese: ${n}`),
              ].join(", ") || "—"}
            </div>

            <div>
              <strong>Skills:</strong>{" "}
              {[
                ...requiredSkills.map((n) => `Req: ${n}`),
                ...niceSkills.map((n) => `Dese: ${n}`),
              ].join(", ") || "—"}
            </div>
            <div>
              <strong>Certificaciones:</strong> {certs.length ? certs.join(", ") : "—"}
            </div>
          </div>

          <div
            className="
              sticky bottom-0 mt-2 -mx-4
              border-t border-zinc-200/70 dark:border-zinc-800/70
              bg-white/80 dark:bg-zinc-950/50 backdrop-blur
              p-4 md:p-6
            "
          >
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

/* =============================
   Helpers de labels
============================= */
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
