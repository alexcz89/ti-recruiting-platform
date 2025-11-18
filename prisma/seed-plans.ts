// prisma/seed-plans.ts
import { PrismaClient } from "@prisma/client";
// 👇 IMPORT CON EXTENSIÓN .ts (importante en ESM)
import { PLANS } from "../config/plans.ts";

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
        maxUsers: plan.limits.maxRecruiters ?? null, // puedes ajustar luego
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
