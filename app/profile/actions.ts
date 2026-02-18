// app/profile/actions.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { geocodeCityToPoint } from "@/lib/geo";

function val(fd: FormData, k: string) {
  if (!fd.has(k)) return undefined;
  const v = fd.get(k);
  if (v === null) return "";
  const s = String(v).trim();
  return s.length ? s : "";
}

/* ─── Experiencias helpers ─── */
type ExpInput = { role: string; company: string; startDate: string; endDate?: string | null; isCurrent?: boolean; };
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
function toISODateFromYM(s?: string | null): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  if (YM_RE.test(t)) return `${t}-01`;
  return t;
}
function parseAndValidateExperiences(json?: string | null):
  | { ok: true; data: { role: string; company: string; startDate: Date; endDate: Date | null; isCurrent: boolean; }[] }
  | { ok: false; error: string } {
  if (!json) return { ok: true, data: [] };
  let list: ExpInput[];
  try {
    list = JSON.parse(json);
    if (!Array.isArray(list)) return { ok: false, error: "Formato inválido de experiencias." };
  } catch {
    return { ok: false, error: "No se pudo leer experiencias (JSON inválido)." };
  }
  const parsed = list.map((e, i) => {
    const role = String(e.role ?? "").trim();
    const company = String(e.company ?? "").trim();
    if (role.length < 2) throw new Error(`Experiencia #${i + 1}: rol/posición requerido.`);
    if (company.length < 2) throw new Error(`Experiencia #${i + 1}: empresa requerida.`);
    const sIso = toISODateFromYM(e.startDate);
    const sd = sIso ? new Date(sIso) : new Date("");
    if (Number.isNaN(sd.getTime())) throw new Error(`Experiencia #${i + 1}: fecha inicio inválida.`);
    const eIso = toISODateFromYM(e.endDate ?? "");
    let ed: Date | null = null;
    if (eIso) {
      const d = new Date(eIso);
      if (Number.isNaN(d.getTime())) throw new Error(`Experiencia #${i + 1}: fecha fin inválida.`);
      ed = d;
    }
    const isCurrent = Boolean(e.isCurrent);
    if (isCurrent && ed) throw new Error(`Experiencia #${i + 1}: si es "Actual", no debe tener fecha fin.`);
    if (!isCurrent && ed && sd > ed) throw new Error(`Experiencia #${i + 1}: inicio no puede ser posterior al fin.`);
    return { role, company, startDate: sd, endDate: ed, isCurrent };
  });

  const currents = parsed.filter((e) => e.isCurrent);
  if (currents.length > 1) return { ok: false, error: "Solo una experiencia puede estar marcada como 'Actual'." };
  if (currents.length === 1) {
    const current = currents[0];
    const mostRecent = [...parsed].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
    if (mostRecent !== current) return { ok: false, error: "La experiencia 'Actual' debe ser la más reciente." };
    if (current.endDate) return { ok: false, error: "La experiencia 'Actual' no debe tener fecha fin." };
  }

  const intervals = parsed.map((e) => ({ start: e.startDate.getTime(), end: e.endDate ? e.endDate.getTime() : Number.POSITIVE_INFINITY }));
  intervals.sort((a, b) => a.start - b.start);
  for (let i = 1; i < intervals.length; i++) if (intervals[i - 1].end > intervals[i].start) return { ok: false, error: "Las fechas de experiencias no pueden traslaparse." };
  const ordered = parsed.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return { ok: true, data: ordered };
}

