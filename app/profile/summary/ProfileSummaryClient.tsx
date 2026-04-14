// app/profile/summary/ProfileSummaryClient.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { toastSuccess, toastError } from "@/lib/ui/toast";

/* ─── Types ──────────────────────────────────────────────── */
type SkillLevel = 1 | 2 | 3 | 4 | 5;
type LangLevel = "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
type EducationLevel =
  | "NONE" | "PRIMARY" | "SECONDARY" | "HIGH_SCHOOL"
  | "TECHNICAL" | "BACHELOR" | "MASTER" | "DOCTORATE" | "OTHER";
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
  desiredSalary: number | null; // ✅ MXN mensual bruto
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
};

export type Application = {
  id: string;
  createdAt: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
};

/* ─── Constants ──────────────────────────────────────────── */
const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "Básico", 2: "Junior", 3: "Intermedio", 4: "Avanzado", 5: "Experto",
};
const LANG_LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional (C1–C2)",
  CONVERSATIONAL: "Conversacional (B1–B2)",
  BASIC: "Básico (A1–A2)",
};
const EDUCATION_LEVEL_LABEL: Record<string, string> = {
  NONE: "Sin estudios formales", PRIMARY: "Primaria", SECONDARY: "Secundaria",
  HIGH_SCHOOL: "Preparatoria / Bachillerato", TECHNICAL: "Técnico / TSU",
  BACHELOR: "Licenciatura / Ingeniería", MASTER: "Maestría",
  DOCTORATE: "Doctorado", OTHER: "Diplomado / Curso",
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
  { value: 1, label: "Básico" }, { value: 2, label: "Junior" },
  { value: 3, label: "Intermedio" }, { value: 4, label: "Avanzado" }, { value: 5, label: "Experto" },
];
const LANG_LEVELS = [
  { value: "NATIVE", label: "Nativo" },
  { value: "PROFESSIONAL", label: "Profesional (C1–C2)" },
  { value: "CONVERSATIONAL", label: "Conversacional (B1–B2)" },
  { value: "BASIC", label: "Básico (A1–A2)" },
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
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

/* ─── Shared UI classes ──────────────────────────────────── */
const INPUT = "block w-full rounded-xl border border-zinc-300 bg-white/90 px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-50 dark:placeholder:text-zinc-500";
const LABEL = "block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1";
const BTN_SAVE = "rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50";
const BTN_CANCEL = "rounded-lg border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60";
const BTN_EDIT = "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60";
const CARD = "glass-card p-4 md:p-6 space-y-4";
const SECTION_HEADER = "flex items-center justify-between gap-3";

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 2l3 3-8 8H3v-3l8-8z" />
    </svg>
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

const patchPersonal    = (p: Record<string, unknown>) => patchSection("/api/profile/personal",    p);
const patchExperiences = (p: Record<string, unknown>) => patchSection("/api/profile/experiences", p);
const patchEducation   = (p: Record<string, unknown>) => patchSection("/api/profile/education",   p);
const patchSkills      = (p: Record<string, unknown>) => patchSection("/api/profile/skills",      p);
const patchLanguages   = (p: Record<string, unknown>) => patchSection("/api/profile/languages",   p);
const patchCerts       = (p: Record<string, unknown>) => patchSection("/api/profile/personal",    p);

/* ─── EditBar ────────────────────────────────────────────── */
function EditBar({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
      <button type="button" className={BTN_CANCEL} onClick={onCancel} disabled={saving}>Cancelar</button>
      <button type="button" className={BTN_SAVE} onClick={onSave} disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION: Datos personales
   ════════════════════════════════════════════════════════════ */
function SectionPersonal({ user, onChange }: { user: UserData; onChange: (u: UserData) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<UserData>(user);

  function open() { setDraft(user); setEditing(true); }
  function close() { setEditing(false); }

  async function save() {
    setSaving(true);
    try {
      await patchPersonal({
        firstName:    draft.firstName,
        lastName1:    draft.lastName1,
        lastName2:    draft.lastName2,
        phone:        draft.phone,
        location:     draft.location,
        birthdate:    draft.birthdate,
        linkedin:     draft.linkedin,
        github:       draft.github,
        desiredSalary: draft.desiredSalary, // ✅
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

  const displayName = [user.firstName, user.lastName1, user.lastName2].filter(Boolean).join(" ");
  const initials = [user.firstName[0], user.lastName1[0]].filter(Boolean).join("").toUpperCase();

  return (
    <section className={CARD} id="personal">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-lg dark:bg-emerald-900/40 dark:text-emerald-300">
          {initials || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 truncate">{displayName || "—"}</h1>
            {!editing && (
              <button className={BTN_EDIT} onClick={open}><PencilIcon />Editar</button>
            )}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{user.location || "Sin ubicación"}</p>

          {/* Vista de lectura */}
          {!editing && (
            <div className="mt-2 space-y-1">
              {user.phone && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <span>📞</span> {user.phone}
                </p>
              )}
              {user.email && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <span>✉️</span> {user.email}
                </p>
              )}
              {user.linkedin && (
                <a href={user.linkedin.startsWith("http") ? user.linkedin : `https://${user.linkedin}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline dark:text-emerald-400 flex items-center gap-1.5 truncate">
                  <span>💼</span> {user.linkedin}
                </a>
              )}
              {user.github && (
                <a href={user.github.startsWith("http") ? user.github : `https://${user.github}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-zinc-500 hover:underline dark:text-zinc-400 flex items-center gap-1.5 truncate">
                  <span>🐙</span> {user.github}
                </a>
              )}
              {user.birthdate && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <span>🎂</span>{" "}
                  {new Date(user.birthdate).toLocaleDateString("es-MX", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </p>
              )}
              {/* ✅ Salario deseado en vista lectura */}
              {user.desiredSalary ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <span>💰</span>
                  <span>
                    Salario deseado:{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">
                      {fmtSalary(user.desiredSalary)}
                    </span>
                    <span className="text-zinc-400"> / mes MXN</span>
                  </span>
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Nombre(s) *</label>
              <input className={INPUT} value={draft.firstName} onChange={e => setDraft(d => ({ ...d, firstName: e.target.value }))} />
            </div>
            <div>
              <label className={LABEL}>Apellido paterno *</label>
              <input className={INPUT} value={draft.lastName1} onChange={e => setDraft(d => ({ ...d, lastName1: e.target.value }))} />
            </div>
            <div>
              <label className={LABEL}>Apellido materno</label>
              <input className={INPUT} value={draft.lastName2} onChange={e => setDraft(d => ({ ...d, lastName2: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Teléfono</label>
              <input className={INPUT} value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} placeholder="+52 818 000 0000" />
            </div>
            <div>
              <label className={LABEL}>Ubicación</label>
              <input className={INPUT} value={draft.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} placeholder="Ciudad, Estado, País" />
            </div>
            <div>
              <label className={LABEL}>LinkedIn</label>
              <input className={INPUT} value={draft.linkedin} onChange={e => setDraft(d => ({ ...d, linkedin: e.target.value }))} placeholder="linkedin.com/in/tu-usuario" />
            </div>
            <div>
              <label className={LABEL}>GitHub</label>
              <input className={INPUT} value={draft.github} onChange={e => setDraft(d => ({ ...d, github: e.target.value }))} placeholder="github.com/tu-usuario" />
            </div>
            <div>
              <label className={LABEL}>Fecha de nacimiento</label>
              <input type="date" className={INPUT} value={draft.birthdate} onChange={e => setDraft(d => ({ ...d, birthdate: e.target.value }))} />
            </div>
            {/* ✅ Salario deseado en edición */}
            <div>
              <label className={LABEL}>Salario deseado (MXN mensual bruto)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">$</span>
                <input
                  type="number"
                  min={0}
                  max={999999}
                  step={500}
                  className={INPUT + " pl-7"}
                  value={draft.desiredSalary ?? ""}
                  placeholder="Ej. 25000"
                  onChange={e => setDraft(d => ({
                    ...d,
                    desiredSalary: e.target.value === "" ? null : parseInt(e.target.value, 10),
                  }))}
                />
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">Solo visible para recruiters con tu aplicación activa</p>
            </div>
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
  experiences, onChange, totalYears, appCount,
}: {
  experiences: Experience[];
  onChange: (e: Experience[]) => void;
  totalYears: number | null;
  appCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Experience[]>(experiences);

  function open() { setDraft(experiences.map(e => ({ ...e }))); setEditing(true); }
  function close() { setEditing(false); }

  function addExp() {
    setDraft(d => [...d, { role: "", company: "", startDate: "", endDate: null, isCurrent: false }]);
  }
  function removeExp(i: number) { setDraft(d => d.filter((_, idx) => idx !== i)); }
  function updateExp(i: number, field: keyof Experience, value: any) {
    setDraft(d => d.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  async function save() {
    if (draft.some(e => !e.role.trim() || !e.company.trim() || !e.startDate)) {
      toastError("Completa puesto, empresa e inicio en todas las experiencias");
      return;
    }
    setSaving(true);
    try {
      await patchExperiences({ experiences: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Experiencia actualizada");
    } catch (e: any) { toastError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <section className={CARD} id="experiencia">
      <div className="grid grid-cols-3 gap-3">
        {[
          { num: totalYears != null ? `${totalYears}` : "—", label: "Años exp." },
          { num: experiences.length, label: "Trabajos" },
          { num: appCount, label: "Postulaciones" },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-zinc-50 dark:bg-zinc-900/40 px-3 py-3 text-center">
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{s.num}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Historial de trabajo</h2>
        {!editing && <button className={BTN_EDIT} onClick={open}><PencilIcon />Editar</button>}
      </div>

      {!editing ? (
        <div className="space-y-3">
          {experiences.length === 0 && (
            <p className="text-sm text-zinc-400 italic">Sin experiencia registrada</p>
          )}
          {experiences.map((e, i) => (
            <div key={e.id ?? i} className="soft-panel px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{e.role}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{e.company}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {formatMonthYear(e.startDate)} — {e.isCurrent ? "actual" : formatMonthYear(e.endDate)}
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
          {draft.filter(e => e.isCurrent).length > 1 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200">
              ⚠ Detectamos más de un trabajo actual. Verifica que sea correcto.
            </div>
          )}
          {draft.map((e, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Experiencia {i + 1}</span>
                <button type="button" onClick={() => removeExp(i)} className="text-xs text-red-500 hover:text-red-600">Eliminar</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Puesto *</label>
                  <input className={INPUT} value={e.role} onChange={ev => updateExp(i, "role", ev.target.value)} placeholder="Ej. Software Engineer" />
                </div>
                <div>
                  <label className={LABEL}>Empresa *</label>
                  <input className={INPUT} value={e.company} onChange={ev => updateExp(i, "company", ev.target.value)} placeholder="Ej. Google" />
                </div>
                <div>
                  <label className={LABEL}>Inicio *</label>
                  <input type="month" className={INPUT} value={e.startDate} onChange={ev => updateExp(i, "startDate", ev.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Fin</label>
                  <input type="month" className={INPUT} value={e.endDate ?? ""} disabled={e.isCurrent}
                    onChange={ev => updateExp(i, "endDate", ev.target.value || null)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" className="rounded" checked={e.isCurrent}
                  onChange={ev => {
                    updateExp(i, "isCurrent", ev.target.checked);
                    if (ev.target.checked) updateExp(i, "endDate", null);
                  }} />
                <span className="text-zinc-700 dark:text-zinc-200">Trabajo actual</span>
              </label>
            </div>
          ))}
          <button type="button" onClick={addExp}
            className="w-full rounded-xl border border-dashed border-zinc-300 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40 transition-colors">
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
function SectionEducation({ education, onChange }: { education: Education[]; onChange: (e: Education[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Education[]>(education);

  function open() { setDraft(education.map(e => ({ ...e }))); setEditing(true); }
  function close() { setEditing(false); }

  function addEd() {
    setDraft(d => [...d, { level: null, status: "COMPLETED", institution: "", program: "", startDate: "", endDate: "", sortIndex: d.length }]);
  }
  function removeEd(i: number) { setDraft(d => d.filter((_, idx) => idx !== i)); }
  function updateEd(i: number, field: keyof Education, value: any) {
    setDraft(d => d.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  async function save() {
    if (draft.some(e => !e.institution.trim())) {
      toastError("Completa el nombre de la institución en todos los estudios");
      return;
    }
    setSaving(true);
    try {
      await patchEducation({ education: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Escolaridad actualizada");
    } catch (e: any) { toastError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <section className={CARD} id="educacion">
      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Escolaridad</h2>
        {!editing && <button className={BTN_EDIT} onClick={open}><PencilIcon />Editar</button>}
      </div>

      {!editing ? (
        <div className="space-y-3">
          {education.length === 0 && <p className="text-sm text-zinc-400 italic">Sin escolaridad registrada</p>}
          {education.map((ed, i) => (
            <div key={ed.id ?? i} className="soft-panel px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{ed.institution}</p>
                  {ed.program && <p className="text-sm text-zinc-500 dark:text-zinc-400">{ed.program}</p>}
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {ed.level && <span className="text-xs text-zinc-400">{EDUCATION_LEVEL_LABEL[ed.level] ?? ed.level}</span>}
                    <span className="text-xs text-zinc-400">
                      {formatMonthYear(ed.startDate)} — {ed.status === "ONGOING" ? "en curso" : formatMonthYear(ed.endDate)}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] rounded-full bg-zinc-100 text-zinc-500 px-2 py-0.5 dark:bg-zinc-800 dark:text-zinc-400">
                  {ed.status === "COMPLETED" ? "Concluido" : ed.status === "ONGOING" ? "En curso" : "Trunco"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          {draft.map((ed, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Entrada #{i + 1}</span>
                <button type="button" onClick={() => removeEd(i)} className="text-xs text-red-500 hover:text-red-600">Eliminar</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Nivel</label>
                  <select className={INPUT} value={ed.level ?? ""} onChange={ev => updateEd(i, "level", ev.target.value || null)}>
                    <option value="">— Sin especificar —</option>
                    {EDUCATION_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Institución *</label>
                  <input className={INPUT} value={ed.institution} onChange={ev => updateEd(i, "institution", ev.target.value)} placeholder="Ej. UANL, Tec de Monterrey…" />
                </div>
                <div>
                  <label className={LABEL}>Programa / Carrera</label>
                  <input className={INPUT} value={ed.program} onChange={ev => updateEd(i, "program", ev.target.value)} placeholder="Ej. Ingeniería en Sistemas" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>Inicio</label>
                    <input type="month" className={INPUT} value={ed.startDate} onChange={ev => updateEd(i, "startDate", ev.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL}>Fin</label>
                    <input type="month" className={INPUT} value={ed.endDate} onChange={ev => updateEd(i, "endDate", ev.target.value)} />
                    <p className="mt-0.5 text-xs text-zinc-400">Vacío = en curso</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={addEd}
            className="w-full rounded-xl border border-dashed border-zinc-300 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40 transition-colors">
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
  skills, onChange, skillTermOptions,
}: {
  skills: Skill[];
  onChange: (s: Skill[]) => void;
  skillTermOptions: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Skill[]>(skills);
  const [query, setQuery] = useState("");

  function open() { setDraft(skills.map(s => ({ ...s }))); setEditing(true); }
  function close() { setEditing(false); setQuery(""); }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const used = new Set(draft.map(s => s.termId));
    return (q ? skillTermOptions.filter(o => o.label.toLowerCase().includes(q)) : skillTermOptions)
      .filter(o => !used.has(o.id))
      .slice(0, 15);
  }, [query, skillTermOptions, draft]);

  function addSkill(opt: { id: string; label: string }) {
    if (draft.some(s => s.termId === opt.id)) return;
    setDraft(d => [...d, { termId: opt.id, label: opt.label, level: 3 }]);
    setQuery("");
  }
  function removeSkill(termId: string) { setDraft(d => d.filter(s => s.termId !== termId)); }
  function setLevel(termId: string, level: SkillLevel) {
    setDraft(d => d.map(s => s.termId === termId ? { ...s, level } : s));
  }

  async function save() {
    setSaving(true);
    try {
      await patchSkills({ skills: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Skills actualizadas");
    } catch (e: any) { toastError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <section className={CARD} id="skills">
      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Skills</h2>
        {!editing && <button className={BTN_EDIT} onClick={open}><PencilIcon />Editar</button>}
      </div>

      {!editing ? (
        skills.length > 0 ? (
          <ul className="space-y-3">
            {skills.map((s) => {
              const pct = Math.max(0, Math.min(100, Math.round((s.level ?? 0) * 20)));
              return (
                <li key={s.termId} className="soft-panel px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs text-muted">{SKILL_LEVEL_LABEL[s.level] ?? `Nivel ${s.level}`}</span>
                  </div>
                  <div className="mt-2 progress" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={s.level}>
                    <div className="progress-bar" style={{ width: `${pct}%` }} />
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
              onChange={e => setQuery(e.target.value)}
            />
            {query && filtered.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 max-h-48 overflow-y-auto">
                {filtered.map(o => (
                  <li key={o.id}>
                    <button type="button" onClick={() => addSkill(o)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3">
            {draft.map(s => (
              <div key={s.termId} className="rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.label}</span>
                  <button type="button" onClick={() => removeSkill(s.termId)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {SKILL_LEVELS.map(lv => (
                    <button key={lv.value} type="button"
                      onClick={() => setLevel(s.termId, lv.value as SkillLevel)}
                      className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                        s.level === lv.value
                          ? SKILL_PILL_ACTIVE[lv.value]
                          : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"
                      }`}>
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
  languages, onChange, languageOptions,
}: {
  languages: Language[];
  onChange: (l: Language[]) => void;
  languageOptions: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Language[]>(languages);

  function open() { setDraft(languages.map(l => ({ ...l }))); setEditing(true); }
  function close() { setEditing(false); }

  function addLang(opt: { id: string; label: string }) {
    if (draft.some(l => l.termId === opt.id)) return;
    setDraft(d => [...d, { termId: opt.id, label: opt.label, level: "CONVERSATIONAL" }]);
  }
  function removeLang(termId: string) { setDraft(d => d.filter(l => l.termId !== termId)); }
  function setLevel(termId: string, level: LangLevel) {
    setDraft(d => d.map(l => l.termId === termId ? { ...l, level } : l));
  }

  async function save() {
    setSaving(true);
    try {
      await patchLanguages({ languages: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Idiomas actualizados");
    } catch (e: any) { toastError(e.message); }
    finally { setSaving(false); }
  }

  const available = languageOptions.filter(o => !draft.some(l => l.termId === o.id));

  return (
    <section className={CARD} id="idiomas">
      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Idiomas</h2>
        {!editing && <button className={BTN_EDIT} onClick={open}><PencilIcon />Editar</button>}
      </div>

      {!editing ? (
        languages.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {languages.map(l => (
              <li key={l.termId} className="flex items-center justify-between">
                <span>{l.label}</span>
                <span className="text-xs text-muted">{LANG_LEVEL_LABEL[l.level] ?? l.level}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400 italic">Sin idiomas registrados</p>
        )
      ) : (
        <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {draft.map(l => (
            <div key={l.termId} className="rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{l.label}</span>
                <button type="button" onClick={() => removeLang(l.termId)} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
              <select className={INPUT} value={l.level} onChange={e => setLevel(l.termId, e.target.value as LangLevel)}>
                {LANG_LEVELS.map(lv => <option key={lv.value} value={lv.value}>{lv.label}</option>)}
              </select>
            </div>
          ))}
          {available.length > 0 && (
            <select className={INPUT} value="" onChange={e => {
              const opt = languageOptions.find(o => o.id === e.target.value);
              if (opt) addLang(opt);
            }}>
              <option value="">+ Agregar idioma…</option>
              {available.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
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
  certifications, onChange, certOptions,
}: {
  certifications: string[];
  onChange: (c: string[]) => void;
  certOptions: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string[]>(certifications);
  const [query, setQuery] = useState("");

  function open() { setDraft([...certifications]); setEditing(true); }
  function close() { setEditing(false); setQuery(""); }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const used = new Set(draft.map(c => c.toLowerCase()));
    return (q ? certOptions.filter(c => c.toLowerCase().includes(q)) : certOptions)
      .filter(c => !used.has(c.toLowerCase()))
      .slice(0, 20);
  }, [query, certOptions, draft]);

  function add(label: string) {
    const v = label.trim();
    if (!v || draft.some(c => c.toLowerCase() === v.toLowerCase())) return;
    setDraft(d => [...d, v]);
    setQuery("");
  }
  function remove(label: string) { setDraft(d => d.filter(c => c.toLowerCase() !== label.toLowerCase())); }

  async function save() {
    setSaving(true);
    try {
      await patchCerts({ certifications: draft });
      onChange(draft);
      setEditing(false);
      toastSuccess("Certificaciones actualizadas");
    } catch (e: any) { toastError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <section className={CARD} id="certificaciones">
      <div className={SECTION_HEADER}>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Certificaciones</h2>
        {!editing && <button className={BTN_EDIT} onClick={open}><PencilIcon />Editar</button>}
      </div>

      {!editing ? (
        certifications.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {certifications.map(c => <span key={c} className="badge">{c}</span>)}
          </div>
        ) : (
          <p className="text-sm text-zinc-400 italic">Sin certificaciones</p>
        )
      ) : (
        <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <div className="relative">
            <input className={INPUT} placeholder="Busca o escribe una certificación…"
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (query.trim()) add(query); } }} />
            {query && filtered.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 max-h-48 overflow-y-auto">
                {filtered.map(c => (
                  <li key={c}>
                    <button type="button" onClick={() => add(c)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60">{c}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.map(c => (
              <span key={c} className="badge inline-flex items-center gap-1">
                {c}
                <button type="button" onClick={() => remove(c)} className="text-zinc-400 hover:text-red-500 ml-0.5">✕</button>
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

  const totalYears = useMemo(() => {
    try {
      const sum = experiences.reduce((acc, e) => {
        const start = e.startDate ? new Date(`${e.startDate}-01`) : null;
        const end = e.isCurrent || !e.endDate ? new Date() : new Date(`${e.endDate}-01`);
        if (!start || isNaN(start.getTime()) || isNaN(end.getTime())) return acc;
        return acc + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      }, 0);
      return Math.round(sum * 10) / 10;
    } catch { return initialTotalYears; }
  }, [experiences, initialTotalYears]);

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
            Hemos importado el CV que creaste en el constructor. Ya está guardado en tu perfil.
          </div>
        )}
        {appliedMsg && (
          <div className={`border text-sm rounded-xl px-3 py-2 ${
            appliedMsg.tone === "emerald"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
          }`}>
            {appliedMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-8 space-y-6">
            <SectionPersonal user={user} onChange={setUser} />
            <SectionExperience
              experiences={experiences}
              onChange={setExperiences}
              totalYears={totalYears}
              appCount={applications.length}
            />
            <SectionEducation education={education} onChange={setEducation} />

            <section className={CARD} id="postulaciones">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Mis postulaciones</h2>
              {applications.length === 0 ? (
                <div className="soft-panel p-4 flex items-center justify-between">
                  <p className="text-sm text-muted">Aún no has postulado.</p>
                  <Link href="/jobs" className="btn-ghost text-xs whitespace-nowrap shrink-0">Buscar vacantes</Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {applications.map(a => (
                    <li key={a.id} className="soft-panel p-3">
                      <p className="text-sm font-medium">{a.jobTitle} — {a.companyName}</p>
                      <p className="text-xs text-muted">{fromNowSimple(a.createdAt)}</p>
                      <div className="mt-2">
                        <a href={`/jobs/${a.jobId}`} className="btn-ghost text-xs whitespace-nowrap">Ver vacante</a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <section className={CARD}>
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">CV</h2>
              {user.resumeUrl ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100 flex-1">CV disponible</p>
                      <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">✓ Activo</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
                    <iframe src={`${user.resumeUrl}#toolbar=0&navpanes=0&scrollbar=1`} className="w-full h-[400px]" title="Vista previa del CV" />
                  </div>
                  <a href={user.resumeUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir en nueva pestaña
                  </a>
                  <Link href="/cv/builder"
                    className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
                    Editar en CV Builder
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Sin CV</h3>
                    <p className="mt-1 text-xs text-zinc-500">Crea tu currículum profesional</p>
                  </div>
                  <Link href="/cv/builder"
                    className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
                    Crear CV en CV Builder
                  </Link>
                </div>
              )}
            </section>

            <SectionSkills skills={skills} onChange={setSkills} skillTermOptions={skillTermOptions} />
            <SectionLanguages languages={languages} onChange={setLanguages} languageOptions={languageOptions} />
            <SectionCertifications certifications={user.certifications} certOptions={certOptions}
              onChange={certs => setUser(u => ({ ...u, certifications: certs }))} />
          </aside>
        </div>

        <div className="flex items-center gap-4 mt-6">
          <a href="/jobs" className="text-sm text-blue-600 hover:underline dark:text-blue-400">← Buscar vacantes</a>
        </div>
      </div>
    </main>
  );
}