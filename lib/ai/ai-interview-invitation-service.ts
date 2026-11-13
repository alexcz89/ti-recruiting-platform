import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Application } from "@prisma/client";
import { getApplicationWriterCompatibility } from "@/lib/hiring-process/writer-compatibility";
import { LEGACY_APPLICATION_STATE_MATRIX, projectCanonicalStateToLegacy } from "@/lib/hiring-process/legacy-mapping";
import { hasApplicationHiredFootprint } from "@/lib/hiring-process/hired-footprint";
import { hasApplicationRejectionFootprint } from "@/lib/hiring-process/rejection-footprint";
import { createInterviewSessionService, InterviewPersistenceError, type InterviewScope, type InterviewTransaction, type StoredInterview } from "./ai-interview-session-service";

export type InterviewApplication = Pick<Application, "stage" | "disposition" | "status" | "recruiterInterest" | "stateVersion" | "hiredAt" | "rejectedAt" | "rejectionEmailSent"> & { jobStatus: string };
/** Conservative internal policy independent of UI feature flags. Unknown canonical
 * projections (including ASSESSMENT) need an explicit domain rule before issuance. */
function hasInterviewBlockingFootprint(app: InterviewApplication): boolean {
  return !Number.isSafeInteger(app.stateVersion) || app.stateVersion < 0 ||
    Boolean(app.hiredAt || app.rejectedAt || app.rejectionEmailSent) ||
    hasApplicationHiredFootprint(app) || hasApplicationRejectionFootprint(app);
}

export function isInterviewApplicationEligible(app: InterviewApplication): boolean {
  if (hasInterviewBlockingFootprint(app)) return false;
  const compatibility = getApplicationWriterCompatibility(app);
  if (compatibility === "LEGACY") {
    const mapping = LEGACY_APPLICATION_STATE_MATRIX.find(m => m.status === app.status && m.recruiterInterest === app.recruiterInterest);
    return Boolean(mapping?.autoApplicable && mapping.suggestedDisposition === "ACTIVE");
  }
  if (compatibility !== "CANONICAL" || app.disposition !== "ACTIVE" || app.stage === "CLOSED") return false;
  const expected = projectCanonicalStateToLegacy({ stage: app.stage!, disposition: app.disposition });
  return Boolean(expected && expected.status === app.status && (expected.recruiterInterest === app.recruiterInterest || (app.stage === "REVIEW" && app.recruiterInterest === "MAYBE")));
}
/** Allows an already-started interview to survive a valid ASSESSMENT
 * transition. Does not authorize new invitations or READY sessions. */
export function isInterviewApplicationContinuationEligible(app: InterviewApplication): boolean {
  if (isInterviewApplicationEligible(app)) return true;
  if (hasInterviewBlockingFootprint(app)) return false;
  if (getApplicationWriterCompatibility(app) !== "CANONICAL" ||
      app.stage !== "ASSESSMENT" || app.disposition !== "ACTIVE") return false;

  const mapping = LEGACY_APPLICATION_STATE_MATRIX.find(
    m => m.status === app.status && m.recruiterInterest === app.recruiterInterest
  );

  return Boolean(
    mapping?.autoApplicable &&
    mapping.suggestedDisposition === "ACTIVE" &&
    mapping.suggestedStage !== "OFFER"
  );
}

export type InterviewInvitation = StoredInterview & {
  invitedById: string | null; invitedAt: Date | null; invitationExpiresAt: Date | null;
  invitationCancelledAt: Date | null; invitationCancelledById: string | null;
  invitationRequestId: string | null; invitationFingerprint: string | null;
};
export interface InvitationTransaction {
  sessions: InterviewTransaction;
  authorizeCancellation(scope: InterviewScope): Promise<boolean>;
  application(scope: InterviewScope): Promise<InterviewApplication | null>;
  lockRequest(companyId: string, requestId: string): Promise<void>;
  request(companyId: string, requestId: string): Promise<InterviewInvitation | null>;
  find(scope: InterviewScope, id: string): Promise<InterviewInvitation | null>;
  candidate(actorId: string, id: string): Promise<InterviewInvitation | null>;
  stamp(scope: InterviewScope, id: string, requestId: string, fingerprint: string, expiresAt: Date): Promise<InterviewInvitation>;
  cancel(scope: InterviewScope, id: string): Promise<void>;
}
export interface InvitationStore { transaction<T>(work: (tx: InvitationTransaction) => Promise<T>): Promise<T> }
export const invitationNotFound = () => new InterviewPersistenceError("NOT_FOUND");
const Id = z.string().min(1).max(200).refine(v => v.trim() === v);
const Issue = z.object({ blueprintVersionId: Id, requestId: Id, expiresAt: z.number().int().nonnegative().max(8_640_000_000_000_000) }).strict();
const Scope = z.object({ actorId: Id, companyId: Id, candidateId: Id, applicationId: Id }).strict();

/** Only trusted authenticated server callers may supply scope.actorId.
 * A replay reauthorizes but never renews, uncancels or creates another session. */
export function createInterviewInvitationService(store: InvitationStore) {
  return {
    issue: (rawScope: InterviewScope, input: z.infer<typeof Issue>) => store.transaction(async tx => {
      const scope = Scope.safeParse(rawScope); const args = Issue.safeParse(input);
      if (!scope.success || !args.success || !await tx.sessions.authorize(scope.data)) throw invitationNotFound();
      const s = scope.data; const a = args.data;
      await tx.lockRequest(s.companyId, a.requestId);
      if (!await tx.sessions.authorize(s)) throw invitationNotFound();
      const fingerprint = createHash("sha256").update(JSON.stringify([s.actorId, s.companyId, s.candidateId, s.applicationId, a.blueprintVersionId, a.expiresAt])).digest("hex");
      const previous = await tx.request(s.companyId, a.requestId);
      if (previous) {
        if (previous.invitationFingerprint !== fingerprint) throw new InterviewPersistenceError("VERSION_CONFLICT");
        return { id: previous.id };
      }
      const app = await tx.application(s);
      if (!app || app.jobStatus !== "OPEN" || !isInterviewApplicationEligible(app) || a.expiresAt <= await tx.sessions.now()) throw invitationNotFound();
      const created = await createInterviewSessionService({ transaction: work => work(tx.sessions) }).create(s, a.blueprintVersionId);
      // Check again after the approved-version lock may have waited.
      if (a.expiresAt <= await tx.sessions.now()) throw invitationNotFound();
      await tx.stamp(s, created.id, a.requestId, fingerprint, new Date(a.expiresAt));
      return { id: created.id };
    }),
    cancel: (rawScope: InterviewScope, id: string) => store.transaction(async tx => {
      const parsed = Scope.safeParse(rawScope);
      if (!parsed.success || !Id.safeParse(id).success || !await tx.authorizeCancellation(parsed.data)) throw invitationNotFound();
      const scope = parsed.data; const row = await tx.find(scope, id);
      if (!row?.invitedAt || !await tx.authorizeCancellation(scope)) throw invitationNotFound();
      if (!row.invitationCancelledAt) await tx.cancel(scope, id);
      return { id };
    }),
  };
}
