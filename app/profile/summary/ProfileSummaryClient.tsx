// app/profile/summary/ProfileSummaryClient.tsx
"use client";

import { useState, useMemo, useRef, type ReactNode, type ElementType } from "react";
import Link from "next/link";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import PhoneInputField from "@/components/PhoneInputField";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import PasswordSettingsCard from "@/components/account/PasswordSettingsCard";
import { BadgeMedal } from "@/components/badges/BadgeMedal";
import { StartBadgeExamButton } from "@/components/badges/StartBadgeExamButton";
import CvImportPreview from "./CvImportPreview";
import type {
  CvImportAnalysis,
  CvImportSections,
} from "@/lib/profile/cv-import";
import {
  Phone,
  Mail,
  Linkedin,
  Github,
  Cake,
  DollarSign,
  Home,
  Laptop,
  Building2,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  GraduationCap,
  MapPin,
  AlertTriangle,
  Upload,
  Info,
  Sparkles,
} from "lucide-react";
import { MonthYearPicker, FullDatePicker } from "@/components/ui/WheelPicker";

/* ─── Types ──────────────────────────────────────────────── */
type SkillLevel = 1 | 2 | 3 | 4 | 5;
type LangLevel = "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
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
type Seniority = "JUNIOR" | "MID" | "SENIOR";

export type UserData = {
  id: string;
  email: string;
  firstName: string;
  lastName1: string;
  lastName2: string;
  phone: string;
  location: string;
  birthdate: string;
  linkedin: string;
  github: string;
  resumeUrl: string;
  certifications: string[];
  seniority: Seniority | null;
  yearsExperience: number | null;
  desiredSalary: number | null;
  seekingRemote: boolean;
  seekingHybrid: boolean;
  seekingOnsite: boolean;
  hasPassword: boolean;
};

export type Experience = {
  id?: string;
  role: string;
  company: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
};

export type Education = {
  id?: string;
  level: EducationLevel | null;
  status: EducationStatus;
  institution: string;
  program: string;
  startDate: string;
  endDate: string;
  sortIndex: number;
};

export type Language = {
  termId: string;
  label: string;
  level: LangLevel;
};

export type Skill = {
  termId: string;
  label: string;
  level: SkillLevel;
  /** Nivel de badge verificado (1=Básico 2=Intermedio 3=Avanzado), si el candidato aprobó el examen del skill */
  verifiedLevel?: number | null;
  /** Slug de la página pública del badge (null si el badge es privado) */
  verifiedSlug?: string | null;
  /** Examen activo que permite verificar este skill, si existe. */
  certificationTemplateId?: string | null;
};

export type VerifiedBadge = {
  termId: string;
  skill: string;
  level: number;
  levelLabel: string;
  slug: string;
  isPublic: boolean;
  isCurrent: boolean;
  earnedAt: string;
  expiresAt: string;
  logoSrc: string | null;
  linkedInUrl: string | null;
};

export type Application = {
  id: string;
  createdAt: string;
  status: string;
  jobId: string;
  jobSlug?: string | null;
  jobTitle: string;
  companyName: string;
};

/* ─── Constants ──────────────────────────────────────────── */
const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "Básico",
  2: "Junior",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
};

const APPLICATION_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  SUBMITTED: {
    label: "Enviada",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  REVIEWING: {
    label: "En revisi\u00f3n",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  },
  INTERVIEW: {
    label: "Entrevista",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  },
  OFFER: {
    label: "Oferta",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  HIRED: {
    label: "Contratado",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  REJECTED: {
    label: "No seleccionado",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  },
};

const LANG_LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional (C1–C2)",
  CONVERSATIONAL: "Conversacional (B1–B2)",
  BASIC: "Básico (A1–A2)",
};

const EDUCATION_LEVEL_LABEL: Record<string, string> = {
  NONE: "Sin estudios formales",
  PRIMARY: "Primaria",
  SECONDARY: "Secundaria",
  HIGH_SCHOOL: "Preparatoria / Bachillerato",
  TECHNICAL: "Técnico / TSU",
  BACHELOR: "Licenciatura / Ingeniería",
  MASTER: "Maestría",
  DOCTORATE: "Doctorado",
  OTHER: "Diplomado / Curso",
};

const EDUCATION_LEVEL_OPTIONS = [
  { value: "HIGH_SCHOOL", label: "Preparatoria / Bachillerato" },
  { value: "TECHNICAL", label: "Técnico / TSU" },
  { value: "BACHELOR", label: "Licenciatura / Ingeniería" },
  { value: "MASTER", label: "Maestría" },
  { value: "DOCTORATE", label: "Doctorado" },
  { value: "OTHER", label: "Diplomado / Curso" },
];

const SKILL_LEVELS = [
  { value: 1, label: "Básico" },
  { value: 2, label: "Junior" },
  { value: 3, label: "Intermedio" },
  { value: 4, label: "Avanzado" },
  { value: 5, label: "Experto" },
];

const LANG_LEVELS = [
  { value: "NATIVE", label: "Nativo" },
  { value: "PROFESSIONAL", label: "Profesional (C1–C2)" },
  { value: "CONVERSATIONAL", label: "Conversacional (B1–B2)" },
  { value: "BASIC", label: "Básico (A1–A2)" },
];

const WORK_MODES = [
  {
    key: "seekingRemote" as const,
    label: "Remoto",
    icon: Home,
    color:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-600/40 dark:bg-blue-950/30 dark:text-blue-300",
  },
  {
    key: "seekingHybrid" as const,
    label: "Híbrido",
    icon: Laptop,
    color:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-600/40 dark:bg-teal-950/30 dark:text-teal-300",
  },
  {
    key: "seekingOnsite" as const,
    label: "Presencial",
    icon: Building2,
    color:
      "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-600/40 dark:bg-zinc-800 dark:text-zinc-300",
  },
];

/* ─── Skill pill & bar colors ────────────────────────────── */
const SKILL_PILL_ACTIVE: Record<number, string> = {
  1: "bg-zinc-400 text-white shadow-sm",
  2: "bg-blue-400 text-white shadow-sm",
  3: "bg-yellow-400 text-white shadow-sm",
  4: "bg-emerald-400 text-white shadow-sm",
  5: "bg-emerald-600 text-white shadow-sm",
};

const SKILL_BAR_COLOR: Record<number, string> = {
  1: "bg-zinc-300 dark:bg-zinc-600",
  2: "bg-blue-400",
  3: "bg-yellow-400",
  4: "bg-emerald-400",
  5: "bg-emerald-600",
};

/* ─── Salary formatter ───────────────────────────────────── */
const fmtSalary = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

/* ─── Shared UI classes ──────────────────────────────────── */
const INPUT =
  "block min-h-[42px] w-full rounded-xl border border-zinc-300 bg-white/90 px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-50 dark:placeholder:text-zinc-500";
const LABEL =
  "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";
const BTN_SAVE =
  "w-full sm:w-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50";
const BTN_CANCEL =
  "w-full sm:w-auto rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60";
const BTN_EDIT =
  "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60";
const CARD = "glass-card p-4 md:p-6 space-y-4";
const SECTION_HEADER = "flex items-center justify-between gap-3";

function PencilIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 2l3 3-8 8H3v-3l8-8z"
      />
    </svg>
  );
}

