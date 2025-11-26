// app/dashboard/jobs/new/JobWizard.tsx
"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { createStringFuse, searchStrings } from "@/lib/search/fuse";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import JobRichTextEditor from "@/components/jobs/JobRichTextEditor";
import { Briefcase, Clock3 } from "lucide-react";
import { z } from "zod";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useFieldArray,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LANGUAGES_FALLBACK } from "@/lib/skills";

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
  // Soporte SSR: si no hay window/document, hacemos un strip básico
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

/* =============================
   Tipos
============================= */
type PresetCompany = { id: string | null; name: string | null };

type LocationType = "REMOTE" | "HYBRID" | "ONSITE";
type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "INTERNSHIP";
type Currency = "MXN" | "USD";
type DegreeLevel = "HIGHSCHOOL" | "TECH" | "BACHELOR" | "MASTER" | "PHD";
type LanguageProficiency =
  | "NATIVE"
  | "PROFESSIONAL"
  | "CONVERSATIONAL"
  | "BASIC";

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
  languages?: Array<{ name: string; level: LanguageProficiency }> | null;
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
    // Idiomas requeridos de la vacante
    languages?: Array<{ name: string; level: LanguageProficiency }>;
  };
};

/* =============================
   Constantes
============================= */
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

const EMPLOYMENT_OPTIONS: {
  value: EmploymentType;
  label: string;
  subtitle: string;
}[] = [
  {
    value: "FULL_TIME",
    label: "Tiempo completo",
    subtitle: "Jornada laboral estándar, puesto base.",
  },
  {
    value: "PART_TIME",
    label: "Medio tiempo",
    subtitle: "Ideal para estudiantes o segundo empleo.",
  },
  {
    value: "CONTRACT",
    label: "Por periodo",
    subtitle: "Proyecto con fecha de inicio y fin.",
  },
  {
    value: "INTERNSHIP",
    label: "Prácticas profesionales",
    subtitle: "Perfil junior / trainee.",
  },
];

const SCHEDULE_PRESETS = [
  { label: "Oficina clásica", value: "L-V 9:00–18:00" },
  { label: "Oficina temprana", value: "L-V 8:00–17:00" },
  { label: "Banco / retail", value: "L-S 9:00–18:00" },
  { label: "Turno vespertino", value: "L-V 13:00–22:00" },
];

/* =============================
   Zod schema + RHF types
============================= */
const jobSchema = z
  .object({
    // Paso 1
    title: z.string().min(3, "Mínimo 3 caracteres."),
    companyMode: z.enum(["own", "confidential"]),
    companyOtherName: z.string().optional(),
    locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
    city: z.string().optional(),
    country: z.string().optional(),
    admin1: z.string().optional(),
    cityNorm: z.string().optional(),
    admin1Norm: z.string().optional(),
    locationLat: z.number().nullable().optional(),
    locationLng: z.number().nullable().optional(),
    currency: z.enum(["MXN", "USD"]),
    salaryMin: z.string().optional(),
    salaryMax: z.string().optional(),
    showSalary: z.boolean(),
    // Paso 2
    employmentType: z.enum([
      "FULL_TIME",
      "PART_TIME",
      "CONTRACT",
      "INTERNSHIP",
    ]),
    schedule: z.string().optional(),
    // Paso 3
    showBenefits: z.boolean(),
    benefits: z.record(z.boolean()),
    aguinaldoDias: z.number().min(0),
    vacacionesDias: z.number().min(0),
    primaVacPct: z.number().min(0).max(100),
    // Paso 4
    descriptionHtml: z.string().optional(),
    descriptionPlain: z.string().min(50, "Mínimo 50 caracteres."),
    minDegree: z.enum(["HIGHSCHOOL", "TECH", "BACHELOR", "MASTER", "PHD"]),
    eduRequired: z.array(z.string()),
    eduNice: z.array(z.string()),
    requiredSkills: z.array(z.string()),
    niceSkills: z.array(z.string()),
    certs: z.array(z.string()),
    // Idiomas requeridos
    languages: z.array(
      z.object({
        name: z.string(),
        level: z.enum([
          "NATIVE",
          "PROFESSIONAL",
          "CONVERSATIONAL",
          "BASIC",
        ]),
      })
    ),
  })
  .superRefine((data, ctx) => {
    if (
      (data.locationType === "HYBRID" ||
        data.locationType === "ONSITE") &&
      !data.city?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para híbrido/presencial, la ciudad es obligatoria.",
        path: ["city"],
      });
    }

    const min = data.salaryMin ? Number(data.salaryMin) : undefined;
    const max = data.salaryMax ? Number(data.salaryMax) : undefined;

    if (data.salaryMin && (Number.isNaN(min) || (min as number) < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El sueldo mínimo debe ser ≥ 0.",
        path: ["salaryMin"],
      });
    }
    if (data.salaryMax && (Number.isNaN(max) || (max as number) < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El sueldo máximo debe ser ≥ 0.",
        path: ["salaryMax"],
      });
    }
    if (
      typeof min === "number" &&
      typeof max === "number" &&
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      min > max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "El sueldo mínimo no puede ser mayor que el máximo.",
        path: ["salaryMin"],
      });
    }
  });

