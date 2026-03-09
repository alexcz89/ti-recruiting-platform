-- CreateTable
CREATE TABLE "CandidateSummaryCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT,
    "summaryJson" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateSummaryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSummaryCache_cacheKey_key" ON "CandidateSummaryCache"("cacheKey");

-- CreateIndex
CREATE INDEX "CandidateSummaryCache_candidateId_idx" ON "CandidateSummaryCache"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateSummaryCache_candidateId_jobId_idx" ON "CandidateSummaryCache"("candidateId", "jobId");

-- AddForeignKey
ALTER TABLE "CandidateSummaryCache" ADD CONSTRAINT "CandidateSummaryCache_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