/* ─── Idiomas ─── */
type LanguageInput = { termId?: string | null; label?: string | null; level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC"; };
const ALLOWED_LEVELS_LANG = new Set(["NATIVE", "PROFESSIONAL", "CONVERSATIONAL", "BASIC"] as const);
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
function parseLanguages(json?: string | null):
  | { ok: true; data: Array<{ termId?: string; label?: string; slug?: string; level: LanguageInput["level"] }> }
  | { ok: false; error: string } {
  if (!json) return { ok: true, data: [] };
  let list: any;
  try {
    list = JSON.parse(json);
    if (!Array.isArray(list)) return { ok: false, error: "Formato inválido de idiomas." };
  } catch {
    return { ok: false, error: "No se pudo leer idiomas (JSON inválido)." };
  }
  const out: Array<{ termId?: string; label?: string; slug?: string; level: LanguageInput["level"] }> = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const termId = typeof raw?.termId === "string" && raw.termId.trim() ? String(raw.termId) : undefined;
    const label = typeof raw?.label === "string" && raw.label.trim() ? String(raw.label).trim() : undefined;
    const level = String(raw?.level ?? "").toUpperCase();
    if (!ALLOWED_LEVELS_LANG.has(level as any)) return { ok: false, error: `Nivel de idioma inválido: ${raw?.level ?? ""}` };
    if (!termId && !label) continue;
    const slug = label ? slugify(label) : undefined;
    const key = termId ? `id:${termId}` : `slug:${slug}`;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push({ termId, label, slug, level: level as any });
  }
  return { ok: true, data: out };
}

