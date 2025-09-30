-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionEmailSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Application_status_rejectedAt_rejectionEmailSent_idx" ON "Application"("status", "rejectedAt", "rejectionEmailSent");
