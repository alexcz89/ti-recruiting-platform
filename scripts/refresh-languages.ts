// scripts/refresh-languages.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { LANGUAGES_FALLBACK } from "@/lib/shared/skills-data"; // asegúrate que el alias @ funcione en tu tsconfig

import { slugifyTaxonomyLabel } from "@/lib/shared/slugify-taxonomy";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Borrando LANGUAGES existentes (kind=LANGUAGE)...");
  await prisma.taxonomyTerm.deleteMany({ where: { kind: TaxonomyKind.LANGUAGE } });

  console.log("🌱 Insertando idiomas del catálogo (LANGUAGES_FALLBACK)...");
  await prisma.taxonomyTerm.createMany({
    data: LANGUAGES_FALLBACK.map((label) => ({
      kind: TaxonomyKind.LANGUAGE,
      slug: slugifyTaxonomyLabel(label),
      label,
      aliases: [] as string[],
    })),
    skipDuplicates: true,
  });

  const count = await prisma.taxonomyTerm.count({ where: { kind: TaxonomyKind.LANGUAGE } });
  console.log(`✅ Idiomas insertados: ${count}`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-languages:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
