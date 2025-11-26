// prisma/seed-plans.ts
import { PrismaClient } from "@prisma/client";
// IMPORT SIN EXTENSIÓN .ts (TS no lo permite por defecto)
import { PLANS } from "../config/plans";

const prisma = new PrismaClient();

async function main() {
  console.log("▶ Seedeando planes de suscripción...");

  for (const plan of PLANS) {
    const monthlyPriceCents = plan.priceMonthly * 100;

    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        monthlyPriceCents,
        currency: plan.currency,
        maxActiveJobs: plan.limits.maxActiveJobs ?? null,
        maxUsers: plan.limits.maxRecruiters ?? null,
      },
      create: {
        name: plan.name,
        slug: plan.slug,
        monthlyPriceCents,
        currency: plan.currency,
        maxActiveJobs: plan.limits.maxActiveJobs ?? null,
        maxUsers: plan.limits.maxRecruiters ?? null,
      },
    });

    console.log(`  ✔ Plan ${plan.name} (${plan.slug}) listo`);
  }

  console.log("✅ Seed de planes terminado.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed de planes:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
