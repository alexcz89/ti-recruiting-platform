// scripts/refresh-certs.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { CERTIFICATIONS } from "@/lib/shared/skills-data";

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
  console.log("🗑️  Borrando CERTIFICATIONS existentes (kind=CERTIFICATION)...");
  await prisma.taxonomyTerm.deleteMany({ where: { kind: TaxonomyKind.CERTIFICATION } });

  console.log("🌱 Insertando certificaciones del catálogo...");
  await prisma.taxonomyTerm.createMany({
    data: CERTIFICATIONS.map((label) => ({
      kind: TaxonomyKind.CERTIFICATION,
      slug: slugifyLabel(label),
      label,
      aliases: [] as string[],
    })),
    skipDuplicates: true,
  });

  const count = await prisma.taxonomyTerm.count({ where: { kind: TaxonomyKind.CERTIFICATION } });
  console.log(`✅ Certificaciones insertadas: ${count}`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-certs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
