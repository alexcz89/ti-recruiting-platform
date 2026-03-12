// components/cv/CvBuilder.tsx
"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import Link from "next/link";
import { useSession } from "next-auth/react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import PhoneInputField from "@/components/PhoneInputField";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import CvExperienceEditor from "@/components/cv/CvExperienceEditor";
import {
  PROGRAMMING_LANGUAGES,
  WEB_FRONTEND,
  WEB_BACKEND,
  DATABASES,
  DEVOPS_TOOLS,
  CLOUD_PLATFORMS,
  TESTING_QA,
  AI_ML,
  DATA_ANALYTICS,
  DATA_ENGINEERING,
} from "@/lib/shared/skills-data";

/* ==================== Tipos ==================== */
type CvIdentity = {
  firstName: string;
  lastName1: string;
  lastName2: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  birthdate?: string; // YYYY-MM-DD
  role?: string; // ✅ (lo usas en el preview)
};

type CvExperience = {
  id?: string;
  role: string;
  company: string;
  city?: string; // 🆕 NUEVO: Ciudad del puesto
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string;
  bullets?: string[];
  bulletsText?: string;
  /** HTML del editor enriquecido (para no perder formato de bullets) */
  descriptionHtml?: string;
};

type CvEducation = {
  id?: string;
  institution: string;
  program?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean; // ✅ En curso
};

type CvSkill = { termId: string; label: string; level: 1 | 2 | 3 | 4 | 5 };
type CvLanguage = {
  termId: string;
  label: string;
  level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
};

type CvCertification = {
  id?: string;
  name: string;
  date?: string; // YYYY-MM (opcional)
  url?: string; // URL de credencial (opcional)
};

type PreviewExperience = CvExperience & {
  bullets: string[];
  safeDescriptionHtml: string;
};

type SkillOption = { termId: string; label: string };
type LanguageOption = { termId: string; label: string };

type Props = {
  initial: {
    identity: CvIdentity;
    experiences: CvExperience[];
    education: CvEducation[];
    skills: CvSkill[];
    languages: CvLanguage[];
    certifications: CvCertification[];
  };
  /** Opciones globales para autocompletar skills */
  skillOptions: SkillOption[];
  /** Opciones globales para autocompletar idiomas */
  languageOptions: LanguageOption[];
};

