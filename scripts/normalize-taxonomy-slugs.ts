// scripts/normalize-taxonomy-slugs.ts
//
// Re-normaliza los slugs de TODOS los TaxonomyTerm al slug canónico que
// produce lib/shared/slugify-taxonomy.ts a partir de su label. Útil después
// de consolidar términos creados con slugifiers viejos (ej. el onboarding
// generaba "cicd" en vez de "ci-cd", o "diseo-..." perdiendo la ñ), porque
// un slug divergente hace que ensureTerm no encuentre el término y cree un
// duplicado la próxima vez que un candidato teclee el mismo label.
//
// - Si el slug canónico está libre: renombra in-place (conserva id/relaciones).
// - Si ya lo ocupa otro término: NO toca nada y lo reporta como candidato a
//   fusión (usar scripts/fix-skill-taxonomy-slugs.mjs como referencia).
//
// Uso:  npx tsx scripts/normalize-taxonomy-slugs.ts [--dry-run]

import { PrismaClient } from "@prisma/client";
import { slugifyTaxonomyLabel } from "@/lib/shared/slugify-taxonomy";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");

async function main() {
  if (DRY) console.log("== DRY RUN: no se escribe nada ==\n");

  const terms = await prisma.taxonomyTerm.findMany({
    select: { id: true, kind: true, slug: true, label: true },
  });
  const bySlugKey = new Map(terms.map((t) => [`${t.kind}:${t.slug}`, t]));

  let renamed = 0;
  let conflicts = 0;

  for (const term of terms) {
    const canonical = slugifyTaxonomyLabel(term.label);
    if (!canonical || canonical === term.slug) continue;

    const occupant = bySlugKey.get(`${term.kind}:${canonical}`);
    if (occupant) {
      conflicts++;
      console.log(
        `⚠️  ${term.kind} '${term.slug}' (${term.label}) debería ser '${canonical}', pero ese slug ya lo ocupa '${occupant.label}' — candidato a fusión manual`
      );
      continue;
    }

    console.log(`- ${term.kind} '${term.slug}' → '${canonical}' (label '${term.label}')`);
    if (!DRY) {
      await prisma.taxonomyTerm.update({
        where: { id: term.id },
        data: { slug: canonical },
      });
    }
    bySlugKey.set(`${term.kind}:${canonical}`, term);
    renamed++;
  }

  console.log(
    `\n✅ ${renamed} slug(s) normalizados, ${conflicts} conflicto(s) pendientes de fusión, ${terms.length} términos revisados.`
  );
}

main()
  .catch((e) => {
    console.error("❌ Error en normalize-taxonomy-slugs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
