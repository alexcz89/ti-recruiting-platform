import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { applyInterviewCommand, createInterviewSession, InterviewCommandSchema, INTERVIEW_CONVERSATION_LIMITS, type InterviewSession } from "./ai-interview-conversation-core";

const id = z.string().min(1).max(200).refine(value => value.trim().length > 0);
const ScopeSchema = z.object({ actorId: id, companyId: id, candidateId: id, applicationId: id }).strict();
export type InterviewScope = z.infer<typeof ScopeSchema>;
export type StoredInterview = { id: string; companyId: string; candidateId: string; applicationId: string; version: number; snapshot: unknown };
export interface InterviewTransaction {
  authorize(scope: InterviewScope): Promise<boolean>;
  find(scope: InterviewScope, sessionId: string, lock: boolean): Promise<StoredInterview | null>;
  now(): Promise<number>;
  insert(scope: InterviewScope, snapshot: InterviewSession): Promise<StoredInterview>;
  update(scope: InterviewScope, row: StoredInterview, snapshot: InterviewSession): Promise<boolean>;
}
export interface InterviewStore { transaction<T>(work: (tx: InterviewTransaction) => Promise<T>): Promise<T> }
export class InterviewPersistenceError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "VERSION_CONFLICT" | "INVALID_SNAPSHOT" | "APPROVAL_REQUIRED") {
    super(code); this.name = "InterviewPersistenceError";
  }
}

/** Validate through the unchanged core. Replaying the initial START validates all
 * state invariants and its receipt, and returns a fresh copy without processing a turn.
 * READY has no receipt: compare against the only valid initial state.
 * JSONB object key ordering is deliberately ignored. No arbitrary JSON is trusted.
 */
export function validateStoredInterview(value: unknown): InterviewSession {
  try {
    const envelope = z.object({ blueprint: z.unknown(), status: z.string(), commands: z.array(z.object({ commandId: id }).passthrough()).max(INTERVIEW_CONVERSATION_LIMITS.maxCommands) }).passthrough().parse(value);
    if (envelope.status === "READY") {
      const initial = createInterviewSession(envelope.blueprint);
      if (!isDeepStrictEqual(value, initial)) throw new Error();
      return initial;
    }
    return applyInterviewCommand(value as InterviewSession, { type: "START_INTERVIEW", commandId: envelope.commands[0]?.commandId }, 0);
  } catch { throw new InterviewPersistenceError("INVALID_SNAPSHOT"); }
}

/** Internal server callers only. actorId MUST come from authenticated server context.
 * Approval is deny-by-default, not a client boolean. This module exposes internal
 * snapshots, never HTTP DTOs. Candidate-facing access requires a future projection.
 */
export function createInterviewSessionService(store: InterviewStore, approve: (scope: InterviewScope, blueprint: InterviewSession["blueprint"]) => Promise<boolean> = async () => false) {
  async function authorized(tx: InterviewTransaction, raw: InterviewScope) {
    const parsed = ScopeSchema.safeParse(raw);
    if (!parsed.success) throw new InterviewPersistenceError("NOT_FOUND");
    const scope = parsed.data;
    if (!await tx.authorize(scope)) throw new InterviewPersistenceError("NOT_FOUND");
    return scope;
  }
  async function load(tx: InterviewTransaction, scope: InterviewScope, sessionId: string, lock: boolean) {
    const row = await tx.find(scope, id.parse(sessionId), lock);
    if (!row || row.companyId !== scope.companyId || row.candidateId !== scope.candidateId || row.applicationId !== scope.applicationId) throw new InterviewPersistenceError("NOT_FOUND");
    if (!Number.isSafeInteger(row.version) || row.version < 0) throw new InterviewPersistenceError("INVALID_SNAPSHOT");
    const snapshot = validateStoredInterview(row.snapshot);
    if (row.version !== snapshot.commands.length) throw new InterviewPersistenceError("INVALID_SNAPSHOT");
    return { ...row, snapshot };
  }
  return {
    create: (scope: InterviewScope, blueprint: unknown) => store.transaction(async tx => {
      scope = await authorized(tx, scope);
      const snapshot = createInterviewSession(blueprint);
      if (!await approve({ ...scope }, structuredClone(snapshot.blueprint))) throw new InterviewPersistenceError("APPROVAL_REQUIRED");
      const row = await tx.insert(scope, snapshot);
      return { ...row, snapshot: validateStoredInterview(row.snapshot) };
    }),
    read: (scope: InterviewScope, sessionId: string) => store.transaction(async tx => load(tx, await authorized(tx, scope), sessionId, false)),
    execute: (scope: InterviewScope, sessionId: string, expectedVersion: number, rawCommand: unknown) => store.transaction(async tx => {
      scope = await authorized(tx, scope);
      const row = await load(tx, scope, sessionId, true);
      const command = InterviewCommandSchema.parse(rawCommand);
      z.number().int().min(0).max(INTERVIEW_CONVERSATION_LIMITS.maxCommands).parse(expectedVersion);
      const replay = row.snapshot.commands.some(receipt => receipt.commandId === command.commandId);
      if (!replay && expectedVersion !== row.version) throw new InterviewPersistenceError("VERSION_CONFLICT");
      // clock_timestamp, sampled AFTER acquiring the row lock, not transaction start.
      const next = applyInterviewCommand(row.snapshot, command, await tx.now());
      if (replay) return row;
      if (!await tx.update(scope, row, next)) throw new InterviewPersistenceError("VERSION_CONFLICT");
      return { ...row, version: row.version + 1, snapshot: next };
    }),
  };
}
