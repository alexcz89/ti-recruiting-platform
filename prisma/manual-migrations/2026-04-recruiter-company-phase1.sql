-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('ONE_TO_TEN', 'ELEVEN_TO_FIFTY', 'FIFTY_ONE_TO_TWO_HUNDRED', 'TWO_HUNDRED_ONE_TO_FIVE_HUNDRED', 'FIVE_HUNDRED_PLUS');

-- CreateEnum
CREATE TYPE "AssessmentPlan" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "AssessmentChargeStatus" AS ENUM ('RESERVED', 'CHARGED', 'REFUNDED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreditLedgerKind" ADD VALUE 'PURCHASE';
ALTER TYPE "CreditLedgerKind" ADD VALUE 'REFUND';
ALTER TYPE "CreditLedgerKind" ADD VALUE 'BONUS';
ALTER TYPE "CreditLedgerKind" ADD VALUE 'ADJUSTMENT';

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- DropIndex
DROP INDEX "Company_assessmentCredits_idx";

-- DropIndex
DROP INDEX "User_companyId_idx";

-- AlterTable
ALTER TABLE "AssessmentInviteChargeLedger" ADD COLUMN     "recruiterProfileId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "AssessmentChargeStatus" NOT NULL DEFAULT 'RESERVED';

-- AlterTable
ALTER TABLE "CandidateSummaryCache" DROP COLUMN "summaryJson",
ADD COLUMN     "summaryJson" JSONB NOT NULL,
ALTER COLUMN "fingerprint" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bannerKey" TEXT,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "industry" TEXT,
DROP COLUMN "size",
ADD COLUMN     "size" "CompanySize",
ALTER COLUMN "assessmentCredits" SET DEFAULT 0,
ALTER COLUMN "assessmentCredits" SET DATA TYPE INTEGER,
ALTER COLUMN "assessmentCreditsReserved" SET DEFAULT 0,
ALTER COLUMN "assessmentCreditsReserved" SET DATA TYPE INTEGER,
ALTER COLUMN "assessmentCreditsUsed" SET DEFAULT 0,
ALTER COLUMN "assessmentCreditsUsed" SET DATA TYPE INTEGER,
DROP COLUMN "assessmentPlan",
ADD COLUMN     "assessmentPlan" "AssessmentPlan";

-- AlterTable
ALTER TABLE "RecruiterProfile" DROP COLUMN "company",
DROP COLUMN "website",
ADD COLUMN     "assessmentCreditsConsumed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "canInviteToAssessments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canManageTeam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canPostJobs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canViewBilling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "lastAssessmentInviteAt" TIMESTAMP(3),
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "monthlyAssessmentCreditLimit" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "accountId",
DROP COLUMN "stripeCustomerId",
ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "companyId";

-- CreateIndex
CREATE INDEX "AssessmentInviteChargeLedger_companyId_status_idx" ON "AssessmentInviteChargeLedger"("companyId", "status");

-- CreateIndex
CREATE INDEX "AssessmentInviteChargeLedger_recruiterProfileId_idx" ON "AssessmentInviteChargeLedger"("recruiterProfileId");

-- CreateIndex
CREATE INDEX "AssessmentInviteChargeLedger_status_createdAt_idx" ON "AssessmentInviteChargeLedger"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentInviteChargeLedger_inviteId_kind_cycle_status_key" ON "AssessmentInviteChargeLedger"("inviteId", "kind", "cycle", "status");

-- CreateIndex
CREATE INDEX "CandidateSummaryCache_fingerprint_idx" ON "CandidateSummaryCache"("fingerprint");

-- CreateIndex
CREATE INDEX "RecruiterProfile_companyId_idx" ON "RecruiterProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_companyId_key" ON "Subscription"("companyId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterProfile" ADD CONSTRAINT "RecruiterProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentInviteChargeLedger" ADD CONSTRAINT "AssessmentInviteChargeLedger_recruiterProfileId_fkey" FOREIGN KEY ("recruiterProfileId") REFERENCES "RecruiterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

