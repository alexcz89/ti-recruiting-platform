/*
  Warnings:

  - A unique constraint covering the columns `[inviteId]` on the table `AssessmentAttempt` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[applicationId,templateId]` on the table `AssessmentInvite` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CreditLedgerKind" AS ENUM ('ASSESSMENT_INVITE');

-- AlterEnum
ALTER TYPE "AssessmentInviteStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
ALTER TYPE "AttemptStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "AssessmentAttempt" ADD COLUMN     "copyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "firstClientSig" TEXT,
ADD COLUMN     "focusLoss" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "inviteId" TEXT,
ADD COLUMN     "lastClientSig" TEXT,
ADD COLUMN     "multiSession" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pageHides" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pasteAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rightClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "severityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tabSwitches" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "visibilityHidden" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AssessmentInvite" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "chargeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chargedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AssessmentInviteChargeLedger" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "CreditLedgerKind" NOT NULL DEFAULT 'ASSESSMENT_INVITE',
    "cycle" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentInviteChargeLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttemptEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "meta" JSONB,
    "eventId" TEXT,
    "clientSig" TEXT,
    "ipPrefix" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAttemptEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentInviteChargeLedger_companyId_createdAt_idx" ON "AssessmentInviteChargeLedger"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentInviteChargeLedger_inviteId_idx" ON "AssessmentInviteChargeLedger"("inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentInviteChargeLedger_inviteId_kind_cycle_key" ON "AssessmentInviteChargeLedger"("inviteId", "kind", "cycle");

-- CreateIndex
CREATE INDEX "AssessmentAttemptEvent_attemptId_createdAt_idx" ON "AssessmentAttemptEvent"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentAttemptEvent_candidateId_createdAt_idx" ON "AssessmentAttemptEvent"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentAttemptEvent_type_createdAt_idx" ON "AssessmentAttemptEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttemptEvent_attemptId_eventId_key" ON "AssessmentAttemptEvent"("attemptId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttempt_inviteId_key" ON "AssessmentAttempt"("inviteId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_candidateId_templateId_status_idx" ON "AssessmentAttempt"("candidateId", "templateId", "status");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_applicationId_templateId_status_idx" ON "AssessmentAttempt"("applicationId", "templateId", "status");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_severity_severityScore_idx" ON "AssessmentAttempt"("severity", "severityScore");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_multiSession_idx" ON "AssessmentAttempt"("multiSession");

-- CreateIndex
CREATE INDEX "AssessmentInvite_applicationId_templateId_status_idx" ON "AssessmentInvite"("applicationId", "templateId", "status");

-- CreateIndex
CREATE INDEX "AssessmentInvite_candidateId_updatedAt_idx" ON "AssessmentInvite"("candidateId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentInvite_applicationId_templateId_key" ON "AssessmentInvite"("applicationId", "templateId");

-- AddForeignKey
ALTER TABLE "AssessmentInviteChargeLedger" ADD CONSTRAINT "AssessmentInviteChargeLedger_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "AssessmentInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentInviteChargeLedger" ADD CONSTRAINT "AssessmentInviteChargeLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "AssessmentInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttemptEvent" ADD CONSTRAINT "AssessmentAttemptEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
