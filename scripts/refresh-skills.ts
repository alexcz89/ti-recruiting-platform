// scripts/refresh-skills.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { ALL_SKILLS } from "@/lib/skills"; // 👈 asegurate que la ruta sea correcta

const prisma = new PrismaClient();

function slugifyLabel(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("🌱 Actualizando SKILLs (idempotente)...");
  const rows = ALL_SKILLS.map((label) => ({
    kind: TaxonomyKind.SKILL,
    slug: slugifyLabel(label),
    label,
    aliases: [] as string[],
  }));

  for (const row of rows) {
    await prisma.taxonomyTerm.upsert({
      where: {
        kind_slug: {
          kind: row.kind,
          slug: row.slug,
        },
      },
      create: row,
      update: {
        label: row.label,
        aliases: row.aliases,
      },
    });
  }

  const count = await prisma.taxonomyTerm.count({ where: { kind: TaxonomyKind.SKILL } });
  console.log(`✅ Insertados ${count} SKILLs.`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-skills:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
