/*
  Warnings:

  - You are about to drop the column `company` on the `Job` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'HIRED';

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "company",
ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Application_status_createdAt_idx" ON "Application"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
