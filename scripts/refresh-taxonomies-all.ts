// scripts/refresh-taxonomies-all.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { ALL_SKILLS, LANGUAGES_FALLBACK, CERTIFICATIONS } from "@/lib/skills";

const prisma = new PrismaClient();

function slugifyLabel(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
      slug: slugifyLabel(label),
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
