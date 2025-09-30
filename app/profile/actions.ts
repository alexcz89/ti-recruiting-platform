// app/profile/actions.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
// ⬇️ isRedirectError debe importarse de este path interno en App Router
import { isRedirectError } from "next/dist/client/components/redirect";
import { geocodeCityToPoint } from "@/lib/geo";

/** Mini helper: form.get -> string | "" | undefined */
function val(fd: FormData, k: string) {
  if (!fd.has(k)) return undefined;
  const v = fd.get(k);
  if (v === null) return "";
  const s = String(v).trim();
  return s.length ? s : "";
}

/** Experiencias (input del cliente) */
type ExpInput = {
  role: string;
  company: string;
  startDate: string;      // "YYYY-MM" o "YYYY-MM-DD"
  endDate?: string | null; // "YYYY-MM" | "YYYY-MM-DD" | null | ""
  isCurrent?: boolean;
};

// Normaliza "YYYY-MM" -> "YYYY-MM-01" para parse seguro
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
function toISODateFromYM(s?: string | null): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  if (YM_RE.test(t)) return `${t}-01`;
  return t; // ya viene "YYYY-MM-DD" u otro ISO válido
}

/** Parse/valida formato, fechas y reglas de negocio (sin traslapes, 1 current, etc.) */
function parseAndValidateExperiences(json?: string | null):
  | {
      ok: true;
      data: {
        role: string;
        company: string;
        startDate: Date;
        endDate: Date | null;
        isCurrent: boolean;
      }[];
    }
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

    // Fechas (aceptamos "YYYY-MM" y "YYYY-MM-DD")
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
    if (!isCurrent && ed && sd > ed) {
      throw new Error(`Experiencia #${i + 1}: inicio no puede ser posterior al fin.`);
    }

    return { role, company, startDate: sd, endDate: ed, isCurrent };
  });

  // Reglas globales
  const currents = parsed.filter((e) => e.isCurrent);
  if (currents.length > 1) {
    return { ok: false, error: "Solo una experiencia puede estar marcada como 'Actual'." };
  }

  // La actual (si existe) debe ser la más reciente por startDate
  if (currents.length === 1) {
    const current = currents[0];
    const mostRecent = [...parsed].sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
    if (mostRecent !== current) {
      return { ok: false, error: "La experiencia 'Actual' debe ser la más reciente." };
    }
    if (current.endDate) {
      return { ok: false, error: "La experiencia 'Actual' no debe tener fecha fin." };
    }
  }

  // Validar traslapes: [start, end] con end = +∞ si no tiene fin/actual
  const intervals = parsed.map((e) => ({
    start: e.startDate.getTime(),
    end: e.endDate ? e.endDate.getTime() : Number.POSITIVE_INFINITY,
  }));
  intervals.sort((a, b) => a.start - b.start);
  for (let i = 1; i < intervals.length; i++) {
    const prev = intervals[i - 1];
    const curr = intervals[i];
    if (prev.end > curr.start) {
      return { ok: false, error: "Las fechas de experiencias no pueden traslaparse." };
    }
  }

  // Orden para mostrar (más reciente primero)
  const ordered = parsed.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return { ok: true, data: ordered };
}

/** ────────────────────────────────────────────────────────────────────────────
 * IDIOMAS: parseo y validación ligera del payload de cliente
 * Acepta:
 *  - [{ label: "Inglés", level: "PROFESSIONAL" }, ...]
 *  - [{ termId: "xxx", level: "NATIVE" }, ...]
 * Duplicados por label/termId se consolidan (último gana).
 * ──────────────────────────────────────────────────────────────────────────── */
type LanguageInput = {
  termId?: string | null;
  label?: string | null;
  level: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
};

const ALLOWED_LEVELS = new Set(["NATIVE", "PROFESSIONAL", "CONVERSATIONAL", "BASIC"] as const);

