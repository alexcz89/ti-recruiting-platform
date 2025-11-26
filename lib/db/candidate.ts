// lib/db/candidate.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import type { ResumePayload } from "@/types/resume";

export async function upsertCandidateResume(
  prisma: PrismaClient,
  userId: string,
  payload: ResumePayload
) {
  return prisma.$transaction(async (tx) => {
    // ─────────────────────────────────────────────
    // 1) Datos básicos (tolerante a cualquier shape)
    // ─────────────────────────────────────────────
    const basics: any =
      (payload as any).basics ??
      (payload as any).personal ??
      {};

    const loc: any =
      basics.location ??
      (payload as any).location ??
      {};

    // Bloque educación (puede venir en distintos shapes)
    const eduBlock: any = (payload as any).education ?? {};

    // highestLevel puede venir como propiedad directa o inferirse de items
    const highestLevel =
      typeof eduBlock.highestLevel === "string"
        ? eduBlock.highestLevel
        : Array.isArray(eduBlock.items)
        ? (eduBlock.items.find((e: any) => e.level)?.level ?? undefined)
        : undefined;

    // Meta (por ejemplo, resumeUrl) también tolerante
    const meta: any =
      (payload as any).meta ??
      {};

    await tx.user.update({
      where: { id: userId },
      data: {
        name:
          typeof basics.name === "string"
            ? basics.name.trim()
            : undefined,
        phone:
          typeof basics.phone === "string"
            ? basics.phone.trim()
            : undefined,
        linkedin:
          typeof basics.linkedin === "string"
            ? basics.linkedin.trim()
            : undefined,
        github:
          typeof basics.github === "string"
            ? basics.github.trim()
            : undefined,

        // Ubicación desglosada
        location:
          typeof loc.label === "string"
            ? loc.label
            : typeof loc.location === "string"
            ? loc.location
            : undefined,
        country: loc.country ?? undefined,
        admin1: loc.admin1 ?? undefined,
        city: loc.city ?? undefined,
        cityNorm: loc.cityNorm ?? undefined,
        admin1Norm: loc.admin1Norm ?? undefined,
        locationLat:
          typeof loc.lat === "number" ? loc.lat : undefined,
        locationLng:
          typeof loc.lng === "number" ? loc.lng : undefined,

        // Educación + CV
        highestEducationLevel: highestLevel,
        resumeUrl:
          typeof meta.resumeUrl === "string"
            ? meta.resumeUrl
            : undefined,
      },
    });

    // ─────────────────────────────────────────────
    // 2) EXPERIENCIA: full replace
    // ─────────────────────────────────────────────
    await tx.workExperience.deleteMany({ where: { userId } });

    if (payload.experiences?.length) {
      await tx.workExperience.createMany({
        data: payload.experiences.map((e) => {
          const start = e.startDate ? new Date(e.startDate as any) : new Date();
          const end = e.endDate ? new Date(e.endDate as any) : null;

          return {
            userId,
            role: e.role,
            company: e.company,
            startDate: start,
            endDate: end,
            isCurrent: !!e.isCurrent,
          };
        }),
      });
    }

    // ─────────────────────────────────────────────
    // 3) EDUCATION: full replace
    // ─────────────────────────────────────────────
    await tx.education.deleteMany({ where: { userId } });

    const eduItems: any[] = Array.isArray(eduBlock.items)
      ? eduBlock.items
      : [];

    if (eduItems.length) {
      await tx.education.createMany({
        data: eduItems.map((ed, idx) => ({
          userId,
          level: ed.level ?? null,
          status: ed.status,
          institution: ed.institution,
          program: ed.program || null,
          country: ed.country || null,
          city: ed.city || null,
          startDate: ed.startDate ? new Date(ed.startDate as any) : null,
          endDate: ed.endDate ? new Date(ed.endDate as any) : null,
          grade: ed.grade || null,
          description: ed.description || null,
          sortIndex:
            typeof ed.sortIndex === "number" ? ed.sortIndex : idx,
        })),
      });
    }

    // ─────────────────────────────────────────────
    // Helpers para TaxonomyTerm
    // ─────────────────────────────────────────────
    async function ensureTerm(kind: TaxonomyKind, label: string) {
      const slug = slugify(label);
      const existing = await tx.taxonomyTerm.findFirst({
        where: { kind, slug },
        select: { id: true },
      });
      if (existing) return existing.id;
      const created = await tx.taxonomyTerm.create({
        data: { kind, slug, label, aliases: [] },
        select: { id: true },
      });
      return created.id;
    }

    // ─────────────────────────────────────────────
    // 4) SKILLS
    // ─────────────────────────────────────────────
    await tx.candidateSkill.deleteMany({ where: { userId } });

    if (payload.skills?.length) {
      for (const s of payload.skills) {
        const sAny = s as any;
        const maybeTermId = sAny.termId as string | undefined;

        const termId =
          typeof maybeTermId === "string" && maybeTermId
            ? maybeTermId
            : await ensureTerm(TaxonomyKind.SKILL, s.name);

        await tx.candidateSkill.create({
          data: {
            userId,
            termId,
            level: s.level ?? null,
            years: s.years ?? null,
          },
        });
      }
    }

    // ─────────────────────────────────────────────
    // 5) IDIOMAS
    // ─────────────────────────────────────────────
    await tx.candidateLanguage.deleteMany({ where: { userId } });

    if (payload.languages?.length) {
      for (const lang of payload.languages) {
        const langAny = lang as any;
        const maybeTermId = langAny.termId as string | undefined;

        const termId =
          typeof maybeTermId === "string" && maybeTermId
            ? maybeTermId
            : await ensureTerm(TaxonomyKind.LANGUAGE, lang.name);

        await tx.candidateLanguage.create({
          data: { userId, termId, level: lang.level },
        });
      }
    }

    // ─────────────────────────────────────────────
    // 6) CERTIFICACIONES
    // ─────────────────────────────────────────────
    await tx.candidateCredential.deleteMany({ where: { userId } });

    // credentials puede no existir en ResumePayload → pasamos por any
    const credsRaw: any =
      (payload as any).credentials ??
      (payload as any).certifications ??
      [];

    const creds: any[] = Array.isArray(credsRaw) ? credsRaw : [];

    if (creds.length) {
      for (const c of creds) {
        const cAny = c as any;
        const maybeTermId = cAny.termId as string | undefined;

        const termId =
          typeof maybeTermId === "string" && maybeTermId
            ? maybeTermId
            : await ensureTerm(TaxonomyKind.CERTIFICATION, c.name);

        await tx.candidateCredential.create({
          data: {
            userId,
            termId,
            issuer: c.issuer || null,
            issuedAt: c.issuedAt ? new Date(c.issuedAt as any) : null,
            expiresAt: c.expiresAt ? new Date(c.expiresAt as any) : null,
            credentialId: c.credentialId || null,
            url: c.url || null,
          },
        });
      }
    }

    return { ok: true };
  });
}

// ─────────────────────────────────────────────
// util básico para slug
// ─────────────────────────────────────────────
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
