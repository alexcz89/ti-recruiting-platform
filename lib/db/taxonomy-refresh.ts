// lib/db/taxonomy-refresh.ts
//
// Sincronización NO destructiva del catálogo de TaxonomyTerm.
// Antes, los scripts de refresh hacían deleteMany por kind y re-insertaban:
// como CandidateSkill, JobRequiredSkill, CandidateBadge, etc. tienen
// onDelete: Cascade hacia TaxonomyTerm, eso borraba en cascada los skills de
// candidatos, requisitos de vacantes y badges ganados, y cambiaba los ids de
// todos los términos. Este helper hace upsert por [kind, slug] y solo borra
// términos fuera de catálogo cuando no tienen ninguna relación.

import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { slugifyTaxonomyLabel } from "@/lib/shared/slugify-taxonomy";

export interface RefreshTaxonomyResult {
  total: number;
  deletedUnlisted: number;
  keptUnlisted: number;
}

export async function refreshTaxonomyKind(
  prisma: PrismaClient,
  kind: TaxonomyKind,
  labels: readonly string[],
  { cleanUnlisted = false }: { cleanUnlisted?: boolean } = {}
): Promise<RefreshTaxonomyResult> {
  // El catálogo puede repetir un label en varias categorías (ej. "Next.js"
  // aparece en frontend y en static-site generators): dedupe por slug.
  const bySlug = new Map<string, string>();
  for (const label of labels) {
    const slug = slugifyTaxonomyLabel(label);
    if (!bySlug.has(slug)) bySlug.set(slug, label);
  }

  for (const [slug, label] of bySlug) {
    await prisma.taxonomyTerm.upsert({
      where: { kind_slug: { kind, slug } },
      create: { kind, slug, label, aliases: [] },
      update: { label },
    });
  }

  let deletedUnlisted = 0;
  let keptUnlisted = 0;

  if (cleanUnlisted) {
    const unlisted = await prisma.taxonomyTerm.findMany({
      where: { kind, slug: { notIn: Array.from(bySlug.keys()) } },
      select: {
        id: true,
        slug: true,
        _count: {
          select: {
            candidateSkills: true,
            candidateLangs: true,
            candidateCreds: true,
            requiredByJobs: true,
            badgeExams: true,
            candidateBadges: true,
          },
        },
      },
    });

    const deletable = unlisted.filter((t) =>
      Object.values(t._count).every((n) => n === 0)
    );
    keptUnlisted = unlisted.length - deletable.length;

    if (deletable.length) {
      await prisma.taxonomyTerm.deleteMany({
        where: { id: { in: deletable.map((t) => t.id) } },
      });
      deletedUnlisted = deletable.length;
      console.log(
        `🧹 ${kind}: ${deletable.length} término(s) fuera de catálogo y sin relaciones eliminados: ${deletable
          .slice(0, 20)
          .map((t) => t.slug)
          .join(", ")}${deletable.length > 20 ? ", …" : ""}`
      );
    }
    if (keptUnlisted) {
      console.log(
        `⚠️  ${kind}: ${keptUnlisted} término(s) fuera de catálogo se conservan porque tienen relaciones (skills de candidatos, badges, vacantes...)`
      );
    }
  }

  const total = await prisma.taxonomyTerm.count({ where: { kind } });
  return { total, deletedUnlisted, keptUnlisted };
}
