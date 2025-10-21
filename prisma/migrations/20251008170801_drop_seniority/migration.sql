/*
  Warnings:

  - You are about to drop the column `seniority` on the `Job` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Job_seniority_employmentType_idx";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "seniority";

-- DropEnum
DROP TYPE "Seniority";
