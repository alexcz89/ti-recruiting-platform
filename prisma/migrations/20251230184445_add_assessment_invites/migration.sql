-- CreateEnum
CREATE TYPE "AssessmentInviteStatus" AS ENUM ('SENT', 'STARTED', 'SUBMITTED', 'EVALUATED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AssessmentInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "AssessmentInviteStatus" NOT NULL DEFAULT 'SENT',
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "invitedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentInvite_token_key" ON "AssessmentInvite"("token");

-- CreateIndex
CREATE INDEX "AssessmentInvite_applicationId_idx" ON "AssessmentInvite"("applicationId");

-- CreateIndex
CREATE INDEX "AssessmentInvite_jobId_idx" ON "AssessmentInvite"("jobId");

-- CreateIndex
CREATE INDEX "AssessmentInvite_candidateId_idx" ON "AssessmentInvite"("candidateId");

-- CreateIndex
CREATE INDEX "AssessmentInvite_templateId_idx" ON "AssessmentInvite"("templateId");

-- AddForeignKey
ALTER TABLE "AssessmentInvite" ADD CONSTRAINT "AssessmentInvite_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentInvite" ADD CONSTRAINT "AssessmentInvite_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentInvite" ADD CONSTRAINT "AssessmentInvite_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentInvite" ADD CONSTRAINT "AssessmentInvite_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentInvite" ADD CONSTRAINT "AssessmentInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
