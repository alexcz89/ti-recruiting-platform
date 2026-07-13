// scripts/refresh-skills.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { ALL_SKILLS } from "@/lib/shared/skills-data";
import { refreshTaxonomyKind } from "@/lib/db/taxonomy-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Sincronizando SKILLs con el catálogo (upsert, no destructivo)...");
  const result = await refreshTaxonomyKind(prisma, TaxonomyKind.SKILL, ALL_SKILLS);
  console.log(`✅ Skills en DB: ${result.total}`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-skills:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
