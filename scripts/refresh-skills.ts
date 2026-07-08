// scripts/refresh-skills.ts
// Upsert del catálogo de skills (no destructivo: no borra términos
// existentes ni pisa aliases curados a mano).
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { ALL_SKILLS } from "@/lib/shared/skills-data";
import { upsertTaxonomyTerms } from "./lib/taxonomy-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Actualizando SKILLs (upsert idempotente)...");
  const catalog = await upsertTaxonomyTerms(prisma, TaxonomyKind.SKILL, ALL_SKILLS);

  const count = await prisma.taxonomyTerm.count({
    where: { kind: TaxonomyKind.SKILL },
  });
  console.log(`✅ Skills: ${catalog.size} en catálogo, ${count} en BD.`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-skills:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