/* ─── Skills con nivel ─── */
type SkillInput = { termId?: string | null; label?: string | null; level: number };
function parseSkillsDetailed(json?: string | null):
  | { ok: true; data: Array<{ termId?: string; label?: string; level: number }> }
  | { ok: false; error: string } {
  if (!json) return { ok: true, data: [] };
  let list: any;
  try {
    list = JSON.parse(json);
    if (!Array.isArray(list)) return { ok: false, error: "Formato inválido de skills." };
  } catch {
    return { ok: false, error: "No se pudo leer skills (JSON inválido)." };
  }
  const out: Array<{ termId?: string; label?: string; level: number }> = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const termId = typeof raw?.termId === "string" && raw.termId.trim() ? String(raw.termId) : undefined;
    const label = typeof raw?.label === "string" && raw.label.trim() ? String(raw.label).trim() : undefined;
    const level = Number(raw?.level);
    if (!level || level < 1 || level > 5) return { ok: false, error: `Nivel de skill inválido: ${raw?.level}` };
    if (!termId && !label) continue;
    const key = termId ? `id:${termId}` : `lb:${label!.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ termId, label, level });
  }
  return { ok: true, data: out };
}

/* ─── Educación ─── */
type EducationRow = {
  id?: string;
  level: "HIGH_SCHOOL" | "TECHNICAL" | "BACHELOR" | "MASTER" | "DOCTORATE" | "OTHER" | null;
  institution: string;
  program?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sortIndex: number;
};

function ymToDate(s?: string | null): Date | null {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(str);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  // ✅ Ancla al MEDIODÍA UTC para evitar desfase de zona horaria
  const d = new Date(Date.UTC(yyyy, mm - 1, 1, 12, 0, 0));
  return isNaN(d.getTime()) ? null : d;
}

function parseEducation(json?: string | null):
  | { ok: true; data: Array<{
      level: EducationRow["level"];
      status: "ONGOING" | "COMPLETED";
      institution: string;
      program: string | null;
      startDate: Date | null;
      endDate: Date | null;
      sortIndex: number;
    }> }
  | { ok: false; error: string } {
  if (!json) return { ok: true, data: [] };
  let list: any[];
  try {
    list = JSON.parse(json);
    if (!Array.isArray(list)) return { ok: false, error: "Formato inválido de educación." };
  } catch {
    return { ok: false, error: "No se pudo leer educación (JSON inválido)." };
  }

  const out: Array<{
    level: EducationRow["level"];
    status: "ONGOING" | "COMPLETED";
    institution: string;
    program: string | null;
    startDate: Date | null;
    endDate: Date | null;
    sortIndex: number;
  }> = [];

  list.forEach((r, i) => {
    const level = (r?.level ?? null) as EducationRow["level"];
    const institution = String(r?.institution ?? "").trim();
    const program = r?.program ? String(r.program).trim() : null;
    const start = ymToDate(r?.startDate ?? "");
    const endRaw = String(r?.endDate ?? "").trim();
    const end = endRaw ? ymToDate(endRaw) : null;
    const status: "ONGOING" | "COMPLETED" = end ? "COMPLETED" : "ONGOING";
    const sortIndex = Number.isFinite(r?.sortIndex) ? Number(r.sortIndex) : i;

    if (!institution && !level && !start && !end) return;
    if (start && end && start.getTime() > end.getTime()) return;

    out.push({ level, status, institution, program, startDate: start, endDate: end, sortIndex });
  });

  return { ok: true, data: out.sort((a, b) => a.sortIndex - b.sortIndex) };
}

/* ─── Helpers ubicación ─── */
function stripDiacritics(s: string) {
  return (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export async function updateProfileAction(fd: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { error: "No autenticado" };

    const me = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true, role: true, resumeUrl: true },
    });
    if (!me) return { error: "Usuario no encontrado" };
    if (me.role !== "CANDIDATE") return { error: "Solo candidatos pueden editar perfil" };

    // ✅ BUG FIX #2: Guardar firstName, lastName, maternalSurname por separado
    const firstName = String(val(fd, "firstName") ?? "").trim();
    const lastName1 = String(val(fd, "lastName1") ?? "").trim();
    const lastName2 = String(val(fd, "lastName2") ?? "").trim();
    if (!firstName || !lastName1) return { error: "Nombre y Apellido paterno son obligatorios." };
    const fullName = [firstName, lastName1, lastName2].filter(Boolean).join(" ");

    // Teléfono
    const phone = (() => {
      const p = val(fd, "phone");
      if (typeof p === "undefined") return undefined;
      if (p === "") return null;
      if (!/^\+\d{7,15}$/.test(String(p))) return "INVALID" as any;
      return String(p);
    })();
    if (phone === ("INVALID" as any)) return { error: "El teléfono no tiene formato internacional válido (E.164)." };

    // ✅ BUG FIX #1: Birthdate con mediodía UTC para evitar desfase de zona horaria
    let safeBirthdate: Date | null | undefined = undefined;
    if (fd.has("birthdate")) {
      const raw = String(fd.get("birthdate") ?? "").trim();
      if (!raw) {
        safeBirthdate = null;
      } else {
        // "2000-12-16" → Date.UTC(2000, 11, 16, 12, 0, 0) para evitar UTC-6 desfase
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
        if (m) {
          const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
          safeBirthdate = isNaN(d.getTime()) ? null : d;
        } else {
          safeBirthdate = null;
        }
      }
    }

    // Ubicación + geocoding
    const location = val(fd, "location");
    let locationLat: number | null | undefined = undefined;
    let locationLng: number | null | undefined = undefined;

    // Campos de ubicación desglosada desde el form
    const cityFromForm   = val(fd, "city")      ?? undefined;
    const admin1FromForm = val(fd, "admin1")     ?? undefined;
    const countryCode    = val(fd, "countryCode") ?? undefined;
    const cityNorm       = val(fd, "cityNorm")   ?? undefined;
    const admin1Norm     = val(fd, "admin1Norm") ?? undefined;

    if (typeof location !== "undefined") {
      if (location) {
        // Si no vienen del form (usuario escribió manual), intentar geocodificar
        if (!cityFromForm) {
          const pt = await geocodeCityToPoint(location);
          locationLat = pt?.lat ?? null;
          locationLng = pt?.lng ?? null;
        } else {
          // Vienen del autocomplete, usar coords si están disponibles
          const pt = await geocodeCityToPoint(location);
          locationLat = pt?.lat ?? null;
          locationLng = pt?.lng ?? null;
        }
      } else {
        locationLat = null;
        locationLng = null;
      }
    }

    // Links / CV
    const linkedin = val(fd, "linkedin");
    const github   = val(fd, "github");

    // ✅ BUG FIX #3: resumeUrl - preferir el nuevo upload, caer al existente
    let resumeUrl: string | null | undefined = undefined;
    if (fd.has("resumeUrl")) {
      const newUrl = String(fd.get("resumeUrl") ?? "").trim();
      resumeUrl = newUrl || me.resumeUrl || null;
    }

    // Certs
    const certsCsv = val(fd, "certifications");
    const certifications =
      typeof certsCsv === "string" && certsCsv.length
        ? certsCsv.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

    // Experiencias
    const expsRaw  = val(fd, "experiences");
    const parsed   = parseAndValidateExperiences(expsRaw ?? "");
    if (!parsed.ok) return { error: parsed.error };

    // Idiomas
    const langsRaw   = val(fd, "languages");
    const parsedLangs = parseLanguages(langsRaw ?? "");
    if (!parsedLangs.ok) return { error: parsedLangs.error };
    const languageItems = parsedLangs.data;

    // Skills con nivel
    const skillsRaw    = val(fd, "skillsDetailed");
    const parsedSkills = parseSkillsDetailed(skillsRaw ?? "");
    if (!parsedSkills.ok) return { error: parsedSkills.error };
    const skillItems = parsedSkills.data;

    // Educación
    const eduRaw =
      val(fd, "educationJson") ??
      val(fd, "educations") ??
      val(fd, "education");
    const parsedEdu = parseEducation(eduRaw ?? "");
    if (!parsedEdu.ok) return { error: parsedEdu.error };
    const educationItems = parsedEdu.data;

    // Resolver idiomas
    type ResolvedLang = { termId: string; level: LanguageInput["level"] };
    let resolvedLangs: ResolvedLang[] = [];
    if (languageItems.length) {
      const ids   = Array.from(new Set(languageItems.map((l) => l.termId).filter(Boolean))) as string[];
      const slugs = Array.from(new Set(languageItems.map((l) => l.label ? slugify(l.label) : undefined).filter(Boolean))) as string[];
      const terms = await prisma.taxonomyTerm.findMany({
        where: { kind: "LANGUAGE", OR: [ids.length ? { id: { in: ids } } : undefined, slugs.length ? { slug: { in: slugs } } : undefined].filter(Boolean) as any },
        select: { id: true, slug: true, label: true },
      });
      const byId   = new Map(terms.map((t) => [t.id, t]));
      const bySlug = new Map(terms.map((t) => [t.slug, t]));
      for (const it of languageItems) {
        if (it.termId) {
          const t = byId.get(it.termId); if (!t) return { error: `Idioma inválido (id: ${it.termId})` };
          resolvedLangs.push({ termId: t.id, level: it.level });
        } else if (it.label) {
          const t = bySlug.get(slugify(it.label)); if (!t) return { error: `Idioma inválido (${it.label})` };
          resolvedLangs.push({ termId: t.id, level: it.level });
        }
      }
      const lastByTerm = new Map<string, LanguageInput["level"]>();
      resolvedLangs.forEach((r) => lastByTerm.set(r.termId, r.level));
      resolvedLangs = Array.from(lastByTerm.entries()).map(([termId, level]) => ({ termId, level }));
    }

    // Resolver skills
    type ResolvedSkill = { termId: string; level: number };
    let resolvedSkills: ResolvedSkill[] = [];
    if (skillItems.length) {
      const ids    = Array.from(new Set(skillItems.map((s) => s.termId).filter(Boolean))) as string[];
      const labels = Array.from(new Set(skillItems.map((s) => s.label?.toLowerCase()).filter(Boolean))) as string[];
      const terms  = await prisma.taxonomyTerm.findMany({
        where: {
          kind: "SKILL",
          OR: [
            ids.length    ? { id:    { in: ids }                     } : undefined,
            labels.length ? { label: { in: labels.map((l) => l!) } } : undefined,
          ].filter(Boolean) as any,
        },
        select: { id: true, label: true },
      });
      const byId    = new Map(terms.map((t) => [t.id, t]));
      const byLabel = new Map(terms.map((t) => [t.label.toLowerCase(), t]));
      for (const it of skillItems) {
        if (it.termId) {
          const t = byId.get(it.termId); if (!t) return { error: `Skill inválido (id: ${it.termId})` };
          resolvedSkills.push({ termId: t.id, level: it.level });
        } else if (it.label) {
          const t = byLabel.get(it.label.toLowerCase()); if (!t) return { error: `Skill inválido (${it.label})` };
          resolvedSkills.push({ termId: t.id, level: it.level });
        }
      }
      const lastByTerm = new Map<string, number>();
      resolvedSkills.forEach((r) => lastByTerm.set(r.termId, r.level));
      resolvedSkills = Array.from(lastByTerm.entries()).map(([termId, level]) => ({ termId, level }));
    }

    // ✅ Build update con campos separados del schema nuevo
    const data: any = {
      name:                fullName,
      firstName:           firstName,
      lastName:            lastName1,
      maternalSurname:     lastName2 || null,
      // ✅ Timestamp de última actualización de perfil
      profileLastUpdated:  new Date(),
    };

    if (typeof phone             !== "undefined") data.phone         = phone;
    if (typeof safeBirthdate     !== "undefined") data.birthdate     = safeBirthdate;
    if (typeof location          !== "undefined") data.location      = location;
    if (typeof locationLat       !== "undefined") data.locationLat   = locationLat;
    if (typeof locationLng       !== "undefined") data.locationLng   = locationLng;
    if (typeof linkedin          !== "undefined") data.linkedin      = linkedin;
    if (typeof github            !== "undefined") data.github        = github;
    if (typeof resumeUrl         !== "undefined") data.resumeUrl     = resumeUrl;
    if (typeof certifications    !== "undefined") data.certifications = certifications;

    // Ubicación desglosada
    if (cityFromForm   !== undefined) { data.city      = cityFromForm;   data.cityNorm  = stripDiacritics(cityFromForm); }
    if (admin1FromForm !== undefined) { data.admin1     = admin1FromForm; data.admin1Norm = stripDiacritics(admin1FromForm); }
    if (countryCode    !== undefined) { data.country   = countryCode; }
    if (cityNorm       !== undefined)   data.cityNorm  = cityNorm;
    if (admin1Norm     !== undefined)   data.admin1Norm = admin1Norm;

    // Persistir
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: me.id }, data });

      // Experiencias
      await tx.workExperience.deleteMany({ where: { userId: me.id } });
      if (parsed.data.length) {
        await tx.workExperience.createMany({
          data: parsed.data.map((e) => ({
            userId: me.id, role: e.role, company: e.company,
            startDate: e.startDate, endDate: e.endDate, isCurrent: e.isCurrent,
          })),
        });
      }

      // Idiomas
      await tx.candidateLanguage.deleteMany({ where: { userId: me.id } });
      if (resolvedLangs.length) {
        await tx.candidateLanguage.createMany({
          data: resolvedLangs.map((r) => ({ userId: me.id, termId: r.termId, level: r.level })),
        });
      }

      // ✅ Skills con nivel — se guardan en CandidateSkill, no en User.skills[]
      await tx.candidateSkill.deleteMany({ where: { userId: me.id } });
      if (resolvedSkills.length) {
        await tx.candidateSkill.createMany({
          data: resolvedSkills.map((r) => ({ userId: me.id, termId: r.termId, level: r.level })),
        });
      }

      // Educación
      await tx.education.deleteMany({ where: { userId: me.id } });
      if (educationItems.length) {
        await tx.education.createMany({
          data: educationItems.map((ed) => ({
            userId:      me.id,
            level:       ed.level,
            status:      ed.status,
            institution: ed.institution,
            program:     ed.program,
            startDate:   ed.startDate,
            endDate:     ed.endDate,
            sortIndex:   ed.sortIndex,
          })),
        });
      }
    });

    revalidatePath("/profile/summary");
    redirect("/profile/summary?updated=1");
  } catch (err) {
    if (isRedirectError(err as any)) throw err;
    console.error("[profile:update] error", err);
    return { error: "No se pudo guardar tu perfil. Inténtalo de nuevo." };
  }
}