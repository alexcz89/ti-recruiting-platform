-- AlterTable
ALTER TABLE "CandidateAIProfile" ADD COLUMN     "profileType" TEXT;

-- CreateIndex
CREATE INDEX "CandidateAIProfile_profileType_idx" ON "CandidateAIProfile"("profileType");
