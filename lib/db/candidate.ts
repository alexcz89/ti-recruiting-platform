// lib/db/candidate.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import type { ResumePayload } from "@/types/resume";

export async function upsertCandidateResume(
  prisma: PrismaClient,
  userId: string,
  payload: ResumePayload
) {
  return prisma.$transaction(async (tx) => {
    // 1) Datos básicos del usuario
    await tx.user.update({
      where: { id: userId },
      data: {
        name: payload.basics.name?.trim() || undefined,
        phone: payload.basics.phone?.trim() || undefined,
        linkedin: payload.basics.linkedin?.trim() || undefined,
        github: payload.basics.github?.trim() || undefined,
        location: payload.basics.location?.label || undefined,
        country: payload.basics.location?.country || undefined,
        admin1: payload.basics.location?.admin1 || undefined,
        city: payload.basics.location?.city || undefined,
        cityNorm: payload.basics.location?.cityNorm || undefined,
        admin1Norm: payload.basics.location?.admin1Norm || undefined,
        locationLat:
          typeof payload.basics.location?.lat === "number"
            ? payload.basics.location.lat
            : undefined,
        locationLng:
          typeof payload.basics.location?.lng === "number"
            ? payload.basics.location.lng
            : undefined,
        highestEducationLevel: payload.education?.highestLevel || undefined,
        resumeUrl: payload.meta?.resumeUrl || undefined,
      },
    });

    // 2) WorkExperience: full replace
    await tx.workExperience.deleteMany({ where: { userId } });
    if (payload.experiences?.length) {
      await tx.workExperience.createMany({
        data: payload.experiences.map((e, idx) => ({
          userId,
          role: e.role,
          company: e.company,
          startDate: new Date(e.startDate),
          endDate: e.endDate ? new Date(e.endDate) : null,
          isCurrent: !!e.isCurrent,
          // sortIndex no existe en WorkExperience (si lo quieres, agrégalo al schema)
        })),
      });
    }

    // 3) Education: full replace
    await tx.education.deleteMany({ where: { userId } });
    if (payload.education?.items?.length) {
      await tx.education.createMany({
        data: payload.education.items.map((ed, idx) => ({
          userId,
          level: ed.level ?? null,
          status: ed.status,
          institution: ed.institution,
          program: ed.program || null,
          country: ed.country || null,
          city: ed.city || null,
          startDate: ed.startDate ? new Date(ed.startDate) : null,
          endDate: ed.endDate ? new Date(ed.endDate) : null,
          grade: ed.grade || null,
          description: ed.description || null,
          sortIndex: typeof ed.sortIndex === "number" ? ed.sortIndex : idx,
        })),
      });
    }

    // Helpers para TaxonomyTerm
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

    // 4) CandidateSkill: full replace
    await tx.candidateSkill.deleteMany({ where: { userId } });
    if (payload.skills?.length) {
      for (const s of payload.skills) {
        const termId = s.termId
          ? s.termId
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

    // 5) Idiomas: full replace
    await tx.candidateLanguage.deleteMany({ where: { userId } });
    if (payload.languages?.length) {
      for (const lang of payload.languages) {
        const termId = lang.termId
          ? lang.termId
          : await ensureTerm(TaxonomyKind.LANGUAGE, lang.name);
        await tx.candidateLanguage.create({
          data: { userId, termId, level: lang.level },
        });
      }
    }

    // 6) Certificaciones: full replace
    await tx.candidateCredential.deleteMany({ where: { userId } });
    if (payload.credentials?.length) {
      for (const c of payload.credentials) {
        const termId = c.termId
          ? c.termId
          : await ensureTerm(TaxonomyKind.CERTIFICATION, c.name);
        await tx.candidateCredential.create({
          data: {
            userId,
            termId,
            issuer: c.issuer || null,
            issuedAt: c.issuedAt ? new Date(c.issuedAt) : null,
            expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
            credentialId: c.credentialId || null,
            url: c.url || null,
          },
        });
      }
    }

    return { ok: true };
  });
}

// util básico para slug
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