function MetaRow({
  icon: Icon,
  children,
  className = "",
}: {
  icon: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400 ${className}`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

function fromNowSimple(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months > 1 ? "es" : ""}`;
  return `hace ${Math.floor(months / 12)} año${Math.floor(months / 12) > 1 ? "s" : ""}`;
}

function formatMonthYear(ym?: string | null) {
  if (!ym) return "—";
  const [year, month] = ym.split("-");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

function prettyExternalUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/* ─── PATCH helpers ──────────────────────────────────────── */
async function patchSection(endpoint: string, payload: Record<string, unknown>) {
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string"
        ? err.error
        : JSON.stringify(err?.error) || "Error al guardar"
    );
  }

  return res.json();
}

const patchPersonal = (p: Record<string, unknown>) =>
  patchSection("/api/profile/personal", p);
const patchExperiences = (p: Record<string, unknown>) =>
  patchSection("/api/profile/experiences", p);
const patchEducation = (p: Record<string, unknown>) =>
  patchSection("/api/profile/education", p);
const patchSkills = (p: Record<string, unknown>) =>
  patchSection("/api/profile/skills", p);
const patchLanguages = (p: Record<string, unknown>) =>
  patchSection("/api/profile/languages", p);
const patchCerts = (p: Record<string, unknown>) =>
  patchSection("/api/profile/personal", p);

