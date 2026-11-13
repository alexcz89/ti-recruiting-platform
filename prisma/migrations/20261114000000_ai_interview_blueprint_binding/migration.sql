BEGIN;
-- Nullable exclusively for historical sessions; safe service creation requires it.
ALTER TABLE "AIInterviewSession" ADD COLUMN "blueprintVersionId" TEXT;
ALTER TABLE "AIInterviewSession" ADD CONSTRAINT "AIInterviewSession_blueprintVersionId_fkey"
  FOREIGN KEY ("blueprintVersionId") REFERENCES "AIInterviewBlueprintVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AIInterviewSession_blueprintVersionId_idx" ON "AIInterviewSession"("blueprintVersionId");
COMMIT;
