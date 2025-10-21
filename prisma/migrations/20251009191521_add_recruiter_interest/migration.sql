-- CreateEnum
CREATE TYPE "ApplicationInterest" AS ENUM ('REVIEW', 'MAYBE', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "recruiterInterest" "ApplicationInterest" NOT NULL DEFAULT 'REVIEW';

-- CreateIndex
CREATE INDEX "Application_recruiterInterest_idx" ON "Application"("recruiterInterest");
