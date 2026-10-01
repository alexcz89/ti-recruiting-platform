-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED', 'REVIEW', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationDisposition" AS ENUM ('ACTIVE', 'HOLD', 'REJECTED', 'WITHDRAWN', 'HIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationEventActorType" AS ENUM ('CANDIDATE', 'RECRUITER', 'ADMIN', 'SYSTEM', 'IMPORT');

-- CreateEnum
CREATE TYPE "ApplicationEventType" AS ENUM ('APPLICATION_STAGE_CHANGED', 'APPLICATION_DISPOSITION_CHANGED', 'CANDIDATE_REJECTED', 'CANDIDATE_WITHDREW', 'CANDIDATE_HIRED', 'PROCESS_CANCELLED', 'LEGACY_STATE_IMPORTED');

-- CreateEnum
CREATE TYPE "ApplicationEventVisibility" AS ENUM ('INTERNAL', 'CANDIDATE', 'BOTH');

-- AlterTable
ALTER TABLE "Application"
ADD COLUMN     "stage" "ApplicationStage",
ADD COLUMN     "disposition" "ApplicationDisposition",
ADD COLUMN     "stateVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorType" "ApplicationEventActorType" NOT NULL,
    "actorId" TEXT,
    "type" "ApplicationEventType" NOT NULL,
    "fromStage" "ApplicationStage",
    "toStage" "ApplicationStage",
    "fromDisposition" "ApplicationDisposition",
    "toDisposition" "ApplicationDisposition",
    "visibility" "ApplicationEventVisibility" NOT NULL DEFAULT 'INTERNAL',
    "reasonCode" TEXT,
    "metadata" JSONB,
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_happenedAt_idx" ON "ApplicationEvent"("applicationId", "happenedAt");

-- CreateIndex
CREATE INDEX "ApplicationEvent_companyId_happenedAt_idx" ON "ApplicationEvent"("companyId", "happenedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEvent_companyId_applicationId_idempotencyKey_key" ON "ApplicationEvent"("companyId", "applicationId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
