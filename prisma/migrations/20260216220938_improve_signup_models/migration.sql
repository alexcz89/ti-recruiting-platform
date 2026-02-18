-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "followUpDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiredAt" TIMESTAMP(3),
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "interviewAt" TIMESTAMP(3),
ADD COLUMN     "lastViewedAt" TIMESTAMP(3),
ADD COLUMN     "lastViewedBy" TEXT,
ADD COLUMN     "offerAt" TIMESTAMP(3),
ADD COLUMN     "recruiterNotes" TEXT,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewingAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT,
ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "starredAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AssessmentAttempt" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AssessmentInvite" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AssessmentQuestion" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AssessmentTemplate" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CodeTestCase" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CodexEntry" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CodingChallenge" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cityNorm" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLng" DOUBLE PRECISION,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "stateNorm" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Education" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "JobTemplate" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "RecruiterProfile" ADD COLUMN     "activeJobsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "avgTimeToHire" INTEGER,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "directPhone" TEXT,
ADD COLUMN     "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "phoneExtension" TEXT,
ADD COLUMN     "preferredLanguage" TEXT DEFAULT 'es',
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timezone" TEXT DEFAULT 'America/Monterrey',
ADD COLUMN     "totalApplications" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalHires" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TaxonomyTerm" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "desiredCurrency" TEXT DEFAULT 'MXN',
ADD COLUMN     "desiredSalaryMax" INTEGER,
ADD COLUMN     "desiredSalaryMin" INTEGER,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "locale" TEXT DEFAULT 'es-MX',
ADD COLUMN     "maternalSurname" TEXT,
ADD COLUMN     "notifyHybridJobs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnsiteJobs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyRemoteJobs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "openToRelocate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneCountryCode" TEXT DEFAULT '+52',
ADD COLUMN     "phoneVerified" TIMESTAMP(3),
ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profileCompletion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "profileLastUpdated" TIMESTAMP(3),
ADD COLUMN     "seekingHybrid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seekingOnsite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seekingRemote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signupDevice" TEXT,
ADD COLUMN     "signupIp" TEXT,
ADD COLUMN     "signupSource" TEXT,
ADD COLUMN     "signupUserAgent" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "theme" TEXT DEFAULT 'light',
ADD COLUMN     "timezone" TEXT DEFAULT 'America/Monterrey',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "WorkExperience" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "notification_preferences" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Application_jobId_status_idx" ON "Application"("jobId", "status");

-- CreateIndex
CREATE INDEX "Application_assignedTo_idx" ON "Application"("assignedTo");

-- CreateIndex
CREATE INDEX "Application_starred_idx" ON "Application"("starred");

-- CreateIndex
CREATE INDEX "Application_source_idx" ON "Application"("source");

-- CreateIndex
CREATE INDEX "Company_domain_idx" ON "Company"("domain");

-- CreateIndex
CREATE INDEX "Company_cityNorm_idx" ON "Company"("cityNorm");

-- CreateIndex
CREATE INDEX "Company_country_city_idx" ON "Company"("country", "city");

-- CreateIndex
CREATE INDEX "Company_billingPlan_idx" ON "Company"("billingPlan");

-- CreateIndex
CREATE INDEX "RecruiterProfile_userId_idx" ON "RecruiterProfile"("userId");

-- CreateIndex
CREATE INDEX "RecruiterProfile_status_idx" ON "RecruiterProfile"("status");

-- CreateIndex
CREATE INDEX "RecruiterProfile_activeJobsCount_idx" ON "RecruiterProfile"("activeJobsCount");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_profileCompleted_idx" ON "User"("profileCompleted");

-- CreateIndex
CREATE INDEX "User_onboardingStep_idx" ON "User"("onboardingStep");

-- CreateIndex
CREATE INDEX "User_lastActivityAt_idx" ON "User"("lastActivityAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