/* ─── EditBar ────────────────────────────────────────────── */
function EditBar({
  onCancel,
  onSave,
  saving,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
      <button
        type="button"
        className={BTN_CANCEL}
        onClick={onCancel}
        disabled={saving}
      >
        Cancelar
      </button>
      <button
        type="button"
        className={BTN_SAVE}
        onClick={onSave}
        disabled={saving}
      >
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION: Datos personales
   ════════════════════════════════════════════════════════════ */
type ProfileStep = {
  label: string;
  action: string;
  href: string;
  done: boolean;
};

function ProfileCompletion({ steps }: { steps: ProfileStep[] }) {
  const completed = steps.filter((step) => step.done).length;
  const percentage = Math.round((completed / steps.length) * 100);
  const nextStep = steps.find((step) => !step.done);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Perfil {percentage}% completo
              </h2>
              <span className="text-xs text-zinc-400">
                {completed} de {steps.length} secciones
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {nextStep
                ? nextStep.action
                : "Tu perfil tiene la informaci\u00f3n esencial para los reclutadores."}
            </p>
          </div>
        </div>

        {nextStep && (
          <Link
            href={nextStep.href}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Completar ahora
          </Link>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: percentage + "%" }}
        />
      </div>

      <div className="mt-3 hidden flex-wrap gap-x-4 gap-y-1 sm:flex">
        {steps.map((step) => (
          <span
            key={step.label}
            className={
              "inline-flex items-center gap-1 text-[11px] " +
              (step.done
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-zinc-400 dark:text-zinc-500")
            }
          >
            {step.done ? (
              <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
            ) : (
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full border border-current"
              />
            )}
            {step.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function SectionPersonal({
  user,
  onChange,
  totalYears,
}: {
  user: UserData;
  onChange: (u: UserData) => void;
  totalYears: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UserData>(user);

  function open() {
    setDraft(user);
    setEditing(true);
  }

  function close() {
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    try {
      await patchPersonal({
        firstName: draft.firstName,
        lastName1: draft.lastName1,
        lastName2: draft.lastName2,
        phone: draft.phone,
        location: draft.location,
        birthdate: draft.birthdate,
        linkedin: draft.linkedin,
        github: draft.github,
        desiredSalary: draft.desiredSalary,
        seekingRemote: draft.seekingRemote,
        seekingHybrid: draft.seekingHybrid,
        seekingOnsite: draft.seekingOnsite,
      });
      onChange({ ...user, ...draft });
      setEditing(false);
      toastSuccess("Datos personales actualizados");
    } catch (e: any) {
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const displayName = [user.firstName, user.lastName1, user.lastName2]
    .filter(Boolean)
    .join(" ");
  const initials = [user.firstName[0], user.lastName1[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();
  const activeWorkModes = WORK_MODES.filter((m) => user[m.key]);
  const experienceYears = totalYears ?? user.yearsExperience;

  return (
    <section className={CARD} id="personal">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-lg dark:bg-emerald-900/40 dark:text-emerald-300">
          {initials || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 break-words">
              {displayName || "—"}
            </h1>
            {!editing && (
              <button className={`${BTN_EDIT} self-start sm:self-auto`} onClick={open}>
                <PencilIcon />
                Editar
              </button>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="break-words">
                {user.location || "Ubicación pendiente"}
              </span>
            </span>
            {user.seniority && (
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                {SENIORITY_LABEL[user.seniority] ?? user.seniority}
              </span>
            )}
            {typeof experienceYears === "number" && experienceYears > 0 && (
              <span>
                {experienceYears} {experienceYears === 1 ? "año" : "años"} de experiencia
              </span>
            )}
          </div>

          {!editing && (
            <div className="mt-3 space-y-2">
              {user.phone && (
                <MetaRow icon={Phone}>{user.phone}</MetaRow>
              )}

              {user.email && (
                <MetaRow icon={Mail}>{user.email}</MetaRow>
              )}

              {user.linkedin && (
                <a
                  href={user.linkedin.startsWith("http") ? user.linkedin : `https://${user.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <MetaRow
                    icon={Linkedin}
                    className="text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {prettyExternalUrl(user.linkedin)}
                  </MetaRow>
                </a>
              )}

              {user.github && (
                <a
                  href={user.github.startsWith("http") ? user.github : `https://${user.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <MetaRow
                    icon={Github}
                    className="hover:underline"
                  >
                    {prettyExternalUrl(user.github)}
                  </MetaRow>
                </a>
              )}

              {user.birthdate && (
                <MetaRow icon={Cake}>
                  {new Date(`${user.birthdate}T12:00:00`).toLocaleDateString("es-MX", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </MetaRow>
              )}

              {user.desiredSalary ? (
                <MetaRow icon={DollarSign}>
                  <span>
                    Salario deseado:{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">
                      {fmtSalary(user.desiredSalary)}
                    </span>
                    <span className="text-zinc-400"> / mes MXN</span>
                  </span>
                </MetaRow>
              ) : null}

              {activeWorkModes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeWorkModes.map((m) => (
                    <span
                      key={m.key}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${m.color}`}
                    >
                      <m.icon className="h-3 w-3" />
                      {m.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Nombre(s) *</label>
              <input
                className={INPUT}
                value={draft.firstName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, firstName: e.target.value }))
                }
              />
            </div>
            <div>
              <label className={LABEL}>Apellido paterno *</label>
              <input
                className={INPUT}
                value={draft.lastName1}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, lastName1: e.target.value }))
                }
              />
            </div>
            <div>
              <label className={LABEL}>Apellido materno</label>
              <input
                className={INPUT}
                value={draft.lastName2}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, lastName2: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Teléfono</label>
              <PhoneInputField
                value={draft.phone}
                onChange={(val) => setDraft((d) => ({ ...d, phone: val }))}
              />
            </div>
            <div>
              <label className={LABEL}>Ubicación</label>
              <LocationAutocomplete
                value={draft.location}
                onChange={(val) => setDraft((d) => ({ ...d, location: val }))}
                onPlace={(place) =>
                  setDraft((d) => ({ ...d, location: place.label }))
                }
                className={INPUT}
                placeholder="Ciudad, Estado, País"
                countries={["mx", "us", "ca", "ar", "co", "es"]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>LinkedIn</label>
              <input
                className={INPUT}
                value={draft.linkedin}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, linkedin: e.target.value }))
                }
                placeholder="linkedin.com/in/tu-usuario"
              />
            </div>
            <div>
              <label className={LABEL}>GitHub</label>
              <input
                className={INPUT}
                value={draft.github}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, github: e.target.value }))
                }
                placeholder="github.com/tu-usuario"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Fecha de nacimiento</label>
              <FullDatePicker
                value={draft.birthdate}
                onChange={(val) => setDraft((d) => ({ ...d, birthdate: val }))}
                placeholder="Día, mes y año"
                maxYear={new Date().getFullYear() - 16}
              />
            </div>
            <div>
              <label className={LABEL}>Salario deseado (MXN mensual bruto)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  max={999999}
                  step={500}
                  className={`${INPUT} pl-7`}
                  value={draft.desiredSalary ?? ""}
                  placeholder="Ej. 25000"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      desiredSalary:
                        e.target.value === "" ? null : parseInt(e.target.value, 10),
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <label className={LABEL}>Modalidad de trabajo preferida</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
              {WORK_MODES.map((m) => (
                <label
                  key={m.key}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 cursor-pointer select-none hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    checked={draft[m.key]}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [m.key]: e.target.checked }))
                    }
                  />
                  <span className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                    <m.icon className="h-3.5 w-3.5 opacity-80" />
                    {m.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Currículum (CV)
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                {user.resumeUrl ? "CV subido activo" : "Sin CV subido"}
              </p>
            </div>
            <a
              href="/profile/edit#cv"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60 transition-colors whitespace-nowrap"
            >
              {user.resumeUrl ? "Cambiar CV" : "Subir CV"}
            </a>
          </div>

          <EditBar onCancel={close} onSave={save} saving={saving} />
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION: Experiencia laboral (múltiples isCurrent ✅)
   ════════════════════════════════════════════════════════════ */
function SectionExperience({
  experiences,
  onChange,
}: {
  experiences: Experience[];
  onChange: (e: Experience[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Experience[]>(experiences);

  function open() {
    setDraft(experiences.map((e) => ({ ...e })));
    setEditing(true);
  }

  function close() {
    setEditing(false);
  }

  function addExp() {
    setDraft((d) => [
      ...d,
      { role: "", company: "", startDate: "", endDate: null, isCurrent: false },
    ]);
  }

  function removeExp(i: number) {
    setDraft((d) => d.filter((_, idx) => idx !== i));
  }

  function updateExp(i: number, field: keyof Experience, value: any) {
    setDraft((d) => d.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  async function save() {
    if (draft.some((e) => !e.role.trim() || !e.company.trim() || !e.startDate)) {
      toastError("Completa puesto, empresa e inicio en todas las experiencias");
      return;
    }
    setSaving(true);
    try {
      await patchExperiences({ experiences: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Experiencia actualizada");
    } catch (e: any) {
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={
        !editing && experiences.length === 0 ? "glass-card space-y-3 p-4" : CARD
      }
      id="experiencia"
    >
      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Historial de trabajo
        </h2>
        {!editing && (
          <button className={BTN_EDIT} onClick={open}>
            {experiences.length === 0 ? <span aria-hidden="true">+</span> : <PencilIcon />}
            {experiences.length === 0 ? "Agregar" : "Editar"}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-3">
          {experiences.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
              <BriefcaseBusiness className="h-5 w-5 shrink-0 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Agrega tu experiencia más reciente
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Ayuda a los reclutadores a entender tu trayectoria.
                </p>
              </div>
            </div>
          )}
          {experiences.map((e, i) => (
            <div key={e.id ?? i} className="soft-panel px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 break-words">
                    {e.role}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 break-words">
                    {e.company}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatMonthYear(e.startDate)} —{" "}
                    {e.isCurrent ? "actual" : formatMonthYear(e.endDate)}
                  </p>
                </div>
                {e.isCurrent && (
                  <span className="shrink-0 text-[10px] rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-medium dark:bg-emerald-900/40 dark:text-emerald-300">
                    Actual
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          {draft.filter((e) => e.isCurrent).length > 1 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Detectamos más de un trabajo actual. Verifica que sea correcto.
                </span>
              </div>
            </div>
          )}

          {draft.map((e, i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                  Experiencia {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeExp(i)}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  Eliminar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Puesto *</label>
                  <input
                    className={INPUT}
                    value={e.role}
                    onChange={(ev) => updateExp(i, "role", ev.target.value)}
                    placeholder="Ej. Software Engineer"
                  />
                </div>
                <div>
                  <label className={LABEL}>Empresa *</label>
                  <input
                    className={INPUT}
                    value={e.company}
                    onChange={(ev) => updateExp(i, "company", ev.target.value)}
                    placeholder="Ej. Google"
                  />
                </div>
                <div>
                  <label className={LABEL}>Inicio *</label>
                  <MonthYearPicker
                    value={e.startDate}
                    onChange={(val) => updateExp(i, "startDate", val)}
                    placeholder="Mes y año de inicio"
                  />
                </div>
                <div>
                  <label className={LABEL}>Fin</label>
                  <MonthYearPicker
                    value={e.endDate ?? ""}
                    onChange={(val) => updateExp(i, "endDate", val || null)}
                    disabled={e.isCurrent}
                    placeholder="Mes y año de fin"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={e.isCurrent}
                  onChange={(ev) => {
                    updateExp(i, "isCurrent", ev.target.checked);
                    if (ev.target.checked) updateExp(i, "endDate", null);
                  }}
                />
                <span className="text-zinc-700 dark:text-zinc-200">
                  Trabajo actual
                </span>
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={addExp}
            className="w-full rounded-xl border border-dashed border-zinc-300 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40 transition-colors"
          >
            + Agregar experiencia
          </button>

          <EditBar onCancel={close} onSave={save} saving={saving} />
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION: Escolaridad
   ════════════════════════════════════════════════════════════ */
function SectionEducation({
  education,
  onChange,
}: {
  education: Education[];
  onChange: (e: Education[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Education[]>(education);

  function open() {
    setDraft(education.map((e) => ({ ...e })));
    setEditing(true);
  }

  function close() {
    setEditing(false);
  }

  function addEd() {
    setDraft((d) => [
      ...d,
      {
        level: null,
        status: "COMPLETED",
        institution: "",
        program: "",
        startDate: "",
        endDate: "",
        sortIndex: d.length,
      },
    ]);
  }

  function removeEd(i: number) {
    setDraft((d) => d.filter((_, idx) => idx !== i));
  }

  function updateEd(i: number, field: keyof Education, value: any) {
    setDraft((d) => d.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  async function save() {
    if (draft.some((e) => !e.institution.trim())) {
      toastError("Completa el nombre de la institución en todos los estudios");
      return;
    }
    setSaving(true);
    try {
      await patchEducation({ education: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Escolaridad actualizada");
    } catch (e: any) {
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={
        !editing && education.length === 0 ? "glass-card space-y-3 p-4" : CARD
      }
      id="educacion"
    >
      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Escolaridad
        </h2>
        {!editing && (
          <button className={BTN_EDIT} onClick={open}>
            {education.length === 0 ? <span aria-hidden="true">+</span> : <PencilIcon />}
            {education.length === 0 ? "Agregar" : "Editar"}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-3">
          {education.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
              <GraduationCap className="h-5 w-5 shrink-0 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Agrega tu formación más relevante
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Incluye universidad, carrera técnica o estudios en curso.
                </p>
              </div>
            </div>
          )}

          {education.map((ed, i) => (
            <div key={ed.id ?? i} className="soft-panel px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 break-words">
                    {ed.institution}
                  </p>
                  {ed.program && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 break-words">
                      {ed.program}
                    </p>
                  )}
                  <div className="mt-0.5 flex gap-2 flex-wrap">
                    {ed.level && (
                      <span className="text-xs text-zinc-400">
                        {EDUCATION_LEVEL_LABEL[ed.level] ?? ed.level}
                      </span>
                    )}
                    <span className="text-xs text-zinc-400">
                      {formatMonthYear(ed.startDate)} —{" "}
                      {ed.status === "ONGOING"
                        ? "en curso"
                        : formatMonthYear(ed.endDate)}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] rounded-full bg-zinc-100 text-zinc-500 px-2 py-0.5 dark:bg-zinc-800 dark:text-zinc-400">
                  {ed.status === "COMPLETED"
                    ? "Concluido"
                    : ed.status === "ONGOING"
                      ? "En curso"
                      : "Trunco"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          {draft.map((ed, i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                  Entrada #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeEd(i)}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  Eliminar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Nivel</label>
                  <select
                    className={INPUT}
                    value={ed.level ?? ""}
                    onChange={(ev) => updateEd(i, "level", ev.target.value || null)}
                  >
                    <option value="">— Sin especificar —</option>
                    {EDUCATION_LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Institución *</label>
                  <input
                    className={INPUT}
                    value={ed.institution}
                    onChange={(ev) => updateEd(i, "institution", ev.target.value)}
                    placeholder="Ej. UANL, Tec de Monterrey…"
                  />
                </div>
                <div>
                  <label className={LABEL}>Programa / Carrera</label>
                  <input
                    className={INPUT}
                    value={ed.program}
                    onChange={(ev) => updateEd(i, "program", ev.target.value)}
                    placeholder="Ej. Ingeniería en Sistemas"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>Inicio</label>
                    <MonthYearPicker
                      value={ed.startDate}
                      onChange={(val) => updateEd(i, "startDate", val)}
                      placeholder="Mes y año"
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Fin</label>
                    <MonthYearPicker
                      value={ed.endDate}
                      onChange={(val) => updateEd(i, "endDate", val)}
                      placeholder="Mes y año"
                      maxYear={new Date().getFullYear() + 5}
                    />
                    <p className="mt-0.5 text-xs text-zinc-400">Vacío = en curso</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addEd}
            className="w-full rounded-xl border border-dashed border-zinc-300 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40 transition-colors"
          >
            + Agregar escolaridad
          </button>

          <EditBar onCancel={close} onSave={save} saving={saving} />
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION: Skills (sidebar)
   ════════════════════════════════════════════════════════════ */
function SectionSkills({
  skills,
  onChange,
  skillTermOptions,
}: {
  skills: Skill[];
  onChange: (s: Skill[]) => void;
  skillTermOptions: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Skill[]>(skills);
  const [query, setQuery] = useState("");

  function open() {
    setDraft(skills.map((s) => ({ ...s })));
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setQuery("");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const used = new Set(draft.map((s) => s.termId));
    return (q
      ? skillTermOptions.filter((o) => o.label.toLowerCase().includes(q))
      : skillTermOptions
    )
      .filter((o) => !used.has(o.id))
      .slice(0, 15);
  }, [query, skillTermOptions, draft]);

  function addSkill(opt: { id: string; label: string }) {
    if (draft.some((s) => s.termId === opt.id)) return;
    setDraft((d) => [...d, { termId: opt.id, label: opt.label, level: 3 }]);
    setQuery("");
  }

  function removeSkill(termId: string) {
    setDraft((d) => d.filter((s) => s.termId !== termId));
  }

  function setLevel(termId: string, level: SkillLevel) {
    setDraft((d) => d.map((s) => (s.termId === termId ? { ...s, level } : s)));
  }

  async function save() {
    setSaving(true);
    try {
      await patchSkills({ skills: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Skills actualizadas");
    } catch (e: any) {
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={CARD} id="skills">
      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Skills
        </h2>
        {!editing && (
          <button className={BTN_EDIT} onClick={open}>
            <PencilIcon />
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        skills.length > 0 ? (
          <ul className="space-y-2">
            {skills.map((s) => {
              const verifiedLabel =
                s.verifiedLevel === 1
                  ? "Básico"
                  : s.verifiedLevel === 2
                    ? "Intermedio"
                    : s.verifiedLevel === 3
                      ? "Avanzado"
                      : null;

              return (
                <li key={s.termId} className="soft-panel px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {s.label}
                    </span>
                    <span
                      className={
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                        (verifiedLabel
                          ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
                          : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400")
                      }
                    >
                      {verifiedLabel ? "TaskIO verificado" : "Autodeclarado"}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {verifiedLabel ? (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          Evaluado por TaskIO:{" "}
                          <strong className="font-semibold text-zinc-700 dark:text-zinc-200">
                            {verifiedLabel}
                          </strong>
                        </span>
                        {s.verifiedSlug && (
                          <Link
                            href={"/badge/" + s.verifiedSlug}
                            className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                          >
                            Ver credencial
                          </Link>
                        )}
                      </>
                    ) : (
                      <>
                        <span>
                          Nivel declarado:{" "}
                          <strong className="font-semibold text-zinc-700 dark:text-zinc-200">
                            {SKILL_LEVEL_LABEL[s.level] ?? "Nivel " + s.level}
                          </strong>
                        </span>
                        {s.certificationTemplateId && (
                          <StartBadgeExamButton
                            templateId={s.certificationTemplateId}
                            label="Certificar este skill →"
                            variant="link"
                          />
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400 italic">Sin skills registradas</p>
        )
      ) : (
        <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <div className="relative">
            <input
              className={INPUT}
              placeholder="Ej. React, Node.js, AWS…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && filtered.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 max-h-48 overflow-y-auto">
                {filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => addSkill(o)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            {draft.map((s) => (
              <div
                key={s.termId}
                className="rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 px-3 py-2.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 break-words text-sm font-medium">
                    {s.label}
                  </span>
                  {s.verifiedLevel != null ? (
                    <span
                      className="shrink-0 text-[10px] font-semibold uppercase text-teal-600 dark:text-teal-400"
                      title="Este skill está respaldado por una credencial TaskIO vigente"
                    >
                      Verificado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeSkill(s.termId)}
                      className="shrink-0 text-xs text-red-400 hover:text-red-600"
                      aria-label={"Eliminar " + s.label}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex gap-1 flex-wrap">
                  {SKILL_LEVELS.map((lv) => (
                    <button
                      key={lv.value}
                      type="button"
                      onClick={() => setLevel(s.termId, lv.value as SkillLevel)}
                      className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                        s.level === lv.value
                          ? SKILL_PILL_ACTIVE[lv.value]
                          : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {lv.label}
                    </button>
                  ))}
                </div>

                <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${SKILL_BAR_COLOR[s.level]}`}
                    style={{ width: `${Math.round(s.level * 20)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <EditBar onCancel={close} onSave={save} saving={saving} />
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION: Idiomas (sidebar)
   ════════════════════════════════════════════════════════════ */
function SectionLanguages({
  languages,
  onChange,
  languageOptions,
}: {
  languages: Language[];
  onChange: (l: Language[]) => void;
  languageOptions: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Language[]>(languages);

  function open() {
    setDraft(languages.map((l) => ({ ...l })));
    setEditing(true);
  }

  function close() {
    setEditing(false);
  }

  function addLang(opt: { id: string; label: string }) {
    if (draft.some((l) => l.termId === opt.id)) return;
    setDraft((d) => [
      ...d,
      { termId: opt.id, label: opt.label, level: "CONVERSATIONAL" },
    ]);
  }

  function removeLang(termId: string) {
    setDraft((d) => d.filter((l) => l.termId !== termId));
  }

  function setLevel(termId: string, level: LangLevel) {
    setDraft((d) => d.map((l) => (l.termId === termId ? { ...l, level } : l)));
  }

  async function save() {
    setSaving(true);
    try {
      await patchLanguages({ languages: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Idiomas actualizados");
    } catch (e: any) {
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const available = languageOptions.filter(
    (o) => !draft.some((l) => l.termId === o.id)
  );

  return (
    <section className={CARD} id="idiomas">
      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Idiomas
        </h2>
        {!editing && (
          <button className={BTN_EDIT} onClick={open}>
            <PencilIcon />
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        languages.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {languages.map((l) => (
              <li key={l.termId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 break-words">{l.label}</span>
                <span className="shrink-0 text-xs text-muted">
                  {LANG_LEVEL_LABEL[l.level] ?? l.level}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400 italic">Sin idiomas registrados</p>
        )
      ) : (
        <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {draft.map((l) => (
            <div
              key={l.termId}
              className="rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 px-3 py-2.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 break-words text-sm font-medium">
                  {l.label}
                </span>
                <button
                  type="button"
                  onClick={() => removeLang(l.termId)}
                  className="shrink-0 text-xs text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
              <select
                className={INPUT}
                value={l.level}
                onChange={(e) => setLevel(l.termId, e.target.value as LangLevel)}
              >
                {LANG_LEVELS.map((lv) => (
                  <option key={lv.value} value={lv.value}>
                    {lv.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {available.length > 0 && (
            <select
              className={INPUT}
              value=""
              onChange={(e) => {
                const opt = languageOptions.find((o) => o.id === e.target.value);
                if (opt) addLang(opt);
              }}
            >
              <option value="">+ Agregar idioma…</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}

          <EditBar onCancel={close} onSave={save} saving={saving} />
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION: Certificaciones (sidebar)
   ════════════════════════════════════════════════════════════ */
function SectionCertifications({
  certifications,
  verifiedBadges,
  onChange,
  certOptions,
}: {
  certifications: string[];
  verifiedBadges: VerifiedBadge[];
  onChange: (c: string[]) => void;
  certOptions: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string[]>(certifications);
  const [query, setQuery] = useState("");
  const activeBadgeCount = verifiedBadges.filter((badge) => badge.isCurrent).length;

  function open() {
    setDraft([...certifications]);
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setQuery("");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const used = new Set(draft.map((c) => c.toLowerCase()));
    return (q ? certOptions.filter((c) => c.toLowerCase().includes(q)) : certOptions)
      .filter((c) => !used.has(c.toLowerCase()))
      .slice(0, 20);
  }, [query, certOptions, draft]);

  function add(label: string) {
    const v = label.trim();
    if (!v || draft.some((c) => c.toLowerCase() === v.toLowerCase())) return;
    setDraft((d) => [...d, v]);
    setQuery("");
  }

  function remove(label: string) {
    setDraft((d) => d.filter((c) => c.toLowerCase() !== label.toLowerCase()));
  }

  async function save() {
    setSaving(true);
    try {
      await patchCerts({ certifications: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Certificaciones actualizadas");
    } catch (e: any) {
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={CARD} id="certificaciones">
      <div className={SECTION_HEADER}>
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Credenciales verificadas
          </h2>
          {verifiedBadges.length > 0 && !editing && (
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {activeBadgeCount}{" "}
              {activeBadgeCount === 1
                ? "verificada"
                : "verificadas"}{" "}
              por TaskIO
            </p>
          )}
        </div>
        {!editing && (
          <button
            className={BTN_EDIT}
            onClick={open}
            title={
              certifications.length > 0
                ? "Editar certificaciones externas"
                : "Agregar una certificación externa"
            }
          >
            {certifications.length > 0 ? <PencilIcon /> : <span aria-hidden="true">+</span>}
            {certifications.length > 0 ? "Editar externas" : "Agregar externa"}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-4">
          {verifiedBadges.length > 0 && (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {verifiedBadges.map((badge) => (
                <div key={badge.termId} className="flex items-center gap-3 py-3 first:pt-0">
                  <div className="shrink-0">
                    <BadgeMedal
                      skill={badge.skill}
                      level={badge.level}
                      state="earned"
                      size={44}
                      logoSrc={badge.logoSrc}
                      variant="compact"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {badge.skill}
                      </p>
                      <span
                        className={
                          "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase " +
                          (badge.isCurrent
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")
                        }
                      >
                        {badge.isCurrent ? "Verificada" : "Vencida"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {badge.levelLabel} · {badge.isCurrent ? "Vigente hasta" : "Venció"}{" "}
                      {new Date(badge.expiresAt).toLocaleDateString("es-MX", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {badge.isPublic && (
                    <div className="flex shrink-0 items-center gap-2">
                      {badge.linkedInUrl && (
                        <a
                          href={badge.linkedInUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/60"
                          title="Añadir esta credencial a LinkedIn"
                        >
                          <Linkedin className="h-3.5 w-3.5" />
                          LinkedIn
                        </a>
                      )}
                      <Link
                        href={"/badge/" + badge.slug}
                        className="inline-flex min-h-[32px] items-center rounded-md px-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
                      >
                        Ver
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {certifications.length > 0 && (
            <div
              className={
                verifiedBadges.length > 0
                  ? "border-t border-zinc-100 pt-3 dark:border-zinc-800"
                  : ""
              }
            >
              <p className="mb-2 text-[10px] font-semibold uppercase text-zinc-400">
                Certificaciones externas
              </p>
              <div className="flex flex-wrap gap-2">
                {certifications.map((c) => (
                  <span key={c} className="badge">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {verifiedBadges.length === 0 && certifications.length === 0 && (
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Presenta una evaluación gratuita y añade evidencia verificable a tu perfil.
            </p>
          )}

          <Link
            href="/certificaciones"
            className="inline-flex text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            {verifiedBadges.length > 0
              ? "Obtener otra credencial TaskIO →"
              : "Explorar certificaciones TaskIO →"}
          </Link>
        </div>
      ) : (
        <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <div className="relative">
            <input
              className={INPUT}
              placeholder="Busca o escribe una certificación…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (query.trim()) add(query);
                }
              }}
            />
            {query && filtered.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 max-h-48 overflow-y-auto">
                {filtered.map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => add(c)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {draft.map((c) => (
              <span key={c} className="badge inline-flex items-center gap-1">
                {c}
                <button
                  type="button"
                  onClick={() => remove(c)}
                  className="ml-0.5 text-zinc-400 hover:text-red-500"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <EditBar onCancel={close} onSave={save} saving={saving} />
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   ROOT CLIENT COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function ProfileSummaryClient({
  user: initialUser,
  experiences: initialExperiences,
  education: initialEducation,
  languages: initialLanguages,
  skills: initialSkills,
  verifiedBadges,
  applications,
  totalYears: initialTotalYears,
  languageOptions,
  skillTermOptions,
  certOptions,
  flashUpdated,
  flashCvImported,
  appliedMsg,
}: {
  user: UserData;
  experiences: Experience[];
  education: Education[];
  languages: Language[];
  skills: Skill[];
  verifiedBadges: VerifiedBadge[];
  applications: Application[];
  totalYears: number | null;
  languageOptions: { id: string; label: string }[];
  skillTermOptions: { id: string; label: string }[];
  certOptions: string[];
  flashUpdated: boolean;
  flashCvImported: boolean;
  appliedMsg: { text: string; tone: "emerald" | "amber" } | null;
}) {
  const [user, setUser] = useState(initialUser);
  const [experiences, setExperiences] = useState(initialExperiences);
  const [education, setEducation] = useState(initialEducation);
  const [languages, setLanguages] = useState(initialLanguages);
  const [skills, setSkills] = useState(initialSkills);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvAnalyzing, setCvAnalyzing] = useState(false);
  const [cvApplying, setCvApplying] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvSuccess, setCvSuccess] = useState(false);
  const [pendingCvImport, setPendingCvImport] = useState<{
    file: File;
    analysis: CvImportAnalysis;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cvUploadModeRef = useRef<"replace" | "analyze">("analyze");
  const cvBusy = cvUploading || cvAnalyzing || cvApplying;

  function openCvPicker(mode: "replace" | "analyze") {
    cvUploadModeRef.current = mode;
    fileInputRef.current?.click();
  }

  async function readApiError(response: Response, fallback: string) {
    const payload = await response.json().catch(() => null);
    return typeof payload?.error === "string" ? payload.error : fallback;
  }

  function validateCvFile(file: File) {
    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !["pdf", "doc", "docx"].includes(extension)) {
      return "Solo se permiten archivos PDF, DOC o DOCX";
    }
    if (file.size > 8 * 1024 * 1024) {
      return "El archivo debe pesar menos de 8 MB";
    }
    return null;
  }

  async function uploadCvFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/profile/upload-resume", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, "No se pudo subir el archivo"));
    }
    const payload = await response.json();
    if (typeof payload?.url !== "string") {
      throw new Error("No se recibió la URL del CV");
    }
    return payload.url as string;
  }

  async function replaceCvOnly(file: File) {
    setCvError(null);
    setCvSuccess(false);
    setCvUploading(true);
    try {
      const url = await uploadCvFile(file);
      const saveRes = await fetch("/api/profile/set-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeUrl: url }),
      });
      if (!saveRes.ok) {
        throw new Error(await readApiError(saveRes, "No se pudo guardar el CV"));
      }
      setUser((u) => ({ ...u, resumeUrl: url }));
      setCvSuccess(true);
      setTimeout(() => setCvSuccess(false), 4000);
    } catch (error) {
      setCvError(error instanceof Error ? error.message : "Error al reemplazar el CV");
    } finally {
      setCvUploading(false);
    }
  }

  async function analyzeCvForImport(file: File) {
    setCvError(null);
    setCvSuccess(false);
    setCvAnalyzing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", "preview");
      const response = await fetch("/api/ai/cv/upload-and-parse", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "No se pudo analizar el CV"));
      }
      const payload = await response.json();
      if (!payload?.analysis) {
        throw new Error("El análisis no devolvió datos válidos");
      }
      setPendingCvImport({ file, analysis: payload.analysis as CvImportAnalysis });
      window.setTimeout(() => {
        document.getElementById("cv-import-preview")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    } catch (error) {
      setCvError(error instanceof Error ? error.message : "Error al analizar el CV");
    } finally {
      setCvAnalyzing(false);
    }
  }

  async function handleCvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validationError = validateCvFile(file);
    if (validationError) {
      setCvError(validationError);
      return;
    }
    if (cvUploadModeRef.current === "analyze") {
      await analyzeCvForImport(file);
      return;
    }
    await replaceCvOnly(file);
  }

  async function applyCvImport(sections: CvImportSections) {
    if (!pendingCvImport) return;
    setCvError(null);
    setCvApplying(true);
    try {
      const resumeUrl = await uploadCvFile(pendingCvImport.file);
      const response = await fetch("/api/profile/cv-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeUrl,
          sections,
          analysis: pendingCvImport.analysis,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readApiError(response, "No se pudo actualizar el perfil")
        );
      }
      window.location.assign("/profile/summary?cvImported=1");
    } catch (error) {
      setCvError(error instanceof Error ? error.message : "Error al actualizar el perfil");
    } finally {
      setCvApplying(false);
    }
  }

  const totalYears = useMemo(() => {
    try {
      const sum = experiences.reduce((acc, e) => {
        const start = e.startDate ? new Date(`${e.startDate}-01`) : null;
        const end = e.isCurrent || !e.endDate ? new Date() : new Date(`${e.endDate}-01`);
        if (!start || isNaN(start.getTime()) || isNaN(end.getTime())) return acc;
        return (
          acc +
          Math.max(
            0,
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
          )
        );
      }, 0);
      return Math.round(sum * 10) / 10;
    } catch {
      return initialTotalYears;
    }
  }, [experiences, initialTotalYears]);

  const profileSteps: ProfileStep[] = [
    {
      label: "Contacto",
      action: "Agrega tu ubicación y teléfono para que puedan contactarte.",
      href: "#personal",
      done: Boolean(user.firstName && user.lastName1 && user.location && user.phone),
    },
    {
      label: "Experiencia",
      action: "Agrega tu experiencia más reciente.",
      href: "#experiencia",
      done: experiences.length > 0,
    },
    {
      label: "Educación",
      action: "Registra tu formación académica o técnica.",
      href: "#educacion",
      done: education.length > 0,
    },
    {
      label: "Skills",
      action: "Añade las tecnologías que dominas.",
      href: "#skills",
      done: skills.length > 0,
    },
    {
      label: "Idiomas",
      action: "Indica los idiomas que utilizas y su nivel.",
      href: "#idiomas",
      done: languages.length > 0,
    },
    {
      label: "CV",
      action: "Crea o carga tu CV para completar tu perfil.",
      href: "/cv/builder",
      done: Boolean(user.resumeUrl),
    },
  ];

  return (
    <main className="w-full pb-8">
      <div className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 pt-4 space-y-3">
        {flashUpdated && (
          <div className="border text-sm rounded-xl px-3 py-2 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            Perfil actualizado correctamente.
          </div>
        )}

        {flashCvImported && (
          <div className="border text-sm rounded-xl px-3 py-2 border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            CV actualizado. Agregamos la información seleccionada sin borrar tus datos anteriores.
          </div>
        )}

        {appliedMsg && (
          <div
            className={`border text-sm rounded-xl px-3 py-2 ${
              appliedMsg.tone === "emerald"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
            }`}
          >
            {appliedMsg.text}
          </div>
        )}

        {pendingCvImport && (
          <div id="cv-import-preview" className="scroll-mt-24">
            <CvImportPreview
              key={`${pendingCvImport.file.name}-${pendingCvImport.file.lastModified}`}
              analysis={pendingCvImport.analysis}
              fileName={pendingCvImport.file.name}
              currentCounts={{
                experiences: experiences.length,
                education: education.length,
                skills: skills.length,
                languages: languages.length,
              }}
              busy={cvApplying}
              error={cvError}
              onCancel={() => setPendingCvImport(null)}
              onApply={applyCvImport}
            />
          </div>
        )}

        <ProfileCompletion steps={profileSteps} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <SectionPersonal
              user={user}
              onChange={setUser}
              totalYears={totalYears}
            />
            <SectionExperience
              experiences={experiences}
              onChange={setExperiences}
            />
            <SectionEducation education={education} onChange={setEducation} />

            <section className={CARD} id="postulaciones">
              <div className={SECTION_HEADER}>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Mis postulaciones</h2>
                {applications.length > 0 && (
                  <Link href="/profile/applications" className={BTN_EDIT}>
                    Ver todas ({applications.length})
                  </Link>
                )}
              </div>
              {applications.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between">
                  <p className="text-sm text-muted">Aún no has postulado.</p>
                  <Link href="/jobs" className="btn-ghost text-xs whitespace-nowrap shrink-0">
                    Buscar vacantes
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {applications.slice(0, 3).map((application) => {
                    const status =
                      APPLICATION_STATUS_CONFIG[application.status] ??
                      APPLICATION_STATUS_CONFIG.SUBMITTED;

                    return (
                      <li
                        key={application.id}
                        className="soft-panel flex items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-medium">
                              {application.jobTitle} — {application.companyName}
                            </p>
                            <span
                              className={
                                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                                status.className
                              }
                            >
                              {status.label}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {fromNowSimple(application.createdAt)}
                          </p>
                        </div>
                        <Link
                          href={"/jobs/" + (application.jobSlug ?? application.jobId)}
                          className="btn-ghost shrink-0 whitespace-nowrap text-xs"
                        >
                          Ver
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <section className={CARD}>
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                CV
              </h2>

              {/* El modo se define antes de abrir este selector compartido. */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleCvFile}
              />

              {user.resumeUrl ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="flex-1 text-xs font-medium text-emerald-900 dark:text-emerald-100">
                        CV disponible
                      </p>
                      <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        ✓ Activo
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:block rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
                    <iframe
                      src={`${user.resumeUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="h-[400px] w-full"
                      title="Vista previa del CV"
                    />
                  </div>

                  <a
                    href={user.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir en nueva pestaña
                  </a>

                  <button
                    type="button"
                    onClick={() => openCvPicker("analyze")}
                    disabled={cvBusy}
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {cvAnalyzing ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analizando CV…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analizar y actualizar perfil
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openCvPicker("replace")}
                    disabled={cvBusy}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
                  >
                    {cvUploading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Subiendo…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Reemplazar sólo el archivo
                      </>
                    )}
                  </button>

                  {cvSuccess && (
                    <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ CV subido correctamente
                    </p>
                  )}
                  {cvError && (
                    <p className="text-center text-xs text-red-500">{cvError}</p>
                  )}

                  <div className="flex items-start gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-400" />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Analizar muestra una vista previa para elegir qué agregar. Reemplazar sólo el archivo conserva el perfil exactamente como está.
                    </p>
                  </div>

                  <Link
                    href="/cv/builder"
                    className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    Editar en CV Builder
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <svg
                        className="h-5 w-5 text-zinc-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Sin CV
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Crea tu curriculo o sube un PDF existente
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCvPicker("analyze")}
                    disabled={cvBusy}
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {cvAnalyzing ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analizando CV…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analizar y completar perfil
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openCvPicker("replace")}
                    disabled={cvBusy}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
                  >
                    {cvUploading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Subiendo…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Cargar sólo el archivo
                      </>
                    )}
                  </button>

                  {cvSuccess && (
                    <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ CV subido correctamente
                    </p>
                  )}
                  {cvError && (
                    <p className="text-center text-xs text-red-500">{cvError}</p>
                  )}

                  <div className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Podrás revisar lo detectado antes de modificar tu perfil.
                    </p>
                  </div>

                  <Link
                    href="/cv/builder"
                    className="inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  >
                    Crear CV en CV Builder
                  </Link>
                </div>
              )}
            </section>

            <SectionCertifications
              certifications={user.certifications}
              verifiedBadges={verifiedBadges}
              certOptions={certOptions}
              onChange={(certs) => setUser((u) => ({ ...u, certifications: certs }))}
            />
            <SectionSkills
              skills={skills}
              onChange={setSkills}
              skillTermOptions={skillTermOptions}
            />
            <SectionLanguages
              languages={languages}
              onChange={setLanguages}
              languageOptions={languageOptions}
            />
            <PasswordSettingsCard hasPassword={user.hasPassword} compact collapsible />
          </aside>
        </div>

        <div className="mt-6">
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm text-blue-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-blue-400 dark:hover:bg-zinc-800/40"
          >
            ← Buscar vacantes
          </Link>
        </div>
      </div>
    </main>
  );
}
