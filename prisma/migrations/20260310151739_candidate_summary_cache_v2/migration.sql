/*
  Warnings:

  - Added the required column `fingerprint` to the `CandidateSummaryCache` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `summaryJson` on the `CandidateSummaryCache` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "CandidateSummaryCache" ADD COLUMN     "fingerprint" TEXT NOT NULL,
ADD COLUMN     "summaryVersion" TEXT NOT NULL DEFAULT 'v1',
DROP COLUMN "summaryJson",
ADD COLUMN     "summaryJson" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "CandidateSummaryCache_fingerprint_idx" ON "CandidateSummaryCache"("fingerprint");
