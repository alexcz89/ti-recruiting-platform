/*
  Warnings:

  - You are about to drop the column `skills` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[candidateId,jobId]` on the table `Application` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "skills",
ADD COLUMN     "ai" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "backend" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "birthdate" TIMESTAMP(3),
ADD COLUMN     "cloud" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cybersecurity" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "database" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "frontend" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mobile" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "testing" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Application_candidateId_jobId_key" ON "Application"("candidateId", "jobId");

-- CreateIndex
CREATE INDEX "Job_title_idx" ON "Job"("title");

-- CreateIndex
CREATE INDEX "Job_location_idx" ON "Job"("location");

-- CreateIndex
CREATE INDEX "Job_seniority_employmentType_idx" ON "Job"("seniority", "employmentType");