function slugifyLabel(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

    if (!ALLOWED_LEVELS.has(level as any)) {
      return { ok: false, error: `Nivel de idioma inválido: ${raw?.level ?? ""}` };
    }
    if (!termId && !label) continue; // ignoramos entradas vacías

    const key = termId ? `id:${termId}` : `lb:${label!.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      termId,
      label,
      slug: label ? slugifyLabel(label) : undefined,
      level: level as LanguageInput["level"],
    });
  }

  return { ok: true, data: out };
}

export async function updateProfileAction(fd: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { error: "No autenticado" };

    const me = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true, role: true },
    });
    if (!me) return { error: "Usuario no encontrado" };
    if (me.role !== "CANDIDATE") return { error: "Solo candidatos pueden editar perfil" };

    // ---------- Nombre completo ----------
    const firstName = String(val(fd, "firstName") ?? "");
    const lastName1 = String(val(fd, "lastName1") ?? "");
    const lastName2 = String(val(fd, "lastName2") ?? "");
    if (!firstName || !lastName1) return { error: "Nombre y Apellido paterno son obligatorios." };
    const fullName = lastName2 ? `${firstName} ${lastName1} ${lastName2}` : `${firstName} ${lastName1}`;

    // ---------- Teléfono (E.164) ----------
    const phone = (() => {
      const p = val(fd, "phone");
      if (typeof p === "undefined") return undefined;
      if (p === "") return null;
      if (!/^\+\d{7,15}$/.test(String(p))) return "INVALID" as any;
      return String(p);
    })();
    if (phone === ("INVALID" as any))
      return { error: "El teléfono no tiene formato internacional válido (E.164)." };

    // ---------- Birthdate ----------
    let safeBirthdate: Date | null | undefined = undefined;
    if (fd.has("birthdate")) {
      const raw = String(fd.get("birthdate") ?? "");
      if (!raw) safeBirthdate = null;
      else {
        const d = new Date(raw);
        safeBirthdate = Number.isNaN(d.getTime()) ? null : d;
      }
    }

    // ---------- Ubicación + geocoding ----------
    const location = val(fd, "location");
    let locationLat: number | null | undefined = undefined;
    let locationLng: number | null | undefined = undefined;
    if (typeof location !== "undefined") {
      if (location) {
        const pt = await geocodeCityToPoint(location);
        locationLat = pt?.lat ?? null;
        locationLng = pt?.lng ?? null;
      } else {
        locationLat = null;
        locationLng = null;
      }
    }

    // ---------- Links / CV ----------
    const linkedin = val(fd, "linkedin");
    const github = val(fd, "github");
    const resumeUrl = val(fd, "resumeUrl");

    // ---------- Skills / Certs ----------
    const skillsCsv = val(fd, "skills");
    const skills =
      typeof skillsCsv === "string" && skillsCsv.length
        ? skillsCsv.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

    const certsCsv = val(fd, "certifications");
    const certifications =
      typeof certsCsv === "string" && certsCsv.length
        ? certsCsv.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

    // ---------- Experiences (JSON) ----------
    const expsRaw = val(fd, "experiences");
    const parsed = parseAndValidateExperiences(expsRaw ?? "");
    if (!parsed.ok) return { error: parsed.error };

    // ---------- Languages (JSON) ----------
    const langsRaw = val(fd, "languages");
    const parsedLangs = parseLanguages(langsRaw ?? "");
    if (!parsedLangs.ok) return { error: parsedLangs.error };
    const languageItems = parsedLangs.data; // { termId? label? slug? level }

    // ---------- Build update payload ----------
    const data: any = { name: fullName };
    if (typeof phone !== "undefined") data.phone = phone;
    if (typeof safeBirthdate !== "undefined") data.birthdate = safeBirthdate;
    if (typeof location !== "undefined") data.location = location;
    if (typeof locationLat !== "undefined") data.locationLat = locationLat;
    if (typeof locationLng !== "undefined") data.locationLng = locationLng;
    if (typeof linkedin !== "undefined") data.linkedin = linkedin;
    if (typeof github !== "undefined") data.github = github;
    if (typeof resumeUrl !== "undefined") data.resumeUrl = resumeUrl;
    if (typeof skills !== "undefined") data.skills = skills;
    if (typeof certifications !== "undefined") data.certifications = certifications;

    // ---------- Persist: user + experiences + languages (transaction) ----------
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: me.id }, data });

      // EXPERIENCIAS: reemplazo simple
      await tx.workExperience.deleteMany({ where: { userId: me.id } });
      if (parsed.data.length) {
        await tx.workExperience.createMany({
          data: parsed.data.map((e) => ({
            userId: me.id,
            role: e.role,
            company: e.company,
            startDate: e.startDate,
            endDate: e.endDate,
            isCurrent: e.isCurrent,
          })),
        });
      }

      // IDIOMAS: resolver termId por termId o por label/slug; crear si no existe
      // 1) borrar los actuales del candidato
      await tx.candidateLanguage.deleteMany({ where: { userId: me.id } });

      if (languageItems.length) {
        // separar por termId vs label
        const withId = languageItems.filter((l) => !!l.termId) as Array<{ termId: string; level: LanguageInput["level"] }>;
        const withLabel = languageItems.filter((l) => !l.termId && !!l.label && !!l.slug) as Array<{ label: string; slug: string; level: LanguageInput["level"] }>;

        // 2) traer existentes por slug
        const slugs = Array.from(new Set(withLabel.map((l) => l.slug)));
        let existingTerms: { id: string; slug: string }[] = [];
        if (slugs.length) {
          existingTerms = await tx.taxonomyTerm.findMany({
            where: { kind: "LANGUAGE", slug: { in: slugs } },
            select: { id: true, slug: true },
          });
        }
        const existingBySlug = new Map(existingTerms.map((t) => [t.slug, t.id]));

        // 3) crear faltantes
        const missing = withLabel.filter((l) => !existingBySlug.has(l.slug));
        if (missing.length) {
          await tx.taxonomyTerm.createMany({
            data: missing.map((m) => ({
              kind: "LANGUAGE" as const,
              slug: m.slug,
              label: m.label,
              aliases: [],
            })),
            skipDuplicates: true,
          });
          // re-consultar para obtener IDs
          if (slugs.length) {
            const after = await tx.taxonomyTerm.findMany({
              where: { kind: "LANGUAGE", slug: { in: slugs } },
              select: { id: true, slug: true },
            });
            after.forEach((t) => existingBySlug.set(t.slug, t.id));
          }
        }

        // 4) construir payload definitivo de candidateLanguages
        const langsToCreate: Array<{ userId: string; termId: string; level: LanguageInput["level"] }> = [];

        // desde termId directo
        for (const it of withId) {
          langsToCreate.push({ userId: me.id, termId: it.termId, level: it.level });
        }

        // desde label/slug resuelto
        for (const it of withLabel) {
          const tid = existingBySlug.get(it.slug);
          if (tid) langsToCreate.push({ userId: me.id, termId: tid, level: it.level });
        }

        // evitar duplicados por termId (último gana)
        const seenByTerm = new Map<string, LanguageInput["level"]>();
        langsToCreate.forEach((x) => seenByTerm.set(x.termId, x.level));
        const finalCreate = Array.from(seenByTerm.entries()).map(([termId, level]) => ({
          userId: me.id,
          termId,
          level,
        }));

        if (finalCreate.length) {
          await tx.candidateLanguage.createMany({ data: finalCreate });
        }
      }
    });

    revalidatePath("/profile/summary");
    redirect("/profile/summary?updated=1");
  } catch (err) {
    // ⬇️ con este import, esto funciona correctamente
    if (isRedirectError(err as any)) throw err;
    console.error("[profile:update] error", err);
    return { error: "No se pudo guardar tu perfil. Inténtalo de nuevo." };
  }
}
