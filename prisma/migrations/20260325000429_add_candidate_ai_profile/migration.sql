-- DropIndex
DROP INDEX "MatchExplanationCache_candidateId_idx";

-- CreateTable
CREATE TABLE "CandidateAIProfile" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "profileVersion" TEXT NOT NULL DEFAULT 'v1',
    "sourceFingerprint" TEXT NOT NULL,
    "profileJson" JSONB NOT NULL,
    "summaryText" TEXT,
    "strengthsJson" JSONB,
    "risksJson" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateAIProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateAIProfile_candidateId_key" ON "CandidateAIProfile"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateAIProfile_generatedAt_idx" ON "CandidateAIProfile"("generatedAt");

-- CreateIndex
CREATE INDEX "CandidateAIProfile_sourceFingerprint_idx" ON "CandidateAIProfile"("sourceFingerprint");

-- CreateIndex
CREATE INDEX "MatchExplanationCache_candidateId_jobId_version_idx" ON "MatchExplanationCache"("candidateId", "jobId", "version");

-- AddForeignKey
ALTER TABLE "CandidateAIProfile" ADD CONSTRAINT "CandidateAIProfile_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSummaryCache" ADD CONSTRAINT "CandidateSummaryCache_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
