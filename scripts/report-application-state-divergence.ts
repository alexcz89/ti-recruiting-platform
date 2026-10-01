import { PrismaClient } from "@prisma/client";

import { collectApplicationDivergenceReport } from "../lib/hiring-process/divergence-report";

const prisma = new PrismaClient({ log: ["error", "warn"] });

async function main() {
  if (process.env.ALLOW_SAFE_HIRING_DIVERGENCE_REPORT !== "true") {
    throw new Error(
      "Refusing to connect. Set ALLOW_SAFE_HIRING_DIVERGENCE_REPORT=true only for an environment verified as local/test/development.",
    );
  }

  const report = await collectApplicationDivergenceReport({
    groupBy: () =>
      prisma.application.groupBy({
        by: ["status", "recruiterInterest"],
        _count: { _all: true },
        orderBy: [{ status: "asc" }, { recruiterInterest: "asc" }],
      }),
  });

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Divergence report failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
