-- Do not infer an application's identity from candidate/company alone.
-- Existing sessions require an explicitly reviewed backfill strategy before deployment.
BEGIN;
LOCK TABLE "AIInterviewSession" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AIInterviewSession") THEN
    RAISE EXCEPTION 'AIInterviewSession must be empty; explicit application mapping required before migration';
  END IF;
END $$;
ALTER TABLE "AIInterviewSession" ADD COLUMN "applicationId" TEXT NOT NULL;
ALTER TABLE "AIInterviewSession" ADD CONSTRAINT "AIInterviewSession_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AIInterviewSession_applicationId_idx" ON "AIInterviewSession"("applicationId");
COMMIT;