/* ==================== Utils ==================== */
const fmtMonthShort = (ym?: string | null) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${m.padStart(2, "0")}/${y}`;
};
const parseYMDToLocal = (ymd?: string) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-");
  const yy = Number(y),
    mm = Number(m) - 1,
    dd = Number(d);
  if ([yy, mm, dd].some(Number.isNaN)) return null;
  return new Date(yy, mm, dd);
};
const joinName = (i: CvIdentity) =>
  [i.firstName, i.lastName1, i.lastName2].filter(Boolean).join(" ");
const prettyBirth = (birth?: string) => {
  const d = parseYMDToLocal(birth);
  if (!d) return "";
  try {
    return d.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return birth || "";
  }
};

// claves de orden (más reciente primero)
const roleSortKey = (e: CvExperience) =>
  e.isCurrent
    ? `Z-9999-99-${e.startDate || ""}`
    : e.endDate
    ? `Y-${e.endDate}-${e.startDate || ""}`
    : `X-${e.startDate || ""}`;
const companySortKey = (roles: CvExperience[]) => {
  const sorted = [...roles].sort((a, b) =>
    roleSortKey(b).localeCompare(roleSortKey(a))
  );
  return roleSortKey(sorted[0]!);
};

/* ==================== UI helpers ==================== */
const labelCls =
  "block text-xs font-medium text-zinc-800 dark:text-zinc-100 mb-1";

const inputBase =
  "block w-full rounded-lg border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-white " +
  "placeholder:text-zinc-400 dark:placeholder:text-zinc-500 " +
  "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "hover:border-zinc-300 dark:hover:border-zinc-600";

const inputCls = inputBase; // full (URLs largas)
const inputMdCls = inputBase + " md:max-w-sm"; // mediano
const inputSmCls = inputBase + " md:max-w-xs"; // corto

/* ==================== LocalStorage key ==================== */
const LS_KEY = "cv_builder_draft_v1";
const buildDraftKey = (user?: { id?: string; email?: string }) => {
  const slug =
    user?.id?.toString() ||
    user?.email?.toString().replace(/[^a-zA-Z0-9._-]/g, "-");
  return slug ? `${LS_KEY}:${slug}` : LS_KEY;
};

/* ==================== Sanitizers ==================== */
const sanitizeHtml = (html: string) => {
  if (typeof window === "undefined") return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach((n) => n.remove());
  return doc.body.innerHTML;
};

const sanitizeFilename = (raw: string) =>
  (raw || "candidato")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "candidato";


const isFilled = (v?: string | null) => typeof v === "string" && v.trim().length > 0;

const mergeIdentityWithDraft = (base: CvIdentity, draft?: Partial<CvIdentity> | null): CvIdentity => ({
  ...base,
  firstName: isFilled(draft?.firstName) ? draft!.firstName!.trim() : base.firstName,
  lastName1: isFilled(draft?.lastName1) ? draft!.lastName1!.trim() : base.lastName1,
  lastName2: isFilled(draft?.lastName2) ? draft!.lastName2!.trim() : base.lastName2,
  email: isFilled(draft?.email) ? draft!.email!.trim() : base.email,
  phone: isFilled(draft?.phone) ? draft!.phone!.trim() : base.phone,
  location: isFilled(draft?.location) ? draft!.location!.trim() : base.location,
  linkedin: isFilled(draft?.linkedin) ? draft!.linkedin!.trim() : base.linkedin,
  github: isFilled(draft?.github) ? draft!.github!.trim() : base.github,
  birthdate: isFilled(draft?.birthdate) ? draft!.birthdate!.trim() : (base.birthdate || ""),
  role: isFilled(draft?.role) ? draft!.role!.trim() : base.role,
});

const normalizeDraftExperiences = (items: any[]): CvExperience[] =>
  items.map((e: any) => {
    const description =
      e?.description ?? e?.bulletsText ?? (Array.isArray(e?.bullets) ? e.bullets.join("\n") : "") ?? "";
    return {
      ...e,
      city: e?.city || "",
      description,
      bulletsText: e?.bulletsText || description || (Array.isArray(e?.bullets) ? e.bullets.join("\n") : ""),
      descriptionHtml: e?.descriptionHtml || "",
    };
  });

const normalizeDraftEducation = (items: any[]): CvEducation[] =>
  items.map((e: any) => ({
    ...e,
    isCurrent: !!e?.isCurrent,
    endDate: e?.isCurrent ? null : e?.endDate ?? "",
  }));

const hasMeaningfulIdentity = (identity?: Partial<CvIdentity> | null) =>
  !!identity &&
  [
    identity.firstName,
    identity.lastName1,
    identity.lastName2,
    identity.email,
    identity.phone,
    identity.location,
    identity.linkedin,
    identity.github,
    identity.birthdate,
    identity.role,
  ].some((value) => isFilled(value ?? ""));

const hasMeaningfulExperiences = (items?: CvExperience[] | null) =>
  Array.isArray(items) &&
  items.some(
    (item) =>
      isFilled(item?.role) ||
      isFilled(item?.company) ||
      isFilled(item?.description) ||
      isFilled(item?.bulletsText) ||
      isFilled(item?.descriptionHtml)
  );

const hasMeaningfulEducation = (items?: CvEducation[] | null) =>
  Array.isArray(items) &&
  items.some((item) => isFilled(item?.institution) || isFilled(item?.program));

const hasMeaningfulSkills = (items?: CvSkill[] | null) =>
  Array.isArray(items) && items.some((item) => isFilled(item?.label));

const hasMeaningfulLanguages = (items?: CvLanguage[] | null) =>
  Array.isArray(items) && items.some((item) => isFilled(item?.label));

const hasMeaningfulCertifications = (items?: CvCertification[] | null) =>
  Array.isArray(items) && items.some((item) => isFilled(item?.name));

const hasMeaningfulCvData = (data: Props["initial"]) =>
  hasMeaningfulIdentity(data.identity) ||
  hasMeaningfulExperiences(data.experiences) ||
  hasMeaningfulEducation(data.education) ||
  hasMeaningfulSkills(data.skills) ||
  hasMeaningfulLanguages(data.languages) ||
  hasMeaningfulCertifications(data.certifications);

const groupSkills = (skills: CvSkill[]) => {
  // Convertir arrays readonly a arrays normales para búsqueda
  const lenguajes = [...PROGRAMMING_LANGUAGES];
  const frontend = [...WEB_FRONTEND];
  const backend = [...WEB_BACKEND];
  const databases = [...DATABASES];
  const cloudDevOps = [...CLOUD_PLATFORMS, ...DEVOPS_TOOLS];
  const testing = [...TESTING_QA];
  const aiData = [...AI_ML, ...DATA_ANALYTICS, ...DATA_ENGINEERING];

  const grouped: Record<string, CvSkill[]> = {
    lenguajes: [],
    frontend: [],
    backend: [],
    databases: [],
    cloudDevOps: [],
    testing: [],
    aiData: [],
    otros: [],
  };

  skills.forEach((skill) => {
    const label = skill.label.trim();
    if (!label) return;

    let assigned = false;

    // Verificar en cada categoría (case-insensitive)
    if (
      lenguajes.some(
        (s) =>
          s.toLowerCase() === label.toLowerCase() ||
          label.toLowerCase().includes(s.toLowerCase())
      )
    ) {
      grouped.lenguajes.push(skill);
      assigned = true;
    } else if (
      frontend.some(
        (s) =>
          s.toLowerCase() === label.toLowerCase() ||
          label.toLowerCase().includes(s.toLowerCase())
      )
    ) {
      grouped.frontend.push(skill);
      assigned = true;
    } else if (
      backend.some(
        (s) =>
          s.toLowerCase() === label.toLowerCase() ||
          label.toLowerCase().includes(s.toLowerCase())
      )
    ) {
      grouped.backend.push(skill);
      assigned = true;
    } else if (
      databases.some(
        (s) =>
          s.toLowerCase() === label.toLowerCase() ||
          label.toLowerCase().includes(s.toLowerCase())
      )
    ) {
      grouped.databases.push(skill);
      assigned = true;
    } else if (
      cloudDevOps.some(
        (s) =>
          s.toLowerCase() === label.toLowerCase() ||
          label.toLowerCase().includes(s.toLowerCase())
      )
    ) {
      grouped.cloudDevOps.push(skill);
      assigned = true;
    } else if (
      testing.some(
        (s) =>
          s.toLowerCase() === label.toLowerCase() ||
          label.toLowerCase().includes(s.toLowerCase())
      )
    ) {
      grouped.testing.push(skill);
      assigned = true;
    } else if (
      aiData.some(
        (s) =>
          s.toLowerCase() === label.toLowerCase() ||
          label.toLowerCase().includes(s.toLowerCase())
      )
    ) {
      grouped.aiData.push(skill);
      assigned = true;
    }

    if (!assigned) {
      grouped.otros.push(skill);
    }
  });

  return grouped;
};

/* ==================== Helpers para autocomplete ==================== */
function filterSkillOptions(all: SkillOption[], query: string): SkillOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Primero buscar coincidencias exactas
  const exactMatch = all.find((o) => o.label.toLowerCase() === q);
  const starts = all.filter((o) => o.label.toLowerCase().startsWith(q));
  const contains = all.filter(
    (o) =>
      !o.label.toLowerCase().startsWith(q) &&
      o.label.toLowerCase().includes(q)
  );

  const results = [...starts, ...contains].slice(0, 8);

  // 🆕 Si no hay coincidencias exactas, agregar opción para crear custom
  if (!exactMatch && results.length === 0) {
    return [{ termId: `custom-${Date.now()}`, label: query.trim() }];
  }

  return results;
}

function filterLanguageOptions(
  all: LanguageOption[],
  query: string
): LanguageOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = all.filter((o) => o.label.toLowerCase().startsWith(q));
  const contains = all.filter(
    (o) =>
      !o.label.toLowerCase().startsWith(q) &&
      o.label.toLowerCase().includes(q)
  );
  return [...starts, ...contains].slice(0, 8);
}

/* ==================== Componente ==================== */
export default function CvBuilder({
  initial,
  skillOptions,
  languageOptions,
}: Props) {
  const { data: session } = useSession();
  const user = session?.user as any | undefined;
  const role = user?.role as "ADMIN" | "RECRUITER" | "CANDIDATE" | undefined;
  const isCandidate = role === "CANDIDATE";
  const draftKey = useMemo(() => buildDraftKey(user), [user]);

  const normalizedInitial = useMemo<Props["initial"]>(() => ({
    identity: {
      ...initial.identity,
      birthdate: initial.identity.birthdate || "",
    },
    experiences: (initial.experiences || []).map((e) => {
      const description =
        e.description ?? e.bulletsText ?? e.bullets?.join("\n") ?? "";
      return {
        ...e,
        city: e.city || "",
        description,
        bulletsText: e.bulletsText || description || e.bullets?.join("\n") || "",
        descriptionHtml: e.descriptionHtml || "",
      };
    }),
    education: (initial.education || []).map((e) => ({
      ...e,
      isCurrent: !!(e as any).isCurrent,
      endDate: (e as any).isCurrent ? null : e.endDate ?? "",
    })),
    skills: initial.skills || [],
    languages: initial.languages || [],
    certifications: (initial.certifications || []).map((c, idx) =>
      typeof c === "string"
        ? { id: `initial-cert-${idx}-${c}`, name: c, date: "", url: "" }
        : c
    ),
  }), [initial]);

  const [identity, setIdentity] = useState<CvIdentity>(normalizedInitial.identity);
  const [experiences, setExperiences] = useState<CvExperience[]>(normalizedInitial.experiences);
  const [education, setEducation] = useState<CvEducation[]>(normalizedInitial.education);
  const [skills, setSkills] = useState<CvSkill[]>(normalizedInitial.skills);
  const [languages, setLanguages] = useState<CvLanguage[]>(normalizedInitial.languages);
  const [certifications, setCertifications] = useState<CvCertification[]>(normalizedInitial.certifications);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [showProfileSyncBanner, setShowProfileSyncBanner] = useState(false);

  // ✅ NUEVO: modal preview
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadedDraftKeyRef = useRef<string | null>(null);
  const cvPrintRef = useRef<HTMLDivElement>(null);

  // control de apertura de combos
  const [openSkillIndex, setOpenSkillIndex] = useState<number | null>(null);
  const [openLanguageIndex, setOpenLanguageIndex] = useState<number | null>(
    null
  );

  const fullName = useMemo(() => joinName(identity), [identity]);
  const safeFileBase = useMemo(
    () => sanitizeFilename(fullName || "candidato"),
    [fullName]
  );

  const currentBuilderHasMeaningfulData = useMemo(
    () =>
      hasMeaningfulIdentity(identity) ||
      hasMeaningfulExperiences(experiences) ||
      hasMeaningfulEducation(education) ||
      hasMeaningfulSkills(skills) ||
      hasMeaningfulLanguages(languages) ||
      hasMeaningfulCertifications(certifications),
    [identity, experiences, education, skills, languages, certifications]
  );

  const profileHasMeaningfulData = useMemo(
    () => hasMeaningfulCvData(normalizedInitial),
    [normalizedInitial]
  );

  const applyProfileData = () => {
    setIdentity(normalizedInitial.identity);
    setExperiences(normalizedInitial.experiences);
    setEducation(normalizedInitial.education);
    setSkills(normalizedInitial.skills);
    setLanguages(normalizedInitial.languages);
    setCertifications(normalizedInitial.certifications);
  };

  const handleSyncFromProfile = async (opts?: { silent?: boolean }) => {
    if (!profileHasMeaningfulData) {
      if (!opts?.silent) {
        alert("No encontramos información suficiente en tu perfil para sincronizar.");
      }
      return;
    }

    if (!opts?.silent) {
      const confirmed = window.confirm(
        "Esto reemplazará la información actual del CV Builder con la información de tu perfil. ¿Deseas continuar?"
      );
      if (!confirmed) return;
    }

    setSyncingProfile(true);
    try {
      applyProfileData();
      setShowProfileSyncBanner(false);
      if (!opts?.silent) {
        alert("✅ Tu CV fue actualizado con la información de tu perfil.");
      }
    } finally {
      setSyncingProfile(false);
    }
  };

  // ====== Imprimir / Guardar como PDF ======
  const restorePrintStylesRef = useRef<null | (() => void)>(null);

  const handlePrint = useReactToPrint({
    contentRef: cvPrintRef,
    documentTitle: `${safeFileBase}-CV`,
    pageStyle: `
      @page { size: A4; margin: 12mm; }
      @media print {
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
    onBeforePrint: async () => {
      document.body.setAttribute("data-exporting", "1");

      // 🔧 Fix típico: si tu preview tiene overflow/height/transform, en print se vuelve blanco
      const el = cvPrintRef.current;
      if (el) {
        const prev = {
          overflow: el.style.overflow,
          maxHeight: el.style.maxHeight,
          height: el.style.height,
          transform: el.style.transform,
          filter: el.style.filter,
        };

        el.style.overflow = "visible";
        el.style.maxHeight = "none";
        el.style.height = "auto";
        el.style.transform = "none";
        el.style.filter = "none";

        restorePrintStylesRef.current = () => {
          el.style.overflow = prev.overflow;
          el.style.maxHeight = prev.maxHeight;
          el.style.height = prev.height;
          el.style.transform = prev.transform;
          el.style.filter = prev.filter;
        };
      }
    },
    onAfterPrint: () => {
      restorePrintStylesRef.current?.();
      restorePrintStylesRef.current = null;

      document.body.removeAttribute("data-exporting");
      setDownloadingPdf(false);
    },
    onPrintError: () => {
      restorePrintStylesRef.current?.();
      restorePrintStylesRef.current = null;

      document.body.removeAttribute("data-exporting");
      setDownloadingPdf(false);
      alert("No se pudo abrir el diálogo de impresión.");
    },
  });

  const handleDownloadPdf = () => {
    // ✅ Validaciones previas
    const missingFields: string[] = [];
    if (!identity.firstName.trim()) missingFields.push("Nombre");
    if (!identity.email.trim()) missingFields.push("Email principal");

    if (missingFields.length > 0) {
      alert(`⚠️ Completa al menos: ${missingFields.join(", ")}`);
      return;
    }

    if (!cvPrintRef.current) {
      alert("No se encontró el contenido del CV para exportar.");
      return;
    }

    setDownloadingPdf(true);
    try {
      handlePrint();
    } catch (err) {
      document.body.removeAttribute("data-exporting");
      setDownloadingPdf(false);
      alert(
        "Error al generar PDF: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  };

  // ====== Cargar borrador desde localStorage (para uso sin registro) ======
  useEffect(() => {
    if (typeof window === "undefined" || !draftKey) return;
    if (loadedDraftKeyRef.current === draftKey) return;

    let importedMeaningfulDraft = false;

    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);

        if (parsed?.identity && hasMeaningfulIdentity(parsed.identity)) {
          importedMeaningfulDraft = true;
          setIdentity((current) => mergeIdentityWithDraft(current, parsed.identity));
        }

        if (Array.isArray(parsed?.experiences) && hasMeaningfulExperiences(parsed.experiences)) {
          importedMeaningfulDraft = true;
          setExperiences(normalizeDraftExperiences(parsed.experiences));
        }

        if (Array.isArray(parsed?.education) && hasMeaningfulEducation(parsed.education)) {
          importedMeaningfulDraft = true;
          setEducation(normalizeDraftEducation(parsed.education));
        }

        if (Array.isArray(parsed?.skills) && hasMeaningfulSkills(parsed.skills)) {
          importedMeaningfulDraft = true;
          setSkills(parsed.skills);
        }

        if (Array.isArray(parsed?.languages) && hasMeaningfulLanguages(parsed.languages)) {
          importedMeaningfulDraft = true;
          setLanguages(parsed.languages);
        }

        if (Array.isArray(parsed?.certifications) && hasMeaningfulCertifications(parsed.certifications)) {
          importedMeaningfulDraft = true;
          setCertifications(parsed.certifications);
        }
      }
    } catch {
      // ignore
    } finally {
      loadedDraftKeyRef.current = draftKey;
      if (!importedMeaningfulDraft && profileHasMeaningfulData) {
        applyProfileData();
      }
      setShowProfileSyncBanner(importedMeaningfulDraft && profileHasMeaningfulData);
    }
  }, [draftKey, profileHasMeaningfulData, normalizedInitial]);


  useEffect(() => {
    if (!profileHasMeaningfulData) {
      setShowProfileSyncBanner(false);
      return;
    }

    if (!currentBuilderHasMeaningfulData) {
      setShowProfileSyncBanner(false);
    }
  }, [profileHasMeaningfulData, currentBuilderHasMeaningfulData]);

  // ====== Guardar borrador automáticamente ======
  useEffect(() => {
    if (typeof window === "undefined" || !draftKey) return;
    if (loadedDraftKeyRef.current === null) return;

    setAutoSaving(true);
    const data = {
      identity,
      experiences,
      education,
      skills,
      languages,
      certifications,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(data));
      setLastSaved(new Date());
    } catch {
      // ignore
    } finally {
      setTimeout(() => setAutoSaving(false), 500);
    }
  }, [draftKey, identity, experiences, education, skills, languages, certifications]);

  // ====== Cerrar combos al hacer click afuera ======
  useEffect(() => {
    const handle = () => {
      setOpenSkillIndex(null);
      setOpenLanguageIndex(null);
    };
    if (openSkillIndex !== null || openLanguageIndex !== null) {
      document.addEventListener("click", handle, { once: true });
      return () => document.removeEventListener("click", handle);
    }
  }, [openSkillIndex, openLanguageIndex]);

  // ✅ Cerrar modal con ESC
  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  // ====== Guardar en servidor ======
  const handleSave = async () => {
    if (!isCandidate) {
      alert("Solo candidatos pueden guardar el CV en su cuenta");
      return;
    }
    setSaving(true);

    const payload = {
      identity,
      experiences,
      education,
      skills: skills.map((s) => ({ termId: s.termId, level: s.level })),
      languages: languages.map((l) => ({ termId: l.termId, level: l.level })),
      certifications,
    };

    try {
      const res = await fetch("/api/cv", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      alert("✅ CV guardado correctamente.");
    } catch (err) {
      alert(
        "Error al guardar: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setSaving(false);
    }
  };

  // ====== Añadir experiencia ======
  const handleAddExperience = () => {
    const newId = Date.now().toString();
    const blank: CvExperience = {
      id: newId,
      role: "",
      company: "",
      city: "",
      startDate: "",
      endDate: null,
      isCurrent: false,
      description: "",
      descriptionHtml: "",
      bulletsText: "",
    };
    // ✅ Más reciente arriba
    setExperiences((prev) => [blank, ...prev]);
  };

  // ====== Eliminar experiencia ======
  const handleRemoveExperience = (id: string) => {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
  };

  // ====== Añadir educación ======
  const handleAddEducation = () => {
    const newId = Date.now().toString();
    setEducation((prev) => [
      ...prev,
      {
        id: newId,
        institution: "",
        program: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
      },
    ]);
  };

  // ====== Eliminar educación ======
  const handleRemoveEducation = (id: string) => {
    setEducation((prev) => prev.filter((e) => e.id !== id));
  };

  // ====== Añadir skill ======
  const handleAddSkill = () => {
    const newId = Date.now().toString();
    setSkills((prev) => [...prev, { termId: newId, label: "", level: 3 }]);
    setOpenSkillIndex(skills.length);
  };

  // ====== Eliminar skill ======
  const handleRemoveSkill = (idx: number) => {
    setSkills((prev) => prev.filter((_, i) => i !== idx));
    if (openSkillIndex === idx) setOpenSkillIndex(null);
  };

  // ====== Añadir idioma ======
  const handleAddLanguage = () => {
    const newId = Date.now().toString();
    setLanguages((prev) => [
      ...prev,
      { termId: newId, label: "", level: "CONVERSATIONAL" },
    ]);
    setOpenLanguageIndex(languages.length);
  };

  // ====== Eliminar idioma ======
  const handleRemoveLanguage = (idx: number) => {
    setLanguages((prev) => prev.filter((_, i) => i !== idx));
    if (openLanguageIndex === idx) setOpenLanguageIndex(null);
  };

  // ====== Añadir certificación ======
  const handleAddCertification = () => {
    const newId = Date.now().toString();
    setCertifications((prev) => [...prev, { id: newId, name: "", date: "", url: "" }]);
  };

  // ====== Eliminar certificación ======
  const handleRemoveCertification = (idx: number) => {
    setCertifications((prev) => prev.filter((_, i) => i !== idx));
  };

  // ====== Preview para el PDF ======
  const previewExperiences = useMemo((): PreviewExperience[] => {
    return experiences
      .filter((e) => e.role.trim() || e.company.trim())
      .map((e) => {
        const descHtml = e.descriptionHtml || "";
        const safeDescriptionHtml = sanitizeHtml(descHtml);
        const parsedBullets: string[] = [];
        if (!safeDescriptionHtml.trim() && e.bulletsText) {
          parsedBullets.push(
            ...e.bulletsText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          );
        }
        return { ...e, bullets: parsedBullets, safeDescriptionHtml };
      });
  }, [experiences]);

  const groupedByCompany = useMemo(() => {
    const map = new Map<string, PreviewExperience[]>();
    for (const e of previewExperiences) {
      const key = e.company || "(Sin empresa)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) =>
      companySortKey(b[1]).localeCompare(companySortKey(a[1]))
    );
    for (const [, roles] of entries) {
      roles.sort((a, b) => roleSortKey(b).localeCompare(roleSortKey(a)));
    }
    return entries;
  }, [previewExperiences]);

  // ✅ Nuevo: contenido único para PDF + modal (mismo markup)
  function CvPreviewContent() {
    return (
      <div className="cv-sheet">
        <div className="cv-sheet-inner">
          {/* ========== HEADER ========== */}
          <header className="cv-header">
            <h1 className="cv-name">{fullName || "(Tu nombre)"}</h1>
            {(identity as any).role && (
              <p className="cv-role">{(identity as any).role}</p>
            )}
            <div className="cv-divider-main" />

            <div className="cv-contact-grid">
              {identity.email && (
                <span className="cv-contact-item">
                  <span className="cv-icon">📧</span> {identity.email}
                </span>
              )}
              {identity.phone && (
                <span className="cv-contact-item">
                  <span className="cv-icon">📞</span> {identity.phone}
                </span>
              )}
              {identity.location && (
                <span className="cv-contact-item">
                  <span className="cv-icon">📍</span> {identity.location}
                </span>
              )}
              {identity.birthdate && (
                <span className="cv-contact-item">
                  <span className="cv-icon">📅</span>{" "}
                  {prettyBirth(identity.birthdate)}
                </span>
              )}
            </div>

            {(identity.linkedin || identity.github) && (
              <div className="cv-contact-grid mt-2">
                {identity.linkedin && (
                  <span className="cv-contact-item">
                    <span className="cv-icon">🔗</span>
                    <a href={identity.linkedin} className="cv-link">
                      {identity.linkedin.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </span>
                )}
                {identity.github && (
                  <span className="cv-contact-item">
                    <span className="cv-icon">🔗</span>
                    <a href={identity.github} className="cv-link">
                      {identity.github.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </span>
                )}
              </div>
            )}
          </header>

          {/* ========== EDUCACIÓN ========== */}
          {education.filter((e) => e.institution.trim()).length > 0 && (
            <section className="cv-section">
              <h2 className="cv-section-title">EDUCACIÓN</h2>
              <div className="cv-divider" />
              <div className="cv-section-content">
                {education
                  .filter((e) => e.institution.trim())
                  .map((e, i) => {
                    const end = e.isCurrent ? "Actual" : fmtMonthShort(e.endDate);
                    const start = fmtMonthShort(e.startDate);
                    const showRange = !!(start || end);

                    return (
                      <div key={i} className="cv-education-item">
                        <div className="cv-education-header">
                          <div className="cv-education-degree">
                            {e.program || "Programa no especificado"}
                          </div>
                          {showRange && (
                            <div className="cv-date-range">
                              {start}
                              {(start || end) && " – "}
                              {end}
                            </div>
                          )}
                        </div>
                        <div className="cv-institution">{e.institution}</div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* ========== IDIOMAS ========== */}
          {languages.filter((l) => l.label.trim()).length > 0 && (
            <section className="cv-section">
              <h2 className="cv-section-title">IDIOMAS</h2>
              <div className="cv-divider" />
              <div className="cv-section-content">
                <div className="cv-languages-grid">
                  {languages
                    .filter((l) => l.label.trim())
                    .map((l, i) => (
                      <span key={i} className="cv-language-item">
                        <span className="cv-language-name">{l.label}:</span>{" "}
                        {l.level === "NATIVE"
                          ? "Nativo"
                          : l.level === "PROFESSIONAL"
                          ? "Profesional"
                          : l.level === "CONVERSATIONAL"
                          ? "Conversacional"
                          : "Básico"}
                      </span>
                    ))}
                </div>
              </div>
            </section>
          )}

          {/* ========== EXPERIENCIA ========== */}
          {groupedByCompany.length > 0 && (
            <section className="cv-section">
              <h2 className="cv-section-title">EXPERIENCIA PROFESIONAL</h2>
              <div className="cv-divider" />
              <div className="cv-section-content">
                {groupedByCompany.map(([company, roles], i) => (
                  <div key={i} className="cv-company-group">
                    {roles.map((e, idx) => {
                      const startS = fmtMonthShort(e.startDate);
                      const endS = e.isCurrent
                        ? "Actual"
                        : fmtMonthShort(e.endDate);
                      const hasHtml =
                        typeof e.safeDescriptionHtml === "string" &&
                        e.safeDescriptionHtml.trim().length > 0;
                      const hasBullets = e.bullets && e.bullets.length > 0;

                      return (
                        <div key={idx} className="cv-experience-item">
                          <div className="cv-experience-header">
                            <div className="cv-role-title">{e.role}</div>
                            <div className="cv-date-range">
                              {startS}
                              {(startS || endS) && " – "}
                              {endS}
                            </div>
                          </div>

                          <div className="cv-company-location">
                            <span className="cv-company-name">{company}</span>
                            {e.city && (
                              <>
                                <span className="cv-separator"> | </span>
                                <span className="cv-city">{e.city}</span>
                              </>
                            )}
                          </div>

                          {hasHtml ? (
                            <div
                              className="cv-exp-html"
                              dangerouslySetInnerHTML={{
                                __html: e.safeDescriptionHtml || "",
                              }}
                            />
                          ) : (
                            hasBullets && (
                              <ul className="cv-bullet-list">
                                {e.bullets!.map((b, j) => (
                                  <li key={j}>{b}</li>
                                ))}
                              </ul>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ========== SKILLS & CERTIFICACIONES ========== */}
          {(skills.length > 0 || certifications.filter(Boolean).length > 0) && (
            <section className="cv-section">
              <h2 className="cv-section-title">
                HABILIDADES TÉCNICAS Y CERTIFICACIONES
              </h2>
              <div className="cv-divider" />
              <div className="cv-section-content">
                {skills.length > 0 &&
                  (() => {
                    const grouped = groupSkills(skills);
                    const categoryLabels: Record<string, string> = {
                      lenguajes: "Lenguajes de Programación",
                      frontend: "Frontend",
                      backend: "Backend",
                      databases: "Bases de Datos",
                      cloudDevOps: "Cloud & DevOps",
                      testing: "Testing & QA",
                      aiData: "IA/ML & Data",
                      otros: "Otros",
                    };

                    return (
                      <div className="cv-skills-grouped">
                        {Object.entries(grouped).map(
                          ([category, categorySkills]) => {
                            if (categorySkills.length === 0) return null;
                            return (
                              <p key={category} className="cv-skill-category">
                                <span className="cv-skill-category-label">
                                  {categoryLabels[category]}:
                                </span>{" "}
                                {categorySkills
                                  .map((s) => s.label)
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            );
                          }
                        )}
                      </div>
                    );
                  })()}

                {certifications.filter(Boolean).length > 0 && (
                  <div className="cv-certifications">
                    <p className="cv-certification-header">Certificaciones:</p>
                    <ul className="cv-certification-list">
                      {certifications
                        .filter(c => c.name && c.name.trim())
                        .map((cert, i) => (
                          <li key={i}>
                            <span className="cv-cert-name">{cert.name}</span>
                            {cert.date && <span className="cv-cert-date"> ({fmtMonthShort(cert.date)})</span>}
                            {cert.url && (
                              <span className="cv-cert-url">
                                {" "}- <a href={cert.url} className="cv-link">{cert.url}</a>
                              </span>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cv-builder-root min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 py-6 md:py-8 px-0 sm:px-4">
      <div className="w-full md:max-w-4xl md:mx-auto">
        {/* ====== Header con título y botones de acción ====== */}
        <div className="bg-white dark:bg-zinc-900 md:rounded-2xl md:shadow-lg md:border md:border-zinc-200 md:dark:border-zinc-800 p-4 md:p-6 mb-4 md:mb-6">
          {showProfileSyncBanner && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Detectamos información en tu perfil.</p>
                  <p className="text-emerald-800/90 dark:text-emerald-200/90">
                    Puedes importar esos datos al CV Builder si hiciste cambios en tu perfil y quieres reflejarlos aquí.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSyncFromProfile()}
                  disabled={syncingProfile}
                  title="Reemplazar la información actual del CV Builder con la información de tu perfil"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                >
                  {syncingProfile ? "Actualizando..." : "Actualizar desde mi perfil"}
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white break-words hyphens-none">
                  CV Builder
                </h1>
                {/* 💾 Indicador de guardado automático */}
                {autoSaving ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Guardando...
                  </span>
                ) : lastSaved ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    💾 Guardado hace {Math.floor((new Date().getTime() - lastSaved.getTime()) / 1000)}s
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {isCandidate
                  ? "Completa tu CV y descárgalo. Si quieres guardarlo en tu cuenta y postularte en un clic, al final podrás crear tu cuenta gratis."
                  : "Sin registro: completa tu CV y descárgalo. Si quieres guardarlo en tu cuenta y postularte en un clic, al final podrás crear tu cuenta gratis."}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              {profileHasMeaningfulData && (
                <button
                  type="button"
                  onClick={() => handleSyncFromProfile()}
                  disabled={syncingProfile}
                  title="Actualizar los datos del CV usando la información guardada en tu perfil"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white shadow-md hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                >
                  {syncingProfile ? "Actualizando..." : "Actualizar desde mi perfil"}
                </button>
              )}
              {/* ✅ NUEVO: botón abre modal */}
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white shadow-md hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 transition-all"
              >
                👁️ Vista previa completa
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
              >
                {downloadingPdf ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    📄 Descargar PDF
                  </>
                )}
              </button>

              {isCandidate && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? "Guardando..." : "Guardar en mi cuenta"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ✅ CAMBIO: quitar columna de preview, dejar solo formulario */}
        <div className="grid grid-cols-1 gap-6">
          {/* ====== COLUMNA IZQUIERDA: FORMULARIO ====== */}
          <div className="space-y-6">
            {/* Datos personales */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                    Datos personales
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Información básica de contacto
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                Email principal:{" "}
                <span className="font-medium text-zinc-900 dark:text-white">
                  {initial.identity.email || "david@gmail.com"}
                </span>
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Nombre(s)</label>
                    <input
                      type="text"
                      value={identity.firstName}
                      onChange={(e) =>
                        setIdentity((p) => ({ ...p, firstName: e.target.value }))
                      }
                      className={inputSmCls}
                      placeholder="David"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Apellido paterno</label>
                    <input
                      type="text"
                      value={identity.lastName1}
                      onChange={(e) =>
                        setIdentity((p) => ({ ...p, lastName1: e.target.value }))
                      }
                      className={inputSmCls}
                      placeholder="Martinez"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Apellido materno</label>
                    <input
                      type="text"
                      value={identity.lastName2}
                      onChange={(e) =>
                        setIdentity((p) => ({ ...p, lastName2: e.target.value }))
                      }
                      className={inputSmCls}
                      placeholder="Hernandez"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Ubicación</label>
                    <LocationAutocomplete
                      value={identity.location}
                      onChange={(val) => setIdentity((p) => ({ ...p, location: val }))}
                      className={inputSmCls}
                      placeholder="Monterrey, Nuevo León, México"
                    />
                  </div>
                  <div className="cv-phone-input">
                    <PhoneInputField
                      value={identity.phone}
                      onChange={(val) => setIdentity((p) => ({ ...p, phone: val }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      value={identity.email}
                      onChange={(e) =>
                        setIdentity((p) => ({ ...p, email: e.target.value }))
                      }
                      className={inputMdCls}
                      placeholder="david@gmail.com"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de nacimiento</label>
                    <input
                      type="date"
                      value={identity.birthdate || ""}
                      onChange={(e) =>
                        setIdentity((p) => ({ ...p, birthdate: e.target.value }))
                      }
                      className={inputSmCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>LinkedIn</label>
                    <input
                      type="url"
                      value={identity.linkedin}
                      onChange={(e) =>
                        setIdentity((p) => ({ ...p, linkedin: e.target.value }))
                      }
                      className={inputCls}
                      placeholder="linkedin.com/in/david-martinez"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>GitHub</label>
                    <input
                      type="url"
                      value={identity.github}
                      onChange={(e) =>
                        setIdentity((p) => ({ ...p, github: e.target.value }))
                      }
                      className={inputCls}
                      placeholder="github.com/davidmtz"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Experiencia (más reciente arriba) */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      Experiencia laboral
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Tus trabajos más recientes
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddExperience}
                  className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all"
                >
                  <span className="text-lg">+</span> Añadir
                </button>
              </div>

              <div className="space-y-6">
                {experiences.map((exp, i) => {
                  // ✅ si este puesto pertenece a la MISMA empresa que el card inmediatamente anterior (más reciente)
                  const sameCompanyLocked =
                    i > 0 &&
                    experiences[i - 1]?.company === exp.company &&
                    exp.company.trim() !== "";

                  return (
                    <div
                      key={exp.id || i}
                      className="relative bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 space-y-3 hover:shadow-md transition-shadow"
                    >
                      {/* × arriba a la derecha */}
                      <button
                        type="button"
                        onClick={() => handleRemoveExperience(exp.id!)}
                        className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-red-600 text-lg cursor-pointer"
                        aria-label="Eliminar experiencia"
                        title="Eliminar"
                      >
                        ×
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Puesto</label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) =>
                              setExperiences((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, role: e.target.value } : x
                                )
                              )
                            }
                            className={inputCls}
                            placeholder="Senior Frontend Developer"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={labelCls}>Empresa</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) =>
                              setExperiences((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, company: e.target.value } : x
                                )
                              )
                            }
                            disabled={sameCompanyLocked}
                            className={inputCls}
                            placeholder="Fintech Solutions México"
                          />

                          {sameCompanyLocked && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-md">
                              <span className="inline-flex items-center gap-1.5">
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Misma empresa
                              </span>

                              <InfoTooltip
                                text="Este puesto está agrupado con el anterior porque comparten empresa. Para cambiar la empresa, edita el puesto anterior."
                                ariaLabel="Información sobre empresa bloqueada"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Inicio / Fin / Actual / Ciudad */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className={labelCls}>Inicio</label>
                          <input
                            type="month"
                            value={exp.startDate || ""}
                            onChange={(e) =>
                              setExperiences((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, startDate: e.target.value } : x
                                )
                              )
                            }
                            className={inputSmCls}
                          />
                        </div>

                        <div>
                          <label className={labelCls}>Fin</label>
                          <input
                            type="month"
                            value={exp.endDate || ""}
                            disabled={exp.isCurrent}
                            onChange={(e) =>
                              setExperiences((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, endDate: e.target.value } : x
                                )
                              )
                            }
                            className={inputSmCls}
                          />
                        </div>

                        <div className="flex items-end">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exp.isCurrent || false}
                              onChange={(e) =>
                                setExperiences((prev) =>
                                  prev.map((x, idx) =>
                                    idx === i
                                      ? {
                                          ...x,
                                          isCurrent: e.target.checked,
                                          endDate: e.target.checked ? null : x.endDate,
                                        }
                                      : x
                                  )
                                )
                              }
                              className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">
                              Actual
                            </span>
                          </label>
                        </div>

                        <div>
                          <label className={labelCls}>Ciudad</label>
                          <input
                            type="text"
                            value={exp.city || ""}
                            onChange={(e) =>
                              setExperiences((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, city: e.target.value } : x
                                )
                              )
                            }
                            className={inputSmCls}
                            placeholder="CDMX"
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelCls}>
                          Descripción (un punto por línea)
                        </label>
                        <CvExperienceEditor
                          valueHtml={exp.descriptionHtml || ""}
                          onChangeHtml={(html, plain) =>
                            setExperiences((prev) =>
                              prev.map((x, idx) =>
                                idx === i
                                  ? { ...x, descriptionHtml: html, bulletsText: plain }
                                  : x
                              )
                            )
                          }
                        />
                      </div>

                      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                        <button
                          type="button"
                          onClick={() => {
                            const newId = Date.now().toString();
                            const newRole: CvExperience = {
                              id: newId,
                              role: "",
                              company: exp.company,
                              city: exp.city,
                              startDate: "",
                              endDate: null,
                              isCurrent: false,
                              description: "",
                              descriptionHtml: "",
                              bulletsText: "",
                            };
                            setExperiences((prev) => {
                              const newArr = [...prev];
                              newArr.splice(i + 1, 0, newRole);
                              return newArr;
                            });
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium whitespace-nowrap"
                        >
                          + Añadir otro puesto aquí
                        </button>
                      </div>
                    </div>
                  );
                })}

                {experiences.length === 0 && (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm">Aún no agregas experiencia.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Educación */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      Educación
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Estudios académicos
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddEducation}
                  className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all"
                >
                  <span className="text-lg">+</span> Añadir
                </button>
              </div>

              <div className="space-y-4">
                {education.map((edu, i) => (
                  <div
                    key={edu.id || i}
                    className="relative bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 space-y-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveEducation(edu.id!)}
                      className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-red-600 text-lg cursor-pointer"
                      aria-label="Eliminar educación"
                      title="Eliminar"
                    >
                      ×
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Institución</label>
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((x, idx) =>
                                idx === i
                                  ? { ...x, institution: e.target.value }
                                  : x
                              )
                            )
                          }
                          className={inputCls}
                          placeholder="Universidad Tecnológica de México (UNITEC)"
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Programa</label>
                        <input
                          type="text"
                          value={edu.program || ""}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((x, idx) =>
                                idx === i ? { ...x, program: e.target.value } : x
                              )
                            )
                          }
                          className={inputCls}
                          placeholder="Ingeniería en Sistemas Computacionales"
                        />
                      </div>
                    </div>

                    {/* Fechas + En curso */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className={labelCls}>Inicio</label>
                        <input
                          type="month"
                          value={edu.startDate || ""}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((x, idx) =>
                                idx === i
                                  ? { ...x, startDate: e.target.value }
                                  : x
                              )
                            )
                          }
                          className={inputSmCls}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Fin</label>
                        <input
                          type="month"
                          value={edu.endDate || ""}
                          disabled={!!edu.isCurrent}
                          onChange={(e) =>
                            setEducation((prev) =>
                              prev.map((x, idx) =>
                                idx === i ? { ...x, endDate: e.target.value } : x
                              )
                            )
                          }
                          className={inputSmCls}
                        />
                      </div>

                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!edu.isCurrent}
                            onChange={(e) =>
                              setEducation((prev) =>
                                prev.map((x, idx) =>
                                  idx === i
                                    ? {
                                        ...x,
                                        isCurrent: e.target.checked,
                                        endDate: e.target.checked ? null : x.endDate,
                                      }
                                    : x
                                )
                              )
                            }
                            className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">
                            En curso
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                {education.length === 0 && (
                  <div className="text-center py-6 text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm">Aún no agregas estudios.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Skills */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      Habilidades técnicas
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Tecnologías y herramientas
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all"
                >
                  <span className="text-lg">+</span> Añadir
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {skills.map((skill, i) => {
                  const isOpen = openSkillIndex === i;
                  const query = skill.label;
                  const filtered = isOpen
                    ? filterSkillOptions(skillOptions, query)
                    : [];

                  return (
                    <div key={`${skill.termId}-${i}`} className="relative flex flex-col gap-3 sm:flex-row sm:items-end bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex-1 relative w-full">
                        <label className={labelCls}>Skill</label>
                        <input
                          type="text"
                          value={skill.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSkills((prev) =>
                              prev.map((s, idx) =>
                                idx === i ? { ...s, label: val } : s
                              )
                            );
                            setOpenSkillIndex(i);
                          }}
                          onFocus={() => setOpenSkillIndex(i)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenSkillIndex(i);
                          }}
                          className={inputCls}
                          placeholder="React (escribe para buscar o agregar custom)"
                        />

                        {isOpen && filtered.length > 0 && (
                          <ul
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-0 right-0 z-50 mt-1 max-h-60 w-full min-w-[12rem] overflow-auto rounded-md bg-white dark:bg-zinc-800 py-1 text-sm shadow-lg ring-1 ring-zinc-200 dark:ring-zinc-700"
                          >
                            {filtered.map((opt) => (
                              <li
                                key={opt.termId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSkills((prev) =>
                                    prev.map((s, idx) =>
                                      idx === i
                                        ? { ...s, termId: opt.termId, label: opt.label }
                                        : s
                                    )
                                  );
                                  setOpenSkillIndex(null);
                                }}
                                className="cursor-pointer select-none px-3 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-zinc-900 dark:text-zinc-100"
                              >
                                {opt.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="w-full sm:w-32">
                        <label className={labelCls}>Nivel</label>
                        <select
                          value={skill.level}
                          onChange={(e) =>
                            setSkills((prev) =>
                              prev.map((s, idx) =>
                                idx === i
                                  ? { ...s, level: Number(e.target.value) as any }
                                  : s
                              )
                            )
                          }
                          className={inputSmCls}
                        >
                          <option value={1}>Básico</option>
                          <option value={2}>Intermedio</option>
                          <option value={3}>Avanzado</option>
                          <option value={4}>Experto</option>
                          <option value={5}>Maestro</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(i)}
                        className="text-zinc-400 hover:text-red-600 text-xl cursor-pointer absolute top-2 right-2"
                        aria-label="Eliminar skill"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {skills.length === 0 && (
                  <div className="text-center py-6 text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm">Aún no agregas skills.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Idiomas */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      Idiomas
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Niveles de dominio
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddLanguage}
                  className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all"
                >
                  <span className="text-lg">+</span> Añadir
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {languages.map((lang, i) => {
                  const isOpen = openLanguageIndex === i;
                  const query = lang.label;
                  const filtered = isOpen
                    ? filterLanguageOptions(languageOptions, query)
                    : [];

                  return (
                    <div key={`${lang.termId}-${i}`} className="relative flex flex-col gap-3 sm:flex-row sm:items-end bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex-1 relative w-full">
                        <label className={labelCls}>Idioma</label>
                        <input
                          type="text"
                          value={lang.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLanguages((prev) =>
                              prev.map((l, idx) =>
                                idx === i ? { ...l, label: val } : l
                              )
                            );
                            setOpenLanguageIndex(i);
                          }}
                          onFocus={() => setOpenLanguageIndex(i)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenLanguageIndex(i);
                          }}
                          className={inputCls}
                          placeholder="Inglés"
                        />

                        {isOpen && filtered.length > 0 && (
                          <ul
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-0 right-0 z-50 mt-1 max-h-60 w-full min-w-[12rem] overflow-auto rounded-md bg-white dark:bg-zinc-800 py-1 text-sm shadow-lg ring-1 ring-zinc-200 dark:ring-zinc-700"
                          >
                            {filtered.map((opt) => (
                              <li
                                key={opt.termId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLanguages((prev) =>
                                    prev.map((l, idx) =>
                                      idx === i
                                        ? { ...l, termId: opt.termId, label: opt.label }
                                        : l
                                    )
                                  );
                                  setOpenLanguageIndex(null);
                                }}
                                className="cursor-pointer select-none px-3 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-zinc-900 dark:text-zinc-100"
                              >
                                {opt.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="w-full sm:w-36">
                        <label className={labelCls}>Nivel</label>
                        <select
                          value={lang.level}
                          onChange={(e) =>
                            setLanguages((prev) =>
                              prev.map((l, idx) =>
                                idx === i ? { ...l, level: e.target.value as any } : l
                              )
                            )
                          }
                          className={inputSmCls}
                        >
                          <option value="BASIC">Básico</option>
                          <option value="CONVERSATIONAL">Conversacional</option>
                          <option value="PROFESSIONAL">Profesional</option>
                          <option value="NATIVE">Nativo</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLanguage(i)}
                        className="text-zinc-400 hover:text-red-600 text-xl cursor-pointer absolute top-2 right-2"
                        aria-label="Eliminar idioma"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {languages.length === 0 && (
                  <div className="text-center py-6 text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm">Aún no agregas idiomas.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Certificaciones */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      Certificaciones
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Cursos y acreditaciones
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddCertification}
                  className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all"
                >
                  <span className="text-lg">+</span> Añadir
                </button>
              </div>

              <div className="space-y-3">
                {certifications.map((cert, i) => (
                  <div
                    key={cert.id || i}
                    className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className={labelCls}>Nombre de la certificación</label>
                          <input
                            type="text"
                            value={cert.name}
                            onChange={(e) =>
                              setCertifications((prev) =>
                                prev.map((c, idx) => (idx === i ? { ...c, name: e.target.value } : c))
                              )
                            }
                            className={inputCls}
                            placeholder="AWS Certified Solutions Architect"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Fecha (opcional)</label>
                            <input
                              type="month"
                              value={cert.date || ""}
                              onChange={(e) =>
                                setCertifications((prev) =>
                                  prev.map((c, idx) => (idx === i ? { ...c, date: e.target.value } : c))
                                )
                              }
                              className={inputSmCls}
                              placeholder="2024-01"
                            />
                          </div>

                          <div>
                            <label className={labelCls}>URL de credencial (opcional)</label>
                            <input
                              type="url"
                              value={cert.url || ""}
                              onChange={(e) =>
                                setCertifications((prev) =>
                                  prev.map((c, idx) => (idx === i ? { ...c, url: e.target.value } : c))
                                )
                              }
                              className={inputCls}
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveCertification(i)}
                        className="text-zinc-400 hover:text-red-600 text-lg cursor-pointer mt-6"
                        aria-label="Eliminar certificación"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}

                {certifications.length === 0 && (
                  <div className="text-center py-6 text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm">Aún no agregas certificaciones.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Call to action final */}
            {!isCandidate && (
              <section className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950 dark:to-blue-950 rounded-2xl shadow-lg border border-emerald-200 dark:border-emerald-800 p-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
                  Guarda tu CV y postúlate en un clic
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  Crea una cuenta gratis en Bolsa TI para conservar tu CV, editarlo
                  cuando quieras y postularte a vacantes sin volver a llenar todo.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/auth/signup/candidate"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all"
                  >
                    Crear cuenta y guardar CV
                  </Link>
                  <Link
                    href="/auth/signin"
                    className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white shadow-md hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 border border-zinc-200 dark:border-zinc-700 transition-all"
                  >
                    Ya tengo cuenta
                  </Link>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {downloadingPdf ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Generando PDF...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Descargar sin registrarme
                      </>
                    )}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Vista para exportar a PDF (oculta): ahora reusa el mismo componente */}
      <div ref={cvPrintRef} className="cv-print-root">
        <CvPreviewContent />
      </div>

      {/* ✅ MODAL: Vista previa completa */}
      {previewOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setPreviewOpen(false)}
            aria-label="Cerrar vista previa"
          />
          <div className="absolute inset-0 p-3 sm:p-6">
            <div className="h-full w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="font-semibold text-zinc-900 dark:text-white">
                  👁️ Vista previa completa
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📄 Descargar PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-8">
                <div className="mx-auto w-full max-w-[980px]">
                  <div className="shadow-2xl">
                    <CvPreviewContent />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estilos específicos para el phone input */}
      <style jsx global>{`
        .cv-builder-root .cv-phone-input label {
          font-size: 0.75rem;
          font-weight: 500;
          color: rgb(39 39 42);
          margin-bottom: 0.25rem;
        }

        .cv-builder-root .cv-phone-input input {
          font-size: 0.8125rem;
        }

        .dark .cv-builder-root .cv-phone-input label {
          color: rgb(244 244 245);
        }

        /* Evita cortes con guiones en headers SOLO dentro del CV Builder */
        .cv-builder-root h1,
        .cv-builder-root h2,
        .cv-builder-root h3,
        .cv-builder-root .cv-section-title {
          hyphens: none;
          -webkit-hyphens: none;
          -ms-hyphens: none;
          word-break: normal;
          overflow-wrap: break-word;
        }

        .cv-builder-root button,
        .cv-builder-root .btn {
          hyphens: none;
          -webkit-hyphens: none;
          -ms-hyphens: none;
          word-break: normal;
          overflow-wrap: normal;
        }
      `}</style>

      {/* ====== Estilos impresión/global ====== */}
      <style jsx global>{`
        /* ========================================
          ESTILOS PARA EL CV EN PDF (IMPRESIÓN)
          ======================================== */

        @media screen {
          .cv-print-root {
            display: none !important;
          }
        }

        body[data-exporting="1"] .cv-print-root {
          display: block !important;
          position: fixed !important;
          left: -10000px !important;
          top: 0 !important;
          width: 210mm !important;
        }

        body[data-exporting="1"] .cv-print-root .cv-sheet {
          box-shadow: none !important;
        }

        .cv-sheet {
          width: 210mm;
          background: #ffffff;
          margin: 0 auto;
          font-family: Arial, Helvetica, sans-serif;
          color: #000000;
        }

        .cv-sheet-inner {
          padding: 20mm 15mm 15mm 15mm;
        }

        .cv-header {
          margin-bottom: 6mm;
        }

        .cv-name {
          font-size: 18pt;
          font-weight: 700;
          margin: 0 0 2mm 0;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #000000;
        }

        .cv-role {
          font-size: 14pt;
          font-weight: 400;
          margin: 0 0 3mm 0;
          color: #333333;
        }

        .cv-divider-main {
          width: 100%;
          height: 2px;
          background-color: #000000;
          margin: 3mm 0;
        }

        .cv-divider {
          width: 100%;
          height: 1px;
          background-color: #000000;
          margin: 2mm 0 3mm 0;
        }

        .cv-contact-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 3mm;
          font-size: 9pt;
          color: #000000;
        }

        .cv-contact-item {
          display: inline-flex;
          align-items: center;
          gap: 1mm;
        }

        .cv-icon {
          font-size: 8pt;
        }

        .cv-link {
          color: #000000;
          text-decoration: underline;
        }

        .cv-section {
          margin-bottom: 6mm;
          break-inside: auto;
          page-break-inside: auto;
        }

        .cv-section-title {
          font-size: 11pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 1mm 0;
          color: #000000;
        }

        .cv-section-content {
          margin-top: 3mm;
        }

        .cv-education-item {
          margin-bottom: 3mm;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .cv-education-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 1mm;
        }

        .cv-education-degree {
          font-size: 11pt;
          font-weight: 600;
          color: #000000;
        }

        .cv-institution {
          font-size: 10pt;
          font-weight: 400;
          color: #333333;
        }

        .cv-date-range {
          font-size: 9pt;
          font-weight: 400;
          color: #555555;
          white-space: nowrap;
          margin-left: 3mm;
        }

        .cv-languages-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 4mm;
          font-size: 10pt;
        }

        .cv-language-item {
          display: inline-block;
        }

        .cv-language-name {
          font-weight: 600;
          color: #000000;
        }

        .cv-company-group {
          margin-bottom: 4mm;
        }

        .cv-experience-item {
          margin-bottom: 4mm;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .cv-experience-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 1mm;
        }

        .cv-role-title {
          font-size: 11pt;
          font-weight: 600;
          font-style: italic;
          color: #000000;
        }

        .cv-company-location {
          font-size: 10pt;
          font-weight: 400;
          margin-bottom: 2mm;
          color: #333333;
        }

        .cv-company-name {
          font-weight: 600;
          color: #000000;
        }

        .cv-separator {
          color: #666666;
        }

        .cv-city {
          color: #333333;
        }

        .cv-bullet-list {
          list-style-type: disc !important;
          list-style-position: outside !important;
          padding-left: 8mm !important;
          margin: 3mm 0 !important;
        }

        .cv-bullet-list li {
          font-size: 10pt !important;
          line-height: 1.6 !important;
          margin-bottom: 2mm !important;
          padding-left: 1mm !important;
          color: #000000 !important;
          display: list-item !important;
        }

        .cv-bullet-list li::marker {
          color: #000000 !important;
          font-size: 8pt !important;
        }

        .cv-exp-html {
          font-size: 10pt !important;
          line-height: 1.6 !important;
          margin: 3mm 0 !important;
          break-inside: auto;
          page-break-inside: auto;
        }

        .cv-exp-html ul {
          list-style-type: disc !important;
          list-style-position: outside !important;
          padding-left: 8mm !important;
          margin: 2mm 0 !important;
        }

        .cv-exp-html li {
          font-size: 10pt !important;
          line-height: 1.6 !important;
          margin-bottom: 2mm !important;
          padding-left: 1mm !important;
          color: #000000 !important;
          display: list-item !important;
        }

        .cv-exp-html li::marker {
          color: #000000 !important;
          font-size: 8pt !important;
        }

        .cv-exp-html p {
          margin: 2mm 0 !important;
        }

        .cv-skills-grouped {
          margin-bottom: 3mm;
        }

        .cv-skill-category {
          font-size: 10pt;
          line-height: 1.5;
          margin-bottom: 2mm;
          color: #000000;
        }

        .cv-skill-category-label {
          font-weight: 600;
          color: #000000;
        }

        .cv-certifications {
          margin-top: 3mm;
        }

        .cv-certification-header {
          font-size: 10pt;
          font-weight: 600;
          margin-bottom: 2mm;
          color: #000000;
        }

        .cv-certification-list {
          list-style-type: disc;
          padding-left: 6mm;
          margin: 0;
        }

        .cv-certification-list li {
          font-size: 10pt;
          line-height: 1.5;
          margin-bottom: 1.5mm;
          color: #000000;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          .cv-print-root,
          .cv-print-root * {
            visibility: visible !important;
          }

          .cv-print-root {
            display: block !important;
            position: static !important;
            inset: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .cv-sheet {
            box-shadow: none !important;
            border: 0 !important;
            background: #ffffff !important;
            margin: 0 auto !important;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>
    </div>
  );
}