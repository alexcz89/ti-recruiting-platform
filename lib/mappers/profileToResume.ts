// lib/mappers/profileToResume.ts

export type ProfileApiResponse = {
  personal: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    birthDate: string; // "YYYY-MM-DD" o ""
    linkedin: string;
    github: string;
  };
  about: string;
  experience: Array<{
    company: string;
    role: string;
    startDate: string; // "YYYY-MM-DD" o ""
    endDate: string;   // "YYYY-MM-DD" o ""
    isCurrent: boolean;
    description?: string | null; // opcional (builder local), NO se persiste en DB
  }>;
  education: Array<{
    institution: string;
    program: string;
    level: string | null;
    status: string | null; // ONGOING | COMPLETED | INCOMPLETE | null
    startDate: string;     // "YYYY-MM-DD" o ""
    endDate: string;       // "YYYY-MM-DD" o ""
  }>;
  skills: Array<{ name: string; level: number | null }>;
  languages: Array<{ name: string; level: string }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    date: string;       // "YYYY-MM-DD" o ""
    expiresAt: string;  // "YYYY-MM-DD" o ""
    url: string | null;
  }>;
};

// ===== Modelo consumido por el PDF/Preview =====
export type ResumeDoc = {
  header: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
  };
  summary?: string;
  experience: Array<{
    title: string;   // role
    company: string;
    period: string;  // "MMM YYYY — MMM YYYY" o "MMM YYYY — Actual"
    description?: string;
  }>;
  education: Array<{
    title: string;   // program o level
    institution: string;
    period: string;
  }>;
  skills: string[];
  languages: string[];   // “Inglés — Profesional”
  certifications: string[];
};

/* =========================
 * Helpers
 * ========================= */
function isValidDateISO(s?: string) {
  if (!s) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function fmtMMMYYYY(iso?: string) {
  if (!isValidDateISO(iso)) return "";
  const d = new Date(iso!);
  // toLocaleDateString capitaliza el mes abreviado en es-MX
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "short" });
}

function fmtPeriod(isoStart?: string, isoEnd?: string, isCurrent?: boolean) {
  const s = fmtMMMYYYY(isoStart);
  const e = isCurrent ? "Actual" : fmtMMMYYYY(isoEnd);
  if (s && e) return `${s} — ${e}`;
  if (s) return s;
  return "";
}

function cleanUrl(u?: string | null) {
  const v = (u || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function labelLang(level?: string | null) {
  const s = String(level || "").toUpperCase();
  if (s === "NATIVE") return "Nativo";
  if (s === "PROFESSIONAL") return "Profesional";
  if (s === "CONVERSATIONAL") return "Conversacional";
  if (s === "BASIC") return "Básico";
  return s || "Conversacional";
}

function dedupeKeepOrder<T>(arr: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item).toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/* =========================
 * Sorting heuristics
 * ========================= */
function toTime(s?: string) {
  return isValidDateISO(s) ? new Date(s!).getTime() : -Infinity;
}

function sortExperience(a: ProfileApiResponse["experience"][number], b: ProfileApiResponse["experience"][number]) {
  // 1) Vigentes primero
  if (a.isCurrent && !b.isCurrent) return -1;
  if (!a.isCurrent && b.isCurrent) return 1;
  // 2) Luego por startDate desc
  const at = toTime(a.startDate);
  const bt = toTime(b.startDate);
  return bt - at;
}

function sortEducation(a: ProfileApiResponse["education"][number], b: ProfileApiResponse["education"][number]) {
  // 1) Por endDate desc si existe
  const ae = toTime(a.endDate);
  const be = toTime(b.endDate);
  if (ae !== be) return be - ae;
  // 2) Luego por startDate desc
  const as = toTime(a.startDate);
  const bs = toTime(b.startDate);
  return bs - as;
}

/* =========================
 * Mapper principal
 * ========================= */
export function profileToResume(data: ProfileApiResponse): ResumeDoc {
  const header = {
    name: data.personal.fullName || "",
    email: data.personal.email || undefined,
    phone: data.personal.phone || undefined,
    location: data.personal.location || undefined,
    linkedin: cleanUrl(data.personal.linkedin) || undefined,
    github: cleanUrl(data.personal.github) || undefined,
  };

  // Ordena experiencia para presentación
  const experienceSorted = [...(data.experience || [])].sort(sortExperience);

  const experience = experienceSorted.map((w) => ({
    title: w.role || "",
    company: w.company || "",
    period: fmtPeriod(w.startDate, w.endDate, w.isCurrent),
    // Si viene (builder en memoria), se respeta; en DB no se guarda.
    description: (w as any)?.description || "",
  }));

  // Ordena educación (más reciente primero)
  const educationSorted = [...(data.education || [])].sort(sortEducation);

  const education = educationSorted.map((e) => ({
    title: e.program || (e.level || "") || "",
    institution: e.institution || "",
    period: fmtPeriod(
      e.startDate,
      e.endDate,
      String(e.status || "").toUpperCase() === "ONGOING"
    ),
  }));

  // Skills: dedupe + recorte (máx 30)
  const skills = dedupeKeepOrder(
    (data.skills || []).map((s) => s.name).filter(Boolean),
    (s) => s
  ).slice(0, 30);

  // Idiomas: “Nombre — Nivel”, dedupe + recorte (máx 10)
  const languages = dedupeKeepOrder(
    (data.languages || [])
      .map((l) => `${l.name} — ${labelLang(l.level)}`)
      .filter(Boolean),
    (s) => s
  ).slice(0, 10);

  // Certificaciones: “Nombre · Emisor (Año)”, dedupe + recorte (máx 15)
  const certificationsRaw = (data.certifications || []).map((c) => {
    const year = isValidDateISO(c.date) ? new Date(c.date).getFullYear() : "";
    const label = c.issuer ? `${c.name} · ${c.issuer}` : c.name;
    return year ? `${label} (${year})` : label;
  }).filter(Boolean);

  const certifications = dedupeKeepOrder(certificationsRaw, (s) => s).slice(0, 15);

  return {
    header,
    summary: data.about || "",
    experience,
    education,
    skills,
    languages,
    certifications,
  };
}
