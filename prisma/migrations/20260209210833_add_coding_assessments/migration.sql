-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'OPEN_ENDED', 'CODING');

-- AlterTable
ALTER TABLE "AssessmentQuestion" ADD COLUMN     "allowedLanguages" TEXT,
ADD COLUMN     "codingConfig" JSONB,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "solutionCode" TEXT,
ADD COLUMN     "starterCode" TEXT,
ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE';

-- AlterTable
ALTER TABLE "AttemptAnswer" ADD COLUMN     "codeSubmission" TEXT,
ADD COLUMN     "executionResults" JSONB,
ADD COLUMN     "executionTime" INTEGER,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "memoryUsed" INTEGER,
ADD COLUMN     "passedTests" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalTests" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CodeTestCase" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 1,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "memoryLimitMb" INTEGER NOT NULL DEFAULT 256,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeExecution" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "output" TEXT,
    "error" TEXT,
    "executionTimeMs" INTEGER,
    "memoryUsedMb" INTEGER,
    "testResults" JSONB,
    "isSubmission" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlagiarismCheck" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "matchedSources" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlagiarismCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodeTestCase_questionId_idx" ON "CodeTestCase"("questionId");

-- CreateIndex
CREATE INDEX "CodeTestCase_questionId_isHidden_idx" ON "CodeTestCase"("questionId", "isHidden");

-- CreateIndex
CREATE INDEX "CodeExecution_attemptId_idx" ON "CodeExecution"("attemptId");

-- CreateIndex
CREATE INDEX "CodeExecution_questionId_idx" ON "CodeExecution"("questionId");

-- CreateIndex
CREATE INDEX "CodeExecution_candidateId_idx" ON "CodeExecution"("candidateId");

-- CreateIndex
CREATE INDEX "CodeExecution_isSubmission_idx" ON "CodeExecution"("isSubmission");

-- CreateIndex
CREATE INDEX "PlagiarismCheck_answerId_idx" ON "PlagiarismCheck"("answerId");

-- CreateIndex
CREATE INDEX "PlagiarismCheck_similarityScore_idx" ON "PlagiarismCheck"("similarityScore");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_type_idx" ON "AssessmentQuestion"("type");

-- AddForeignKey
ALTER TABLE "CodeTestCase" ADD CONSTRAINT "CodeTestCase_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeExecution" ADD CONSTRAINT "CodeExecution_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeExecution" ADD CONSTRAINT "CodeExecution_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeExecution" ADD CONSTRAINT "CodeExecution_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlagiarismCheck" ADD CONSTRAINT "PlagiarismCheck_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "AttemptAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlagiarismCheck" ADD CONSTRAINT "PlagiarismCheck_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
