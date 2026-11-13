import "server-only";
import { z } from "zod";
import { InterviewCommandSchema, type InterviewSession } from "./ai-interview-conversation-core";
import { executeInterviewSessionCommand, validateStoredInterview, InterviewPersistenceError } from "./ai-interview-session-service";
import { isInterviewApplicationEligible, isInterviewApplicationContinuationEligible, invitationNotFound, type InvitationStore, type InterviewInvitation, type InvitationTransaction } from "./ai-interview-invitation-service";

/** Explicit allow-list; no blueprint, rubric, receipts, approval or recruiter data. */
export function projectCandidateInterview(row: Pick<InterviewInvitation, "id" | "version">, state: InterviewSession) {
  return {
    id: row.id, version: row.version, status: state.status, phase: state.phase,
    startedAt: state.startedAt, expiresAt: state.expiresAt, endedAt: state.endedAt,
    currentQuestion: state.currentQuestion ? { turnId: state.currentQuestion.turnId, text: state.currentQuestion.text, kind: state.currentQuestion.kind } : null,
    answers: state.history.filter(turn => turn.answeredAt !== null).map(turn => ({
      turnId: turn.question.turnId, question: turn.question.text, answer: turn.answer,
      skipped: turn.skipped, answeredAt: turn.answeredAt,
    })),
  };
}
const Id = z.string().min(1).max(200).refine(v => v.trim() === v);
/** actorId MUST be sourced from authenticated server context, not a request body.
 * The identity provider is wired by trusted server code, never from request data.
 * Methods accept session IDs and commands only; tenant/application scope is
 * derived from the persisted, candidate-owned row. Cancellation/ineligibility
 * blocks access (including replays); snapshots remain available internally.
 * Invitation expiry only gates the initial start. Job closure alone does not
 * invalidate an already issued invitation. The core owns the running deadline.
 */
export function createCandidateInterviewService(store: InvitationStore, authenticatedActor: () => Promise<string | null>) {
  async function access<T>(actorId: string, id: string, work: (tx: InvitationTransaction, row: InterviewInvitation, state: InterviewSession) => Promise<T>) {
    if (!Id.safeParse(actorId).success || !Id.safeParse(id).success) throw invitationNotFound();
    return store.transaction(async tx => {
      const row = await tx.candidate(actorId, id); // Locks session, rechecks persisted identity.
      if (!row || row.candidateId !== actorId || !row.invitedAt || !row.invitedById || !row.invitationExpiresAt || row.invitationCancelledAt) throw invitationNotFound();
      const app = await tx.application({ actorId, companyId: row.companyId, candidateId: actorId, applicationId: row.applicationId });
      if (!app) throw invitationNotFound();
      const state = validateStoredInterview(row.snapshot);
      if (row.version !== state.commands.length) throw new InterviewPersistenceError("INVALID_SNAPSHOT");
      const eligible = state.status === "READY"
        ? isInterviewApplicationEligible(app)
        : isInterviewApplicationContinuationEligible(app);
      if (!eligible) throw invitationNotFound();
      return work(tx, row, state);
    });
  }
  return {
    read: async (id: string) => access(await authenticatedActor() ?? "", id, async (_tx, row, state) => projectCandidateInterview(row, state)),
    execute: async (id: string, expectedVersion: number, rawCommand: unknown) => access(await authenticatedActor() ?? "", id, async (tx, row, state) => {
      const command = InterviewCommandSchema.parse(rawCommand);
      if (!["START_INTERVIEW", "SUBMIT_ANSWER", "SKIP_QUESTION"].includes(command.type)) throw invitationNotFound();
      if (state.status === "READY" && row.invitationExpiresAt!.getTime() <= await tx.sessions.now()) throw invitationNotFound();
      const result = await executeInterviewSessionCommand(tx.sessions,
        { actorId: row.candidateId, companyId: row.companyId, candidateId: row.candidateId, applicationId: row.applicationId },
        { ...row, snapshot: state }, expectedVersion, command);
      return projectCandidateInterview(result, result.snapshot);
    }),
  };
}
