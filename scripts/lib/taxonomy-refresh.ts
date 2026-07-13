// scripts/lib/taxonomy-refresh.ts
//
// Helpers NO destructivos para mantener el catálogo de TaxonomyTerm.
//
// Nunca uses deleteMany({ where: { kind } }): CandidateSkill, CandidateLanguage,
// CandidateCredential, JobRequiredSkill y CandidateBadge tienen onDelete: Cascade
// hacia TaxonomyTerm, así que un borrado masivo destruye perfiles de candidatos,
// requisitos de vacantes y badges ganados en producción (la BD es Neon, real).

import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { slugifyTaxonomyLabel } from "../../lib/shared/slugify-taxonomy";

const RELATION_COUNTS = {
  candidateSkills: true,
  candidateLangs: true,
  candidateCreds: true,
  requiredByJobs: true,
  badgeExams: true,
  candidateBadges: true,
} as const;

// Cláusula "sin ninguna referencia", evaluada por la BD al momento del delete
// para no borrar un término que ganó referencias entre el reporte y el borrado.
const NO_REFERENCES = {
  candidateSkills: { none: {} },
  candidateLangs: { none: {} },
  candidateCreds: { none: {} },
  requiredByJobs: { none: {} },
  badgeExams: { none: {} },
  candidateBadges: { none: {} },
} as const;

/**
 * Upsert por [kind, slug] de todos los labels del catálogo.
 * Conserva ids existentes (las relaciones no se tocan) y no modifica aliases
 * de términos ya presentes (pueden haberse curado a mano en la BD).
 *
 * Devuelve el Map slug → label de los términos del catálogo (deduplicados).
 */
export async function upsertTaxonomyTerms(
  prisma: PrismaClient,
  kind: TaxonomyKind,
  labels: readonly string[]
): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();
  for (const label of labels) {
    const slug = slugifyTaxonomyLabel(label);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, label);
  }

  for (const [slug, label] of bySlug) {
    await prisma.taxonomyTerm.upsert({
      where: { kind_slug: { kind, slug } },
      create: { kind, slug, label, aliases: [] },
      update: { label },
    });
  }

  return bySlug;
}

export type UnlistedTermInUse = {
  id: string;
  slug: string;
  label: string;
  counts: Record<keyof typeof RELATION_COUNTS, number>;
  totalRefs: number;
};

/**
 * Limpieza segura de términos fuera del catálogo (p.ej. creados en runtime
 * vía ensureTerm y luego descartados):
 *
 * - Sin referencias → se borran.
 * - Con referencias → se reporta cuántas filas dependerían del borrado y se
 *   conservan, salvo forceDelete: true (que sí destruye en cascada).
 */
export async function cleanUnlistedTerms(
  prisma: PrismaClient,
  kind: TaxonomyKind,
  allowedSlugs: ReadonlySet<string>,
  opts: { forceDelete?: boolean } = {}
): Promise<{ orphansDeleted: number; inUse: UnlistedTermInUse[]; forceDeleted: number }> {
  const unlisted = await prisma.taxonomyTerm.findMany({
    where: { kind, slug: { notIn: Array.from(allowedSlugs) } },
    select: {
      id: true,
      slug: true,
      label: true,
      _count: { select: RELATION_COUNTS },
    },
  });

  if (unlisted.length === 0) {
    return { orphansDeleted: 0, inUse: [], forceDeleted: 0 };
  }

  const withTotals = unlisted.map((t) => ({
    id: t.id,
    slug: t.slug,
    label: t.label,
    counts: t._count,
    totalRefs: Object.values(t._count).reduce((a, b) => a + b, 0),
  }));

  const orphans = withTotals.filter((t) => t.totalRefs === 0);
  const inUse = withTotals.filter((t) => t.totalRefs > 0);

  let orphansDeleted = 0;
  if (orphans.length > 0) {
    const res = await prisma.taxonomyTerm.deleteMany({
      where: { id: { in: orphans.map((t) => t.id) }, ...NO_REFERENCES },
    });
    orphansDeleted = res.count;
    console.log(
      `🧹 ${kind}: ${orphansDeleted} término(s) fuera del catálogo y sin referencias eliminados.`
    );
  }

  let forceDeleted = 0;
  if (inUse.length > 0) {
    console.warn(`⚠️  ${kind}: ${inUse.length} término(s) fuera del catálogo pero EN USO:`);
    for (const t of inUse) {
      const detail = Object.entries(t.counts)
        .filter(([, n]) => n > 0)
        .map(([rel, n]) => `${rel}=${n}`)
        .join(", ");
      console.warn(`   - "${t.label}" (${t.slug}): ${detail}`);
    }

    if (opts.forceDelete) {
      const totalRows = inUse.reduce((a, t) => a + t.totalRefs, 0);
      console.warn(
        `🗑️  --force-delete: borrando ${inUse.length} término(s) en uso; se pierden ~${totalRows} filas relacionadas (cascada).`
      );
      const res = await prisma.taxonomyTerm.deleteMany({
        where: { id: { in: inUse.map((t) => t.id) } },
      });
      forceDeleted = res.count;
    } else {
      console.warn(
        "   Se conservan. Ejecuta con --force-delete para borrarlos (destruye datos de candidatos/vacantes en cascada)."
      );
    }
  }

  return { orphansDeleted, inUse, forceDeleted };
}
