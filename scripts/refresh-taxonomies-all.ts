// scripts/refresh-taxonomies-all.ts
//
// Refresca SKILL, LANGUAGE y CERTIFICATION vía upsert (no destructivo).
//
// Flags:
//   --clean         además borra términos fuera del catálogo SIN referencias
//   --force-delete  implica --clean y también borra términos EN USO
//                   (destruye en cascada skills/idiomas/certs de candidatos,
//                   requisitos de vacantes y badges — imprime reporte antes)
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { ALL_SKILLS, LANGUAGES_FALLBACK, CERTIFICATIONS } from "@/lib/shared/skills-data";
import { upsertTaxonomyTerms, cleanUnlistedTerms } from "./lib/taxonomy-refresh";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const forceDelete = args.includes("--force-delete");
const clean = forceDelete || args.includes("--clean");

async function refresh(kind: TaxonomyKind, labels: readonly string[], emoji: string) {
  console.log(`${emoji}  Upsert de ${kind}...`);
  const catalog = await upsertTaxonomyTerms(prisma, kind, labels);

  if (clean) {
    await cleanUnlistedTerms(prisma, kind, new Set(catalog.keys()), { forceDelete });
  }

  const count = await prisma.taxonomyTerm.count({ where: { kind } });
  console.log(`✅ ${kind}: ${catalog.size} en catálogo, ${count} en BD.`);
}

async function main() {
  await refresh(TaxonomyKind.SKILL, ALL_SKILLS, "🧩");
  await refresh(TaxonomyKind.LANGUAGE, LANGUAGES_FALLBACK, "🗣️");
  await refresh(TaxonomyKind.CERTIFICATION, CERTIFICATIONS, "🎓");
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-taxonomies-all:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
