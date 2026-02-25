/*
  Warnings:

  - The values [BUSINESS,AGENCY] on the enum `BillingPlan` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BillingPlan_new" AS ENUM ('FREE', 'STARTER', 'PRO');
ALTER TABLE "Company" ALTER COLUMN "billingPlan" DROP DEFAULT;
ALTER TABLE "Company" ALTER COLUMN "billingPlan" TYPE "BillingPlan_new" USING ("billingPlan"::text::"BillingPlan_new");
ALTER TYPE "BillingPlan" RENAME TO "BillingPlan_old";
ALTER TYPE "BillingPlan_new" RENAME TO "BillingPlan";
DROP TYPE "BillingPlan_old";
ALTER TABLE "Company" ALTER COLUMN "billingPlan" SET DEFAULT 'FREE';
COMMIT;
