-- Additive: does not alter sessions, existing rows, or any hiring model.
BEGIN;

CREATE TYPE "AIInterviewBlueprintStatus" AS ENUM ('DRAFT', 'APPROVED', 'REVOKED');

CREATE TABLE "AIInterviewBlueprintVersion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "blueprint" JSONB NOT NULL,
  "status" "AIInterviewBlueprintStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "fingerprint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIInterviewBlueprintVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AIInterviewBlueprintVersion_approval_check" CHECK (
    ("status" = 'DRAFT' AND "approvedById" IS NULL AND "approvedAt" IS NULL AND "fingerprint" IS NULL)
    OR ("status" IN ('APPROVED', 'REVOKED') AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL
      AND "approvedAt" >= "createdAt" AND "fingerprint" IS NOT NULL AND "fingerprint" ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT "AIInterviewBlueprintVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AIInterviewBlueprintVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AIInterviewBlueprintVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AIInterviewBlueprintVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AIInterviewBlueprintVersion_companyId_jobId_status_idx" ON "AIInterviewBlueprintVersion"("companyId", "jobId", "status");
CREATE INDEX "AIInterviewBlueprintVersion_jobId_idx" ON "AIInterviewBlueprintVersion"("jobId");
CREATE INDEX "AIInterviewBlueprintVersion_createdById_idx" ON "AIInterviewBlueprintVersion"("createdById");
CREATE INDEX "AIInterviewBlueprintVersion_approvedById_idx" ON "AIInterviewBlueprintVersion"("approvedById");

COMMIT;
