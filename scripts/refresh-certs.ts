// scripts/refresh-certs.ts
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { CERTIFICATIONS } from "@/lib/shared/skills-data";
import { refreshTaxonomyKind } from "@/lib/db/taxonomy-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Sincronizando CERTIFICATIONs con el catálogo (upsert, no destructivo)...");
  const result = await refreshTaxonomyKind(
    prisma,
    TaxonomyKind.CERTIFICATION,
    CERTIFICATIONS,
    { cleanUnlisted: true }
  );
  console.log(`✅ Certificaciones en DB: ${result.total}`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-certs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
