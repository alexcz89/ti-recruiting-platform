// scripts/refresh-taxonomies-all.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { ALL_SKILLS, LANGUAGES_FALLBACK, CERTIFICATIONS } from "@/lib/shared/skills-data";
import { slugifyTaxonomyLabel } from "@/lib/shared/slugify-taxonomy";

const prisma = new PrismaClient();

async function refresh(
  kind: TaxonomyKind,
  labels: readonly string[],
  emoji: string
) {
  console.log(`${emoji}  Borrando ${TaxonomyKind[kind]} existentes...`);
  await prisma.taxonomyTerm.deleteMany({ where: { kind } });

  console.log(`🌱 Insertando ${TaxonomyKind[kind]}...`);
  await prisma.taxonomyTerm.createMany({
    data: labels.map((label) => ({
      kind,
      slug: slugifyTaxonomyLabel(label),
      label,
      aliases: [] as string[],
    })),
    skipDuplicates: true,
  });

  const count = await prisma.taxonomyTerm.count({ where: { kind } });
  console.log(`✅ ${TaxonomyKind[kind]} insertados: ${count}`);
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
