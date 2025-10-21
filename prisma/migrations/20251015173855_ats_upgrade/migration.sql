/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "benefitsJson" JSONB,
ADD COLUMN     "certsJson" JSONB,
ADD COLUMN     "companyConfidential" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "educationJson" JSONB,
ADD COLUMN     "locationType" "LocationType" NOT NULL DEFAULT 'ONSITE',
ADD COLUMN     "minDegree" "EducationLevel",
ADD COLUMN     "publishAt" TIMESTAMP(3),
ADD COLUMN     "schedule" TEXT,
ADD COLUMN     "showBenefits" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showSalary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skillsJson" JSONB,
ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "JobTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "creatorId" TEXT,

    CONSTRAINT "JobTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobTemplate_companyId_updatedAt_idx" ON "JobTemplate"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX "JobTemplate_lastUsedAt_idx" ON "JobTemplate"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");

-- CreateIndex
CREATE INDEX "Job_employmentType_status_idx" ON "Job"("employmentType", "status");

-- CreateIndex
CREATE INDEX "Job_publishAt_idx" ON "Job"("publishAt");

-- AddForeignKey
ALTER TABLE "JobTemplate" ADD CONSTRAINT "JobTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTemplate" ADD CONSTRAINT "JobTemplate_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
