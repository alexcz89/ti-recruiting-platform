// scripts/refresh-languages.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { LANGUAGES_FALLBACK } from "@/lib/shared/skills-data";
import { refreshTaxonomyKind } from "@/lib/db/taxonomy-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Sincronizando LANGUAGEs con el catálogo (upsert, no destructivo)...");
  const result = await refreshTaxonomyKind(
    prisma,
    TaxonomyKind.LANGUAGE,
    LANGUAGES_FALLBACK,
    { cleanUnlisted: true }
  );
  console.log(`✅ Idiomas en DB: ${result.total}`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-languages:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
