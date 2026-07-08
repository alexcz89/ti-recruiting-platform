// scripts/refresh-languages.ts
// Upsert del catálogo de idiomas (no destructivo: no borra términos
// existentes ni sus relaciones con candidatos).
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { LANGUAGES_FALLBACK } from "@/lib/shared/skills-data";
import { upsertTaxonomyTerms } from "./lib/taxonomy-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("🗣️  Actualizando LANGUAGEs (upsert idempotente)...");
  const catalog = await upsertTaxonomyTerms(prisma, TaxonomyKind.LANGUAGE, LANGUAGES_FALLBACK);

  const count = await prisma.taxonomyTerm.count({
    where: { kind: TaxonomyKind.LANGUAGE },
  });
  console.log(`✅ Idiomas: ${catalog.size} en catálogo, ${count} en BD.`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-languages:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
