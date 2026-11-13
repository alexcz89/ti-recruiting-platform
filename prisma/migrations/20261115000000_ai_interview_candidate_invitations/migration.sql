BEGIN;
ALTER TABLE "AIInterviewSession"
  ADD COLUMN "invitedById" TEXT,
  ADD COLUMN "invitedAt" TIMESTAMPTZ(3),
  ADD COLUMN "invitationExpiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "invitationCancelledAt" TIMESTAMPTZ(3),
  ADD COLUMN "invitationCancelledById" TEXT,
  ADD COLUMN "invitationRequestId" TEXT,
  ADD COLUMN "invitationFingerprint" TEXT,
  ADD CONSTRAINT "AIInterviewSession_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AIInterviewSession_invitationCancelledById_fkey" FOREIGN KEY ("invitationCancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AIInterviewSession_invitation_check" CHECK (
    ("invitedAt" IS NULL AND "invitedById" IS NULL AND "invitationExpiresAt" IS NULL AND "invitationRequestId" IS NULL AND "invitationFingerprint" IS NULL)
    OR ("invitedAt" IS NOT NULL AND "invitedById" IS NOT NULL AND "invitationExpiresAt" IS NOT NULL
      AND "invitationExpiresAt" > "invitedAt" AND "invitationRequestId" IS NOT NULL
      AND "invitationFingerprint" IS NOT NULL AND "invitationFingerprint" ~ '^[a-f0-9]{64}$' AND "blueprintVersionId" IS NOT NULL)
  ),
  ADD CONSTRAINT "AIInterviewSession_cancellation_check" CHECK (
    ("invitationCancelledAt" IS NULL AND "invitationCancelledById" IS NULL)
    OR ("invitationCancelledAt" IS NOT NULL AND "invitationCancelledById" IS NOT NULL AND "invitedAt" IS NOT NULL AND "invitationCancelledAt" >= "invitedAt")
  );
CREATE UNIQUE INDEX "AIInterviewSession_companyId_invitationRequestId_key" ON "AIInterviewSession"("companyId", "invitationRequestId");
CREATE INDEX "AIInterviewSession_invitedById_idx" ON "AIInterviewSession"("invitedById");
CREATE INDEX "AIInterviewSession_invitationCancelledById_idx" ON "AIInterviewSession"("invitationCancelledById");
COMMIT;
