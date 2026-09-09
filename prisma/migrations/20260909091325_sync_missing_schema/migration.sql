-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'CHALLENGE_OPEN', 'FINALIST_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContestLanguage" AS ENUM ('PYTHON', 'JAVASCRIPT', 'TYPESCRIPT', 'JAVA');

-- CreateEnum
CREATE TYPE "ContestRegistrationStatus" AS ENUM ('REGISTERED', 'QUALIFIER_SUBMITTED', 'FINALIST', 'WINNER', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "LiveInterviewStatus" AS ENUM ('SCHEDULED', 'CODING_PHASE', 'REVIEW_PAUSE', 'QA_PHASE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('HIRE', 'MAYBE', 'REJECT');

-- AlterEnum
ALTER TYPE "BillingPlan" ADD VALUE 'BUSINESS';

-- AlterEnum
ALTER TYPE "EmploymentType" ADD VALUE 'FREELANCE';

-- AlterTable
ALTER TABLE "AssessmentTemplate" ADD COLUMN     "badgeLevel" INTEGER,
ADD COLUMN     "badgeTermId" TEXT,
ADD COLUMN     "isBadgeExam" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CandidateBadge" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "attemptId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "status" "ContestStatus" NOT NULL DEFAULT 'DRAFT',
    "registrationOpens" TIMESTAMP(3),
    "registrationCloses" TIMESTAMP(3),
    "challengeOpens" TIMESTAMP(3),
    "challengeCloses" TIMESTAMP(3),
    "finalStartsAt" TIMESTAMP(3),
    "maxParticipants" INTEGER,
    "rulesJson" JSONB,
    "prizesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestTrack" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "language" "ContestLanguage" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestRegistration" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "attemptId" TEXT,
    "city" TEXT NOT NULL,
    "experienceLevel" "Seniority" NOT NULL,
    "linkedinUrl" TEXT NOT NULL,
    "githubUrl" TEXT,
    "rankingConsent" BOOLEAN NOT NULL DEFAULT false,
    "jobInterest" BOOLEAN NOT NULL DEFAULT false,
    "aiToolDisclosure" TEXT,
    "aiFreeCategory" BOOLEAN NOT NULL DEFAULT false,
    "automatedScore" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "efficiencyScore" INTEGER NOT NULL DEFAULT 0,
    "explanationScore" INTEGER NOT NULL DEFAULT 0,
    "finalScore" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "status" "ContestRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "disqualifiedReason" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationRateLimit" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "ip" VARCHAR(45),
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveInterview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "challengeTitle" TEXT NOT NULL,
    "challengeDescription" TEXT NOT NULL,
    "apiName" TEXT,
    "apiDocsUrl" TEXT,
    "videoCallUrl" TEXT,
    "codingMinutes" INTEGER NOT NULL DEFAULT 50,
    "qaMinutes" INTEGER NOT NULL DEFAULT 40,
    "githubUrl" TEXT,
    "liveUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "LiveInterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "codingStartedAt" TIMESTAMP(3),
    "codingEndedAt" TIMESTAMP(3),
    "qaStartedAt" TIMESTAMP(3),
    "qaEndedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "codingScore" INTEGER,
    "qaScore" INTEGER,
    "finalScore" INTEGER,
    "interviewerNotes" TEXT,
    "recommendation" "InterviewRecommendation",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveInterviewQuestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "techStack" TEXT,
    "seniority" "Seniority",
    "category" TEXT,
    "question" TEXT NOT NULL,
    "expectedTopics" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveInterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveInterviewQAScore" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "LiveInterviewQAScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateBadge_attemptId_key" ON "CandidateBadge"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateBadge_slug_key" ON "CandidateBadge"("slug");

-- CreateIndex
CREATE INDEX "CandidateBadge_candidateId_idx" ON "CandidateBadge"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateBadge_termId_level_idx" ON "CandidateBadge"("termId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateBadge_candidateId_termId_level_key" ON "CandidateBadge"("candidateId", "termId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");

-- CreateIndex
CREATE INDEX "Contest_status_registrationOpens_registrationCloses_idx" ON "Contest"("status", "registrationOpens", "registrationCloses");

-- CreateIndex
CREATE INDEX "ContestTrack_templateId_idx" ON "ContestTrack"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestTrack_contestId_language_key" ON "ContestTrack"("contestId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "ContestRegistration_attemptId_key" ON "ContestRegistration"("attemptId");

-- CreateIndex
CREATE INDEX "ContestRegistration_contestId_status_idx" ON "ContestRegistration"("contestId", "status");

-- CreateIndex
CREATE INDEX "ContestRegistration_trackId_idx" ON "ContestRegistration"("trackId");

-- CreateIndex
CREATE INDEX "ContestRegistration_candidateId_idx" ON "ContestRegistration"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestRegistration_contestId_candidateId_key" ON "ContestRegistration"("contestId", "candidateId");

-- CreateIndex
CREATE INDEX "EmailVerificationRateLimit_resetAt_idx" ON "EmailVerificationRateLimit"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationRateLimit_email_key" ON "EmailVerificationRateLimit"("email");

-- CreateIndex
CREATE INDEX "LiveInterview_applicationId_idx" ON "LiveInterview"("applicationId");

-- CreateIndex
CREATE INDEX "LiveInterview_candidateId_idx" ON "LiveInterview"("candidateId");

-- CreateIndex
CREATE INDEX "LiveInterview_companyId_idx" ON "LiveInterview"("companyId");

-- CreateIndex
CREATE INDEX "LiveInterview_status_idx" ON "LiveInterview"("status");

-- CreateIndex
CREATE INDEX "LiveInterviewQuestion_techStack_seniority_idx" ON "LiveInterviewQuestion"("techStack", "seniority");

-- CreateIndex
CREATE INDEX "LiveInterviewQuestion_companyId_idx" ON "LiveInterviewQuestion"("companyId");

-- CreateIndex
CREATE INDEX "LiveInterviewQAScore_interviewId_idx" ON "LiveInterviewQAScore"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveInterviewQAScore_interviewId_questionId_key" ON "LiveInterviewQAScore"("interviewId", "questionId");

-- CreateIndex
CREATE INDEX "Application_candidateId_idx" ON "Application"("candidateId");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_isBadgeExam_isActive_idx" ON "AssessmentTemplate"("isBadgeExam", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplate_badgeTermId_badgeLevel_key" ON "AssessmentTemplate"("badgeTermId", "badgeLevel");

-- CreateIndex
CREATE INDEX "Job_slug_idx" ON "Job"("slug");

-- AddForeignKey
ALTER TABLE "AssessmentTemplate" ADD CONSTRAINT "AssessmentTemplate_badgeTermId_fkey" FOREIGN KEY ("badgeTermId") REFERENCES "TaxonomyTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateBadge" ADD CONSTRAINT "CandidateBadge_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateBadge" ADD CONSTRAINT "CandidateBadge_termId_fkey" FOREIGN KEY ("termId") REFERENCES "TaxonomyTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateBadge" ADD CONSTRAINT "CandidateBadge_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestTrack" ADD CONSTRAINT "ContestTrack_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestTrack" ADD CONSTRAINT "ContestTrack_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "ContestTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveInterview" ADD CONSTRAINT "LiveInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveInterview" ADD CONSTRAINT "LiveInterview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveInterview" ADD CONSTRAINT "LiveInterview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveInterview" ADD CONSTRAINT "LiveInterview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveInterviewQAScore" ADD CONSTRAINT "LiveInterviewQAScore_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "LiveInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveInterviewQAScore" ADD CONSTRAINT "LiveInterviewQAScore_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LiveInterviewQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

