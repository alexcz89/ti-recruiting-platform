-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('MCQ', 'CODING', 'MIXED');

-- CreateEnum
CREATE TYPE "AssessmentDifficulty" AS ENUM ('JUNIOR', 'MID', 'SENIOR');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'EVALUATED');

-- CreateTable
CREATE TABLE "AssessmentTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentType" NOT NULL,
    "difficulty" "AssessmentDifficulty" NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "passingScore" INTEGER NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "allowRetry" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "penalizeWrong" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "difficulty" "AssessmentDifficulty" NOT NULL,
    "tags" TEXT[],
    "questionText" TEXT NOT NULL,
    "codeSnippet" TEXT,
    "options" JSONB NOT NULL,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingChallenge" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "AssessmentDifficulty" NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "starterCode" TEXT NOT NULL,
    "inputFiles" JSONB NOT NULL,
    "testCases" JSONB NOT NULL,
    "language" TEXT NOT NULL,
    "allowedLibs" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAssessment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "minScore" INTEGER,
    "triggerAt" TEXT NOT NULL DEFAULT 'AFTER_APPLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "status" "AttemptStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "timeSpent" INTEGER,
    "totalScore" INTEGER,
    "sectionScores" JSONB,
    "passed" BOOLEAN,
    "flagsJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptions" TEXT[],
    "isCorrect" BOOLEAN,
    "pointsEarned" DOUBLE PRECISION,
    "timeSpent" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingSubmission" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "testResults" JSONB,
    "autoScore" INTEGER,
    "manualScores" JSONB,
    "manualScore" INTEGER,
    "finalScore" INTEGER,
    "feedback" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplate_slug_key" ON "AssessmentTemplate"("slug");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_slug_idx" ON "AssessmentTemplate"("slug");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_type_difficulty_idx" ON "AssessmentTemplate"("type", "difficulty");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_templateId_section_idx" ON "AssessmentQuestion"("templateId", "section");

-- CreateIndex
CREATE INDEX "CodingChallenge_templateId_idx" ON "CodingChallenge"("templateId");

-- CreateIndex
CREATE INDEX "JobAssessment_jobId_idx" ON "JobAssessment"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobAssessment_jobId_templateId_key" ON "JobAssessment"("jobId", "templateId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_candidateId_status_idx" ON "AssessmentAttempt"("candidateId", "status");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_applicationId_idx" ON "AssessmentAttempt"("applicationId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_templateId_status_idx" ON "AssessmentAttempt"("templateId", "status");

-- CreateIndex
CREATE INDEX "AttemptAnswer_attemptId_idx" ON "AttemptAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");

-- CreateIndex
CREATE INDEX "CodingSubmission_attemptId_idx" ON "CodingSubmission"("attemptId");

-- CreateIndex
CREATE INDEX "CodingSubmission_challengeId_idx" ON "CodingSubmission"("challengeId");

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingChallenge" ADD CONSTRAINT "CodingChallenge_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssessment" ADD CONSTRAINT "JobAssessment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssessment" ADD CONSTRAINT "JobAssessment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingSubmission" ADD CONSTRAINT "CodingSubmission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingSubmission" ADD CONSTRAINT "CodingSubmission_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "CodingChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
