-- CreateTable
CREATE TABLE "MatchExplanationCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "explanationJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchExplanationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchExplanationCache_cacheKey_key" ON "MatchExplanationCache"("cacheKey");

-- CreateIndex
CREATE INDEX "MatchExplanationCache_candidateId_idx" ON "MatchExplanationCache"("candidateId");

-- CreateIndex
CREATE INDEX "MatchExplanationCache_jobId_idx" ON "MatchExplanationCache"("jobId");

-- CreateIndex
CREATE INDEX "MatchExplanationCache_candidateId_jobId_idx" ON "MatchExplanationCache"("candidateId", "jobId");

-- CreateIndex
CREATE INDEX "MatchExplanationCache_fingerprint_idx" ON "MatchExplanationCache"("fingerprint");

-- AddForeignKey
ALTER TABLE "MatchExplanationCache" ADD CONSTRAINT "MatchExplanationCache_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchExplanationCache" ADD CONSTRAINT "MatchExplanationCache_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
