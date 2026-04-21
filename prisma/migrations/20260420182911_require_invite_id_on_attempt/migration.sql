/*
  Warnings:

  - The `size` column on the `Company` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `company` on the `RecruiterProfile` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `User` table. All the data in the column will be lost.
  - Added the required column `companyId` to the `RecruiterProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyName` to the `RecruiterProfile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('ONE_TO_TEN', 'ELEVEN_TO_FIFTY', 'FIFTY_ONE_TO_TWO_HUNDRED', 'TWO_HUNDRED_ONE_TO_FIVE_HUNDRED', 'FIVE_HUNDRED_PLUS');

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- DropIndex
DROP INDEX "CandidateSummaryCache_fingerprint_idx";

-- DropIndex
DROP INDEX "User_companyId_idx";

-- AlterTable
ALTER TABLE "CandidateSummaryCache" ALTER COLUMN "fingerprint" SET DEFAULT '',
ALTER COLUMN "summaryJson" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bannerKey" TEXT,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "industry" TEXT,
DROP COLUMN "size",
ADD COLUMN     "size" "CompanySize";

-- AlterTable
ALTER TABLE "RecruiterProfile" DROP COLUMN "company",
ADD COLUMN     "assessmentCreditsConsumed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "canInviteToAssessments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canManageTeam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canPostJobs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canViewBilling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "companyName" TEXT NOT NULL,
ADD COLUMN     "lastAssessmentInviteAt" TIMESTAMP(3),
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "monthlyAssessmentCreditLimit" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "companyId";

-- AddForeignKey
ALTER TABLE "RecruiterProfile" ADD CONSTRAINT "RecruiterProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
