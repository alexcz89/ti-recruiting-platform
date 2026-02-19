/*
  Warnings:

  - You are about to alter the column `amount` on the `AssessmentInviteChargeLedger` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(10,2)`.
  - A unique constraint covering the columns `[inviteId,kind,cycle,status]` on the table `AssessmentInviteChargeLedger` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "AssessmentInviteChargeLedger_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "AssessmentInviteChargeLedger_inviteId_kind_cycle_key";

-- AlterTable
ALTER TABLE "AssessmentInviteChargeLedger" ADD COLUMN     "assessmentType" "AssessmentType",
ADD COLUMN     "chargedAmount" DECIMAL(10,2),
ADD COLUMN     "difficulty" "AssessmentDifficulty",
ADD COLUMN     "refundedAmount" DECIMAL(10,2),
ADD COLUMN     "reservedAmount" DECIMAL(10,2),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'RESERVED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "amount" DROP DEFAULT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "AssessmentTemplate" ADD COLUMN     "baseCreditCost" DECIMAL(10,2) NOT NULL DEFAULT 1.0,
ADD COLUMN     "pricingConfig" JSONB;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "assessmentCredits" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "assessmentCreditsReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "assessmentCreditsUsed" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "assessmentPlan" TEXT,
ADD COLUMN     "assessmentPlanCreditsPerMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "assessmentPlanStartedAt" TIMESTAMP(3),
ADD COLUMN     "lastCreditRefill" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AssessmentInviteChargeLedger_companyId_status_idx" ON "AssessmentInviteChargeLedger"("companyId", "status");

-- CreateIndex
CREATE INDEX "AssessmentInviteChargeLedger_status_createdAt_idx" ON "AssessmentInviteChargeLedger"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentInviteChargeLedger_cycle_idx" ON "AssessmentInviteChargeLedger"("cycle");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentInviteChargeLedger_inviteId_kind_cycle_status_key" ON "AssessmentInviteChargeLedger"("inviteId", "kind", "cycle", "status");

-- CreateIndex
CREATE INDEX "Company_assessmentCredits_idx" ON "Company"("assessmentCredits");
