// lib/forms/adapters.ts
import { ProfileFormData } from "@/lib/shared/schemas/profile";
import { dateToMonth, monthToDate, stripDiacritics } from "@/lib/shared/schemas/common";

/** Defaults para RHF desde DB (centralizado) */
export function toProfileFormDefaultsFromDb(db: any): ProfileFormData {
  return {
    // ───────── Datos personales ─────────
    firstName: db.firstName ?? "",
    lastName1: db.lastName1 ?? "",
    lastName2: db.lastName2 ?? "",
    location: db.location ?? "",
    birthdate: db.birthdate ? new Date(db.birthdate).toISOString().slice(0, 10) : "",
    linkedin: db.linkedin ?? "",
    github: db.github ?? "",
    phoneCountry: db.phoneCountry ?? "52",
    phoneLocal: db.phoneLocal ?? "",

    // ───────── CV / Educación superior ─────────
    resumeUrl: db.resumeUrl ?? "",
    highestEducationLevel: db.highestEducationLevel ?? null,

    // ───────── Educación (lista) ─────────
    education: Array.isArray(db.education)
      ? db.education.map((ed: any) => ({
          level: ed.level ?? null,
          status: ed.status ?? "COMPLETED",
          institution: ed.institution ?? "",
          program: ed.program ?? "",
          country: ed.country ?? "",
          city: ed.city ?? "",
          startDate: dateToMonth(ed.startDate) ?? "",
          endDate: ed.status === "ONGOING" ? "" : dateToMonth(ed.endDate) ?? "",
          grade: ed.grade ?? "",
          description: ed.description ?? "",
          sortIndex: typeof ed.sortIndex === "number" ? ed.sortIndex : 0,
        }))
      : [],

    // ───────── Certificaciones ─────────
    certifications: Array.isArray(db.certifications)
      ? db.certifications
      : [],

    // ───────── Experiencia ─────────
    experiences: Array.isArray(db.experiences)
      ? db.experiences.map((e: any) => ({
          role: e.role ?? "",
          company: e.company ?? "",
          startDate: dateToMonth(e.startDate) ?? "",
          endDate: e.isCurrent ? "" : dateToMonth(e.endDate) ?? "",
          isCurrent: !!e.isCurrent,
        }))
      : [],

    // ───────── Lenguajes ─────────
    languages: Array.isArray(db.languages)
      ? db.languages.map((l: any) => ({
          termId: l.termId,
          label: l.label,
          level: l.level,
        }))
      : [],

    // ───────── Skills ─────────
    skillsDetailed: Array.isArray(db.skillsDetailed)
      ? db.skillsDetailed.map((s: any) => ({
          termId: s.termId,
          label: s.label,
          level: s.level,
        }))
      : [],
  };
}

/** Normalizaciones antes de guardar (client o server) */
export function normalizeProfileBeforeSave(values: ProfileFormData) {
  const phoneLocalDigits = (values.phoneLocal || "").replace(/\D+/g, "");
  return { ...values, phoneLocal: phoneLocalDigits };
}

/** Normaliza texto para índices `cityNorm/admin1Norm` */
export function normalizeGeoParts(p: { city?: string; admin1?: string }) {
  return {
    ...p,
    cityNorm: p.city ? stripDiacritics(p.city) : undefined,
    admin1Norm: p.admin1 ? stripDiacritics(p.admin1) : undefined,
  };
}

/** Convierte las fechas de experiencia a Date (si el server las guarda como Date) */
export function toDbExperienceDates(e: {
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
}) {
  return {
    startDate: monthToDate(e.startDate),
    endDate: e.isCurrent ? null : monthToDate(e.endDate || null),
  };
}
