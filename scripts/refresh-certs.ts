// scripts/refresh-certs.ts
// Upsert del catálogo de certificaciones (no destructivo: no borra términos
// existentes ni sus relaciones con candidatos/vacantes/badges).
import { PrismaClient, TaxonomyKind } from "@prisma/client";
import { CERTIFICATIONS } from "@/lib/shared/skills-data";
import { upsertTaxonomyTerms } from "./lib/taxonomy-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("🎓 Actualizando CERTIFICATIONs (upsert idempotente)...");
  const catalog = await upsertTaxonomyTerms(prisma, TaxonomyKind.CERTIFICATION, CERTIFICATIONS);

  const count = await prisma.taxonomyTerm.count({
    where: { kind: TaxonomyKind.CERTIFICATION },
  });
  console.log(`✅ Certificaciones: ${catalog.size} en catálogo, ${count} en BD.`);
}

main()
  .catch((e) => {
    console.error("❌ Error en refresh-certs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