type JobForm = z.infer<typeof jobSchema>;

/* =============================
   Stepper
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
  const [maxStepVisited, setMaxStepVisited] = useState(1);
  const [tab4, setTab4] = useState<"desc" | "skills" | "langs" | "edu">(
    "desc"
  );
  const [busy, setBusy] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const methods = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: makeDefaultValues({ presetCompany, initial }),
    mode: "onBlur",
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

  // Derivados para paso 1 y 4
  const locationType = watch("locationType");
  const title = watch("title");
  const city = watch("city");
  const salaryMin = watch("salaryMin");
  const salaryMax = watch("salaryMax");

  const descriptionPlain = watch("descriptionPlain") || "";
  const descLength = descriptionPlain.replace(/\s+/g, "").length;

  const canNext1 =
    !!title?.trim() &&
    !(
      (locationType === "HYBRID" || locationType === "ONSITE") &&
      !city?.trim()
    ) &&
    !(
      salaryMin &&
      salaryMax &&
      !Number.isNaN(Number(salaryMin)) &&
      !Number.isNaN(Number(salaryMax)) &&
      Number(salaryMin) > Number(salaryMax)
    );

  const canNext4 = descLength >= 50;

  // Aplicar plantilla
  function applyTemplateById(id: string) {
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;

    const html = sanitizeHtml(tpl.descriptionHtml || "");
    const plain = tpl.description
      ? tpl.description
      : html
      ? htmlToPlain(html)
      : "";

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

  // Envío
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

      // Paso 4 — HTML + texto plano
      const safeHtml = sanitizeHtml((v.descriptionHtml || "").trim());
      const safePlain =
        v.descriptionPlain.trim() || htmlToPlain(safeHtml);

      // ahora sí guardamos ambos campos
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
              "Has alcanzado el límite de vacantes activas para tu plan.",
            {
              description:
                typeof data?.maxActiveJobs === "number"
                  ? `Vacantes activas: ${
                      data.currentActiveJobs ?? "?"
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

      toast.success("Vacante publicada correctamente 🎉");
      router.push(`/dashboard/jobs/${data.id}/applications`);
    } catch (err: any) {
      console.error("Error en handlePublish:", err);
      toast.error(
        (err && typeof err.message === "string" && err.message) ||
          "Ocurrió un error al guardar la vacante"
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

  // Helper para avanzar controlando paso máximo visitado
  function goNextStep(next: number) {
    setStep(next);
    setMaxStepVisited((prev) => Math.max(prev, next));
  }

  function handleStepClick(target: number) {
    if (target <= maxStepVisited) {
      setStep(target);
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
        <div className="space-y-6">
          <Stepper step={step} onJump={handleStepClick} />

          {/* Paso 1 */}
          {step === 1 && (
            <section className="grid gap-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 backdrop-blur p-4 md:p-6">
              <h3 className="font-semibold">1) Datos básicos</h3>

              {/* Plantillas */}
              {templates.length > 0 && (
                <div className="grid gap-1">
                  <label className="text-sm">
                    Usar vacante anterior (plantilla)
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
                      value={selectedTemplateId}
                      onChange={(e) =>
                        setSelectedTemplateId(e.target.value)
                      }
                    >
                      <option value="">
                        — Selecciona una vacante —
                      </option>
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
                      onClick={() =>
                        applyTemplateById(selectedTemplateId)
                      }
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              )}

              {/* Título */}
              <div className="grid gap-1">
                <label className="text-sm">
                  Nombre de la vacante *
                </label>
                <input
                  className={inputCls(errors.title)}
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-xs text-red-600">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Empresa */}
              <div className="grid gap-1">
                <label className="text-sm">Empresa *</label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="own"
                      {...register("companyMode")}
                      disabled={!presetCompany?.id}
                    />
                    <span>
                      Mi empresa{" "}
                      {presetCompany?.name
                        ? `(${presetCompany.name})`
                        : "(no asignada)"}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="confidential"
                      {...register("companyMode")}
                    />
                    <span>Confidencial (ocultar nombre)</span>
                  </label>
                </div>
              </div>

              {/* Ubicación + Sueldo */}
              <div className="grid md:grid-cols-2 gap-3">
                {/* Ubicación */}
                <div className="grid gap-1">
                  <label className="text-sm">Ubicación *</label>
                  <select
                    className="rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                    {...register("locationType")}
                  >
                    <option value="REMOTE">Remoto</option>
                    <option value="HYBRID">Híbrido</option>
                    <option value="ONSITE">Presencial</option>
                  </select>

                  {(locationType === "HYBRID" ||
                    locationType === "ONSITE") && (
                    <div className="mt-2">
                      <Controller
                        control={control}
                        name="city"
                        render={({ field: { value, onChange } }) => (
                          <LocationAutocomplete
                            value={value || ""}
                            onChange={(next: any) => {
                              if (typeof next === "string") {
                                onChange(next);
                                return;
                              }
                              if (
                                next &&
                                typeof next === "object"
                              ) {
                                onChange(
                                  next.label || next.city || ""
                                );
                                setValue(
                                  "country",
                                  next.country || ""
                                );
                                setValue(
                                  "admin1",
                                  next.admin1 || ""
                                );
                                setValue(
                                  "cityNorm",
                                  next.cityNorm || ""
                                );
                                setValue(
                                  "admin1Norm",
                                  next.admin1Norm || ""
                                );
                                setValue(
                                  "locationLat",
                                  typeof next.lat === "number" &&
                                    Number.isFinite(next.lat)
                                    ? next.lat
                                    : null
                                );
                                setValue(
                                  "locationLng",
                                  typeof next.lng === "number" &&
                                    Number.isFinite(next.lng)
                                    ? next.lng
                                    : null
                                );
                                return;
                              }
                              onChange("");
                              setValue("country", "");
                              setValue("admin1", "");
                              setValue("cityNorm", "");
                              setValue("admin1Norm", "");
                              setValue("locationLat", null);
                              setValue("locationLng", null);
                            }}
                            onPlace={() => {}}
                            countries={["mx"]}
                          />
                        )}
                      />
                    </div>
                  )}
                  {errors.city && (
                    <p className="text-xs text-red-600">
                      {errors.city.message as string}
                    </p>
                  )}
                </div>

                {/* Sueldo */}
                <div className="grid gap-1">
                  <label className="text-sm">
                    Sueldo (opcional)
                  </label>
                  <div className="grid grid-cols-[minmax(84px,96px)_1fr_1fr] gap-2 items-center">
                    <select
                      className="rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                      {...register("currency")}
                    >
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      className={inputCls(errors.salaryMin)}
                      type="number"
                      placeholder="Mín."
                      {...register("salaryMin")}
                      min={0}
                    />
                    <input
                      className={inputCls(errors.salaryMax)}
                      type="number"
                      placeholder="Máx."
                      {...register("salaryMax")}
                      min={0}
                    />
                  </div>
                  {(errors.salaryMin || errors.salaryMax) && (
                    <p className="text-xs text-red-600">
                      {(errors.salaryMin?.message as string) ||
                        (errors.salaryMax?.message as string)}
                    </p>
                  )}
                  <label className="mt-1 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      {...register("showSalary")}
                    />
                    Mostrar sueldo
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="rounded-md border px-4 py-2"
                  disabled
                >
                  Atrás
                </button>
                <button
                  type="button"
                  className={clsx(
                    "rounded-md px-4 py-2 text-white",
                    canNext1
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-emerald-300"
                  )}
                  disabled={!canNext1}
                  onClick={() => goNextStep(2)}
                >
                  Siguiente
                </button>
              </div>
            </section>
          )}

          {/* Paso 2 */}
          {step === 2 && (
            <section className="grid gap-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 backdrop-blur p-4 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-emerald-500" />
                  <span>2) Tipo de empleo</span>
                </h3>
                <div className="hidden text-xs text-zinc-500 sm:inline">
                  Elige el tipo de contrato y un horario de referencia.
                </div>
              </div>

              {/* Cards de tipo de empleo */}
              <div className="grid gap-3">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Tipo de contrato *
                </label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                          "group flex h-full flex-col items-start rounded-xl border px-3 py-2 text-left text-xs sm:text-sm transition",
                          active
                            ? "border-emerald-500 bg-emerald-50/80 text-emerald-900 shadow-sm dark:border-emerald-500/80 dark:bg-emerald-900/10 dark:text-emerald-100"
                            : "border-zinc-200 bg-white/80 text-zinc-700 hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-emerald-500/70 dark:hover:bg-emerald-900/10"
                        )}
                      >
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
                          <span className="font-medium">
                            {opt.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
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
                <input
                  className="rounded-md border border-zinc-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Ej. L-V 9:00–18:00, esquema híbrido 3 días oficina / 2 remoto..."
                  {...register("schedule")}
                />
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {SCHEDULE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20"
                      onClick={() =>
                        setValue("schedule", p.value, {
                          shouldDirty: true,
                        })
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Este campo es informativo. No afecta filtros ni
                  validaciones.
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  className="rounded-md border px-4 py-2"
                  onClick={() => setStep(1)}
                >
                  Atrás
                </button>
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
                  onClick={() => goNextStep(3)}
                >
                  Siguiente
                </button>
              </div>
            </section>
          )}

          {/* Paso 3 - Prestaciones */}
          {step === 3 && (
            <section className="grid gap-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 backdrop-blur p-4 md:p-6">
              <h3 className="font-semibold">3) Prestaciones</h3>

              <div className="rounded-lg border border-emerald-300/70 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-900/20 p-3 flex items-center justify-between">
                <div className="text-sm">
                  <strong>Visibilidad:</strong> Mostrar prestaciones en
                  la publicación
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...register("showBenefits")}
                  />
                  {showBenefits ? "Sí" : "No"}
                </label>
              </div>

              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {BENEFITS.map((b) => {
                  const checked = !!benefits[b.key];
                  return (
                    <div
                      key={b.key}
                      className="rounded-md border border-zinc-200/70 dark:border-zinc-800/70 bg-white/60 dark:bg-zinc-900/40 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          id={`benefit-${b.key}`}
                          type="checkbox"
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
                        <label
                          htmlFor={`benefit-${b.key}`}
                          className="text-sm cursor-pointer select-none"
                        >
                          {b.label}
                        </label>

                        {checked && b.key === "aguinaldo" && (
                          <NumberMini
                            label="Días"
                            field="aguinaldoDias"
                          />
                        )}
                        {checked && b.key === "vacaciones" && (
                          <NumberMini
                            label="Días"
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
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  className="rounded-md border px-4 py-2"
                  onClick={() => setStep(2)}
                >
                  Atrás
                </button>
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
                  onClick={() => goNextStep(4)}
                >
                  Siguiente
                </button>
              </div>
            </section>
          )}

          {/* Paso 4 */}
          {step === 4 && (
            <section className="grid gap-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 backdrop-blur p-4 md:p-6">
              {/* Tabs */}
              <div className="flex items-center gap-2">
                {[
                  { k: "desc", lbl: "Descripción" },
                  { k: "skills", lbl: "Skills / Certs" },
                  { k: "langs", lbl: "Idiomas" },
                  { k: "edu", lbl: "Educación" },
                ].map((t) => (
                  <button
                    key={t.k}
                    type="button"
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
                  <label className="text-sm">
                    Descripción de la vacante *
                  </label>
                  <Controller
                    name="descriptionHtml"
                    control={control}
                    render={({ field: { value, onChange } }) => (
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
                    )}
                  />
                  <div
                    className={clsx(
                      "text-xs",
                      descLength < 20 && "text-red-500",
                      descLength >= 20 &&
                        descLength < 50 &&
                        "text-amber-600",
                      descLength >= 50 && "text-emerald-600"
                    )}
                  >
                    {descLength} / 50
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
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm">
                      Skills / Lenguajes
                    </label>

                    <div className="relative">
                      <input
                        className="w-full rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Bin
                        title="Obligatoria"
                        items={requiredSkills}
                        placeholder="Arrastra aquí"
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
                  <div className="grid gap-2">
                    <label className="text-sm">
                      Certificaciones (opcional)
                    </label>
                    <div className="relative">
                      <input
                        className="w-full rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            {c}
                            <button
                              type="button"
                              className="text-zinc-500 hover:text-red-600"
                              onClick={() =>
                                setValue(
                                  "certs",
                                  certs.filter((x) => x !== c),
                                  { shouldDirty: true }
                                )
                              }
                              title="Quitar"
                            >
                              ×
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
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Idiomas requeridos (opcional)
                    </label>
                    <button
                      type="button"
                      className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      onClick={() =>
                        addLanguageRow({
                          name: "Inglés",
                          level: "PROFESSIONAL",
                        })
                      }
                    >
                      + Añadir idioma
                    </button>
                  </div>

                  {languageFields.length === 0 && (
                    <p className="text-xs text-zinc-500">
                      Añade uno o más idiomas relevantes para la
                      vacante (ej. Inglés profesional).
                    </p>
                  )}

                  <div className="grid gap-2">
                    {languageFields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] gap-2 items-center"
                      >
                        <select
                          className="rounded-md border border-zinc-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
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
                          className="rounded-md border border-zinc-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                          {...register(
                            `languages.${idx}.level` as const
                          )}
                        >
                          <option value="NATIVE">Nativo</option>
                          <option value="PROFESSIONAL">
                            Profesional (C1–C2)
                          </option>
                          <option value="CONVERSATIONAL">
                            Conversacional (B1–B2)
                          </option>
                          <option value="BASIC">
                            Básico (A1–A2)
                          </option>
                        </select>

                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs text-zinc-500 hover:text-red-600 hover:border-red-300 dark:border-zinc-700"
                          onClick={() => removeLanguageRow(idx)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
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
                        {...register("minDegree")}
                      >
                        <option value="HIGHSCHOOL">
                          Bachillerato
                        </option>
                        <option value="TECH">Técnico</option>
                        <option value="BACHELOR">
                          Licenciatura / Ingeniería
                        </option>
                        <option value="MASTER">Maestría</option>
                        <option value="PHD">Doctorado</option>
                      </select>
                    </div>

                    <div className="grid gap-1">
                      <label className="text-sm">
                        Agregar educación (programa / carrera)
                      </label>
                      <div className="relative">
                        <input
                          className="w-full rounded-md border border-zinc-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 dark:border-zinc-700 dark:bg-zinc-900"
                          placeholder="Ej. Ingeniería en Sistemas, Maestría en TI... (Enter agrega)"
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

                  {/* bins educación */}
                  <div className="grid sm:grid-cols-2 gap-3">
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
                </div>
              )}

              {/* Navegación paso 4 */}
              <div className="flex justify-between">
                <button
                  type="button"
                  className="rounded-md border px-4 py-2"
                  onClick={() => setStep(3)}
                >
                  Atrás
                </button>
                <button
                  type="button"
                  className={clsx(
                    "rounded-md px-4 py-2 text-white",
                    canNext4
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-emerald-300"
                  )}
                  disabled={!canNext4}
                  onClick={() => goNextStep(5)}
                >
                  Siguiente
                </button>
              </div>
            </section>
          )}

          {/* Paso 5 - Revisión */}
          {step === 5 && (
            <section className="grid gap-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/50 backdrop-blur p-4 md:p-6">
              <h3 className="font-semibold">
                5) Revisión y publicación
              </h3>

              {/* Bloque general de revisión */}
              <ReviewBlock presetCompany={presetCompany} />

              <div className="sticky bottom-0 mt-2 -mx-4 border-t border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-950/50 backdrop-blur p-4 md:p-6">
                <div className="flex justify-between">
                  <button
                    type="button"
                    className="rounded-md border px-4 py-2"
                    onClick={() => setStep(4)}
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:bg-emerald-300"
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
            </section>
          )}
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
    <div className="ml-auto flex items-center gap-2 text-xs">
      <span className="text-zinc-500">{label}:</span>
      <input
        type="number"
        min={0}
        max={max}
        className="w-20 rounded border border-zinc-300 bg-white p-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
      className="rounded-md border border-zinc-200/70 bg-white/60 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/40"
    >
      <p className="mb-2 text-xs font-medium text-zinc-600">
        {title}
      </p>
      <div className="flex flex-wrap gap-2 min-h-[32px]">
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
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {name}
              <button
                type="button"
                className="text-zinc-500 hover:text-red-600"
                onClick={() => onRemove(name)}
                title="Quitar"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function ReviewBlock({ presetCompany }: { presetCompany: PresetCompany }) {
  const { watch } = useFormContext<JobForm>();
  const v = watch();

  const isRemote = v.locationType === "REMOTE";
  const locationText = isRemote
    ? "Remoto"
    : `${v.locationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${
        v.city || ""
      }`;

  const hasSalary = Boolean(v.salaryMin || v.salaryMax);
  const salaryText = hasSalary
    ? `${v.currency} ${v.salaryMin || "—"} - ${v.salaryMax || "—"} ${
        v.showSalary ? "(visible)" : "(oculto)"
      }`
    : "No especificado";

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

  const eduText =
    [
      ...(v.eduRequired || []).map((n) => `Req: ${n}`),
      ...(v.eduNice || []).map((n) => `Dese: ${n}`),
    ].join(", ") || "";

  const skillsText =
    [
      ...(v.requiredSkills || []).map((n) => `Req: ${n}`),
      ...(v.niceSkills || []).map((n) => `Dese: ${n}`),
    ].join(", ") || "—";

  const hasCerts = v.certs && v.certs.length > 0;
  const certsText = hasCerts ? v.certs!.join(", ") : "";

  const hasLanguages = v.languages && v.languages.length > 0;

  // 🔹 HTML saneado para usar en el resumen
  const safeDescriptionHtml = sanitizeHtml(v.descriptionHtml || "");

  return (
    <div className="grid gap-3 text-sm">
      <div>
        <strong>Vacante:</strong> {v.title}
      </div>

      <div>
        <strong>Empresa:</strong>{" "}
        {v.companyMode === "confidential"
          ? "Confidencial"
          : presetCompany?.name || "Mi empresa"}
      </div>

      <div>
        <strong>Ubicación:</strong> {locationText}
      </div>

      <div>
        <strong>Sueldo:</strong> {salaryText}
      </div>

      <div>
        <strong>Tipo:</strong> {labelEmployment(v.employmentType)}
      </div>

      {v.schedule && (
        <div>
          <strong>Horario:</strong> {v.schedule}
        </div>
      )}

      <div>
        <strong>Prestaciones visibles:</strong>{" "}
        {v.showBenefits ? "Sí" : "No"}
      </div>

      {v.showBenefits && benefitsList.length > 0 && (
        <ul className="ml-4 list-disc">
          {benefitsList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <div>
        <strong>Educación — nivel mínimo:</strong>{" "}
        {labelDegree(v.minDegree)}
      </div>

      {hasEduItems && (
        <div>
          <strong>Formación académica:</strong> {eduText}
        </div>
      )}

      <div>
        <strong>Skills:</strong> {skillsText}
      </div>

      {hasCerts && (
        <div>
          <strong>Certificaciones:</strong> {certsText}
        </div>
      )}

      {hasLanguages && (
        <div>
          <strong>Idiomas requeridos:</strong>
          <ul className="ml-4 list-disc">
            {v.languages!.map((lng) => (
              <li
                key={`${lng.name}-${lng.level}`}
              >{`${lng.name} (${labelLanguageLevel(
                lng.level as LanguageProficiency
              )})`}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 🔹 Descripción al final */}
      <div>
        <strong>Descripción (resumen):</strong>
        <div
          className={`job-html ${reviewBox}`}
          dangerouslySetInnerHTML={{
            __html: safeDescriptionHtml || "<p>Sin descripción</p>",
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

function labelLanguageLevel(l: LanguageProficiency) {
  switch (l) {
    case "NATIVE":
      return "Nativo";
    case "PROFESSIONAL":
      return "Profesional (C1–C2)";
    case "CONVERSATIONAL":
      return "Conversacional (B1–B2)";
    case "BASIC":
      return "Básico (A1–A2)";
  }
}

function clampNonNegative(n: string) {
  const v = Math.max(0, Number(n || 0));
  if (!Number.isFinite(v)) return "";
  return String(v);
}

function makeDefaultValues({
  presetCompany,
  initial,
}: {
  presetCompany: PresetCompany;
  initial?: Props["initial"];
}): JobForm {
  const benefitsBase = BENEFITS.reduce((acc, b) => {
    acc[b.key] = b.def;
    return acc;
  }, {} as Record<string, boolean>);

  const showBenefits =
    typeof initial?.showBenefits === "boolean"
      ? (initial.showBenefits as boolean)
      : true;

  let benefitsJson = benefitsBase;
  let aguinaldoDias = 15;
  let vacacionesDias = 12;
  let primaVacPct = 25;

  if (initial?.benefitsJson && typeof initial.benefitsJson === "object") {
    const b = initial.benefitsJson as any;
    const base = { ...benefitsBase };
    for (const k of Object.keys(base)) {
      base[k] = typeof b[k] === "boolean" ? b[k] : base[k];
    }
    benefitsJson = base;
    if (typeof b.aguinaldoDias === "number") aguinaldoDias = b.aguinaldoDias;
    if (typeof b.vacacionesDias === "number") vacacionesDias = b.vacacionesDias;
    if (typeof b.primaVacPct === "number") primaVacPct = b.primaVacPct;
  }

  const html = sanitizeHtml(initial?.descriptionHtml || "");
  const plain = initial?.description
    ? initial.description
    : html
    ? htmlToPlain(html)
    : "";

  const initEdu = Array.isArray(initial?.education) ? initial!.education : [];
  const eduReq = initEdu.filter((e) => e.required).map((e) => e.name);
  const eduNice = initEdu.filter((e) => !e.required).map((e) => e.name);

  const initSkills = Array.isArray(initial?.skills) ? initial!.skills : [];
  const skillsReq = initSkills.filter((s) => s.required).map((s) => s.name);
  const skillsNice = initSkills.filter((s) => !s.required).map((s) => s.name);

  const defaultCompanyModeRaw =
    initial?.companyMode ?? (presetCompany?.id ? "own" : "confidential");
  const companyMode =
    defaultCompanyModeRaw === "other"
      ? "own"
      : (defaultCompanyModeRaw as "own" | "confidential");

  const languagesInit = Array.isArray(initial?.languages)
    ? initial!.languages
    : [];

  return {
    // Paso 1
    title: initial?.title ?? "",
    companyMode,
    companyOtherName: initial?.companyOtherName ?? "",
    locationType: initial?.locationType ?? "ONSITE",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    admin1: initial?.admin1 ?? "",
    cityNorm: initial?.cityNorm ?? "",
    admin1Norm: initial?.admin1Norm ?? "",
    locationLat: initial?.locationLat ?? null,
    locationLng: initial?.locationLng ?? null,
    currency: (initial?.currency as Currency) ?? "MXN",
    salaryMin:
      initial?.salaryMin === null || initial?.salaryMin === undefined
        ? ""
        : String(initial.salaryMin),
    salaryMax:
      initial?.salaryMax === null || initial?.salaryMax === undefined
        ? ""
        : String(initial.salaryMax),
    showSalary: !!initial?.showSalary,
    // Paso 2
    employmentType: initial?.employmentType ?? "FULL_TIME",
    schedule: initial?.schedule ?? "",
    // Paso 3
    showBenefits,
    benefits: benefitsJson,
    aguinaldoDias,
    vacacionesDias,
    primaVacPct,
    // Paso 4
    descriptionHtml: html,
    descriptionPlain: plain,
    minDegree: initial?.minDegree ?? "BACHELOR",
    eduRequired: eduReq,
    eduNice,
    requiredSkills: skillsReq,
    niceSkills: skillsNice,
    certs: Array.isArray(initial?.certs) ? initial!.certs! : [],
    // Idiomas
    languages: languagesInit,
  };
}
