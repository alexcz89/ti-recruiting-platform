CREATE TABLE "AIInterviewSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIInterviewSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AIInterviewSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AIInterviewSession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AIInterviewSession_companyId_candidateId_idx" ON "AIInterviewSession"("companyId", "candidateId");
