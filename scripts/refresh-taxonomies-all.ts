// scripts/refresh-taxonomies-all.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { ALL_SKILLS, LANGUAGES_FALLBACK, CERTIFICATIONS } from "@/lib/shared/skills-data";
import { refreshTaxonomyKind } from "@/lib/db/taxonomy-refresh";

const prisma = new PrismaClient();

async function refresh(
  kind: TaxonomyKind,
  labels: readonly string[],
  emoji: string
) {
  console.log(`${emoji}  Sincronizando ${TaxonomyKind[kind]} (upsert, no destructivo)...`);
  const result = await refreshTaxonomyKind(prisma, kind, labels, {
    cleanUnlisted: true,
  });
  console.log(`✅ ${TaxonomyKind[kind]} en DB: ${result.total}`);
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
