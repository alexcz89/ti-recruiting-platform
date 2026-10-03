import { PrismaClient } from "@prisma/client";
import {
  createLegacyApplicationReconciler,
  type ReconcileLegacyApplicationsOptions,
} from "../lib/hiring-process/reconcile-legacy-applications";

const prisma = new PrismaClient({ log: ["error", "warn"] });
const reconcileLegacyApplications = createLegacyApplicationReconciler(prisma);

function valueAfter(args: string[], name: string) {
  const exact = args.indexOf(name);
  if (exact >= 0) return args[exact + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

function parseArgs(args: string[]): ReconcileLegacyApplicationsOptions {
  const apply = args.includes("--apply");
  const global = args.includes("--global");
  const applicationId = valueAfter(args, "--application-id");
  const companyId = valueAfter(args, "--company-id");
  const afterId = valueAfter(args, "--after-id");
  const batchSizeValue = valueAfter(args, "--batch-size");
  const known = new Set([
    "--apply",
    "--global",
    "--application-id",
    "--company-id",
    "--after-id",
    "--batch-size",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const name = argument.split("=", 1)[0];
    if (!known.has(name)) throw new Error(`Unknown option: ${name}`);
    if (!argument.includes("=") && !["--apply", "--global"].includes(name)) {
      index += 1;
    }
  }

  return {
    mode: apply ? "apply" : "dry-run",
    global,
    applicationId,
    companyId,
    afterId,
    batchSize: batchSizeValue === undefined ? undefined : Number(batchSizeValue),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await reconcileLegacyApplications(options);
  console.log(
    result.mode === "dry-run"
      ? "DRY RUN — NO DATABASE WRITES"
      : "APPLY MODE",
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.failures > 0 || (result.mode === "apply" && result.conflicts > 0)) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Application reconciliation failed",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
