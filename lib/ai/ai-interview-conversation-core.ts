import { createHash } from "node:crypto";
import { z } from "zod";
import { AI_INTERVIEW_PLAN_LIMITS } from "./ai-interview-plan-contract";
import { InterviewBlueprintSchema, INTERVIEW_BLUEPRINT_LIMITS } from "./ai-interview-blueprint-contract";

const MAX_TURNS = AI_INTERVIEW_PLAN_LIMITS.maxQuestions.max * (1 + AI_INTERVIEW_PLAN_LIMITS.maxFollowUpsPerQuestion.max);
export const INTERVIEW_CONVERSATION_LIMITS = {
  idLength: 200, answerLength: 12_000, maxTurns: MAX_TURNS, maxCommands: 2 * MAX_TURNS + 2,
} as const;
const identifier = z.string().min(1).max(INTERVIEW_CONVERSATION_LIMITS.idLength).refine(value => value.trim().length > 0);
const timestamp = z.number().finite().int().min(0).max(Number.MAX_SAFE_INTEGER);
const answerText = z.string().max(INTERVIEW_CONVERSATION_LIMITS.answerLength).refine(value => value.trim().length > 0);
const questionText = z.string().max(INTERVIEW_BLUEPRINT_LIMITS.questionLength).refine(value => value.trim().length > 0);

export const InterviewAIDecisionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("FOLLOW_UP"), turnId: identifier, questionText }).strict(),
  z.object({ type: z.literal("ADVANCE"), turnId: identifier }).strict(),
]);
export const InterviewCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START_INTERVIEW"), commandId: identifier }).strict(),
  z.object({ type: z.literal("SUBMIT_ANSWER"), commandId: identifier, turnId: identifier, answer: answerText }).strict(),
  z.object({ type: z.literal("SKIP_QUESTION"), commandId: identifier, turnId: identifier }).strict(),
  z.object({ type: z.literal("APPLY_AI_DECISION"), commandId: identifier, decision: InterviewAIDecisionSchema }).strict(),
  z.object({ type: z.literal("EXPIRE_INTERVIEW"), commandId: identifier }).strict(),
]);
export type InterviewCommand = z.infer<typeof InterviewCommandSchema>;
export type InterviewAIDecision = z.infer<typeof InterviewAIDecisionSchema>;

const QuestionSchema = z.object({
  turnId: identifier, mainQuestionId: identifier, competencyId: identifier,
  kind: z.enum(["MAIN", "FOLLOW_UP"]), text: questionText,
}).strict();
const TurnSchema = z.object({
  question: QuestionSchema, askedAt: timestamp,
  answer: answerText.nullable(), answeredAt: timestamp.nullable(), skipped: z.boolean(),
  decision: z.enum(["FOLLOW_UP", "ADVANCE"]).nullable(), resolvedAt: timestamp.nullable(),
}).strict();
const SessionSchema = z.object({
  blueprint: InterviewBlueprintSchema,
  status: z.enum(["READY", "IN_PROGRESS", "COMPLETED", "EXPIRED"]),
  phase: z.enum(["AWAITING_ANSWER", "AWAITING_AI_DECISION"]).nullable(),
  currentQuestion: QuestionSchema.nullable(),
  mainQuestionIndex: z.number().int().min(0).max(AI_INTERVIEW_PLAN_LIMITS.maxQuestions.max),
  followUpsUsed: z.number().int().min(0).max(AI_INTERVIEW_PLAN_LIMITS.maxFollowUpsPerQuestion.max),
  history: z.array(TurnSchema).max(MAX_TURNS),
  startedAt: timestamp.nullable(), expiresAt: timestamp.nullable(), endedAt: timestamp.nullable(),
  completionReason: z.enum(["QUESTIONS_EXHAUSTED", "TIME_LIMIT"]).nullable(),
  expiration: z.object({
    pendingTurnId: identifier,
    unaskedMainQuestionIds: z.array(identifier).max(AI_INTERVIEW_PLAN_LIMITS.maxQuestions.max),
  }).strict().nullable(),
  // Fixed-size fingerprints retain identity without storing another copy of answers.
  // Only accepted commands are recorded; session limits bound the receipt count.
  commands: z.array(z.object({ commandId: identifier, fingerprint: z.string().regex(/^[a-f0-9]{64}$/), appliedAt: timestamp }).strict())
    .max(INTERVIEW_CONVERSATION_LIMITS.maxCommands),
}).strict();

/** Internal domain state, including configuration and receipts. NOT a candidate HTTP payload.
 * Pure idempotency does not coordinate servers; trusted persistence is a later boundary.
 */
export type InterviewSession = z.infer<typeof SessionSchema>;

const errors = {
  INVALID_BLUEPRINT: "El blueprint de entrevista no es válido.",
  INVALID_STATE: "El estado de entrevista no es válido.",
  INVALID_COMMAND: "El comando o la decisión de IA no es válido.",
  INVALID_TIME: "La hora debe ser válida y no retroceder respecto al último comando aceptado.",
  COMMAND_CONFLICT: "El ID ya fue utilizado con otro contenido.",
  COMMAND_LIMIT: "Se alcanzó el límite de comandos de la sesión.",
  SESSION_TERMINAL: "La entrevista ya finalizó.",
  INVALID_PHASE: "El comando no corresponde al estado o fase actual.",
  TURN_MISMATCH: "El comando no corresponde al turno pendiente.",
  INTERVIEW_EXPIRED: "La entrevista venció. Debe cerrarse mediante EXPIRE_INTERVIEW.",
  NOT_EXPIRED: "La entrevista todavía no ha vencido.",
  FOLLOW_UP_LIMIT: "Se alcanzó el límite de seguimientos. Se requiere una decisión ADVANCE.",
} as const;
export class InterviewConversationError extends Error {
  constructor(public readonly code: keyof typeof errors) { super(errors[code]); this.name = "InterviewConversationError"; }
}
function requireState(condition: unknown): asserts condition {
  if (!condition) throw new InterviewConversationError("INVALID_STATE");
}

// Validate structural and conversational invariants, not authenticity or approval.
// Zod creates fresh objects/arrays so frozen inputs are safe and outputs share no input references.
function readSession(input: unknown): InterviewSession {
  const parsed = SessionSchema.safeParse(input);
  if (!parsed.success) throw new InterviewConversationError("INVALID_STATE");
  const state = parsed.data;
  const { questions, plan } = state.blueprint;
  requireState(new Set(state.commands.map(command => command.commandId)).size === state.commands.length);
  requireState(state.commands.length <= 2 * questions.length * (1 + plan.maxFollowUpsPerQuestion) + 2);
  if (state.status === "READY") {
    requireState(state.phase === null && state.currentQuestion === null && state.history.length === 0 && state.commands.length === 0 &&
      state.startedAt === null && state.expiresAt === null && state.endedAt === null && state.completionReason === null && state.expiration === null &&
      state.mainQuestionIndex === 0 && state.followUpsUsed === 0);
    return state;
  }
  requireState(state.startedAt !== null && state.expiresAt === state.startedAt + plan.timeLimitMinutes * 60_000 && state.history.length > 0);
  const expiresAt = state.expiresAt!;
  let mainIndex = 0, followUps = 0, expectedCommands = 1;
  state.history.forEach((turn, index) => {
    const main = questions[mainIndex];
    requireState(main && turn.question.turnId === `turn-${index + 1}` && turn.question.mainQuestionId === main.id &&
      turn.question.competencyId === main.competencyId && turn.question.kind === (followUps === 0 ? "MAIN" : "FOLLOW_UP"));
    if (followUps === 0) requireState(turn.question.text === main.text);
    requireState(turn.askedAt === (index === 0 ? state.startedAt : state.history[index - 1].resolvedAt) && turn.askedAt < expiresAt);
    const answered = turn.answer !== null, resolved = turn.skipped || turn.decision !== null;
    requireState(answered === (turn.answeredAt !== null) && resolved === (turn.resolvedAt !== null));
    requireState(!turn.skipped || (!answered && turn.decision === null));
    requireState(turn.decision === null || answered);
    if (answered) requireState(turn.answeredAt! >= turn.askedAt && turn.answeredAt! < expiresAt);
    if (resolved) requireState(turn.resolvedAt! >= (turn.answeredAt ?? turn.askedAt) && turn.resolvedAt! < expiresAt);
    else requireState(index === state.history.length - 1);
    expectedCommands += Number(answered) + Number(resolved);
    if (turn.decision === "FOLLOW_UP") { followUps++; requireState(followUps <= plan.maxFollowUpsPerQuestion); }
    else if (resolved) { mainIndex++; followUps = 0; }
  });
  const last = state.history[state.history.length - 1];
  requireState(state.mainQuestionIndex === mainIndex && state.followUpsUsed === followUps);
  requireState(state.commands.length === expectedCommands + Number(state.status === "EXPIRED"));
  requireState(state.commands[0]?.appliedAt === state.startedAt);
  state.commands.forEach((command, index) => {
    requireState(command.appliedAt >= (index === 0 ? state.startedAt! : state.commands[index - 1].appliedAt));
    requireState(state.status === "EXPIRED" && index === state.commands.length - 1 ? command.appliedAt === state.endedAt : command.appliedAt < expiresAt);
  });
  if (state.status === "COMPLETED") {
    requireState(mainIndex === questions.length && state.currentQuestion === null && state.phase === null &&
      state.completionReason === "QUESTIONS_EXHAUSTED" && state.expiration === null && state.endedAt === last.resolvedAt);
  } else {
    requireState(mainIndex < questions.length && last.resolvedAt === null);
    if (state.status === "IN_PROGRESS") {
      requireState(state.currentQuestion && JSON.stringify(state.currentQuestion) === JSON.stringify(last.question) &&
        state.phase === (last.answer === null ? "AWAITING_ANSWER" : "AWAITING_AI_DECISION") &&
        state.endedAt === null && state.completionReason === null && state.expiration === null);
    } else {
      requireState(state.phase === null && state.currentQuestion === null && state.endedAt !== null && state.endedAt >= expiresAt &&
        state.completionReason === "TIME_LIMIT" && state.expiration?.pendingTurnId === last.question.turnId &&
        JSON.stringify(state.expiration.unaskedMainQuestionIds) === JSON.stringify(questions.slice(mainIndex + 1).map(question => question.id)));
    }
  }
  requireState(state.commands[state.commands.length - 1]?.appliedAt ===
    (state.endedAt ?? last.resolvedAt ?? last.answeredAt ?? last.askedAt));
  return state;
}

export function createInterviewSession(input: unknown): InterviewSession {
  const blueprint = InterviewBlueprintSchema.safeParse(input);
  if (!blueprint.success) throw new InterviewConversationError("INVALID_BLUEPRINT");
  return {
    blueprint: blueprint.data, status: "READY", phase: null, currentQuestion: null,
    mainQuestionIndex: 0, followUpsUsed: 0, history: [], commands: [],
    startedAt: null, expiresAt: null, endedAt: null, completionReason: null, expiration: null,
  };
}

function presentQuestion(state: InterviewSession, text: string, kind: "MAIN" | "FOLLOW_UP", now: number) {
  const main = state.blueprint.questions[state.mainQuestionIndex];
  state.currentQuestion = { turnId: `turn-${state.history.length + 1}`, mainQuestionId: main.id, competencyId: main.competencyId, text, kind };
  state.history.push({ question: { ...state.currentQuestion }, askedAt: now, answer: null, answeredAt: null, skipped: false, decision: null, resolvedAt: null });
  state.phase = "AWAITING_ANSWER";
}
function advance(state: InterviewSession, now: number) {
  state.mainQuestionIndex++;
  state.followUpsUsed = 0;
  if (state.mainQuestionIndex === state.blueprint.questions.length) {
    state.status = "COMPLETED"; state.phase = null; state.currentQuestion = null;
    state.completionReason = "QUESTIONS_EXHAUSTED"; state.endedAt = now;
  } else presentQuestion(state, state.blueprint.questions[state.mainQuestionIndex].text, "MAIN", now);
}

/** now is an authoritative external epoch timestamp in milliseconds, never read here.
 * At now >= expiresAt ALL new ordinary commands fail without changing state, even
 * before EXPIRE_INTERVIEW runs. Explicit expiry preserves history and marks pending work.
 * Identical accepted commands are no-op replays (including terminal/late replays);
 * they never reprocess an answer/decision or reset time. Invalid commands reserve no ID.
 */
export function applyInterviewCommand(input: InterviewSession, rawCommand: InterviewCommand, now: number): InterviewSession {
  const state = readSession(input);
  const parsed = InterviewCommandSchema.safeParse(rawCommand);
  if (!parsed.success) throw new InterviewConversationError("INVALID_COMMAND");
  if (!timestamp.safeParse(now).success) throw new InterviewConversationError("INVALID_TIME");
  const command = parsed.data;
  // Schema parsing fixes property order; execution time is deliberately not command content.
  const fingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  const prior = state.commands.find(receipt => receipt.commandId === command.commandId);
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new InterviewConversationError("COMMAND_CONFLICT");
    return state;
  }
  if (state.status === "COMPLETED" || state.status === "EXPIRED") throw new InterviewConversationError("SESSION_TERMINAL");
  if (now < (state.commands[state.commands.length - 1]?.appliedAt ?? 0)) throw new InterviewConversationError("INVALID_TIME");
  if (state.status === "IN_PROGRESS" && command.type !== "EXPIRE_INTERVIEW" && now >= state.expiresAt!) {
    throw new InterviewConversationError("INTERVIEW_EXPIRED");
  }
  if (state.commands.length >= 2 * state.blueprint.questions.length * (1 + state.blueprint.plan.maxFollowUpsPerQuestion) + 2) {
    throw new InterviewConversationError("COMMAND_LIMIT");
  }
  if (command.type === "START_INTERVIEW") {
    if (state.status !== "READY") throw new InterviewConversationError("INVALID_PHASE");
    const expiresAt = now + state.blueprint.plan.timeLimitMinutes * 60_000;
    if (!Number.isSafeInteger(expiresAt)) throw new InterviewConversationError("INVALID_TIME");
    state.startedAt = now; state.expiresAt = expiresAt; state.status = "IN_PROGRESS";
    presentQuestion(state, state.blueprint.questions[0].text, "MAIN", now);
  } else {
    if (state.status !== "IN_PROGRESS") throw new InterviewConversationError("INVALID_PHASE");
    if (command.type === "EXPIRE_INTERVIEW") {
      if (now < state.expiresAt!) throw new InterviewConversationError("NOT_EXPIRED");
      state.expiration = {
        pendingTurnId: state.currentQuestion!.turnId,
        unaskedMainQuestionIds: state.blueprint.questions.slice(state.mainQuestionIndex + 1).map(question => question.id),
      };
      state.status = "EXPIRED"; state.phase = null; state.currentQuestion = null;
      state.completionReason = "TIME_LIMIT"; state.endedAt = now;
    } else {
      const turnId = command.type === "APPLY_AI_DECISION" ? command.decision.turnId : command.turnId;
      if (turnId !== state.currentQuestion!.turnId) throw new InterviewConversationError("TURN_MISMATCH");
      const turn = state.history[state.history.length - 1];
      if (command.type === "APPLY_AI_DECISION") {
        if (state.phase !== "AWAITING_AI_DECISION") throw new InterviewConversationError("INVALID_PHASE");
        if (command.decision.type === "FOLLOW_UP" && state.followUpsUsed >= state.blueprint.plan.maxFollowUpsPerQuestion) {
          throw new InterviewConversationError("FOLLOW_UP_LIMIT");
        }
        turn.decision = command.decision.type; turn.resolvedAt = now;
        if (command.decision.type === "ADVANCE") advance(state, now);
        else { state.followUpsUsed++; presentQuestion(state, command.decision.questionText, "FOLLOW_UP", now); }
      } else {
        if (state.phase !== "AWAITING_ANSWER") throw new InterviewConversationError("INVALID_PHASE");
        if (command.type === "SUBMIT_ANSWER") {
          turn.answer = command.answer; turn.answeredAt = now; state.phase = "AWAITING_AI_DECISION";
        } else { turn.skipped = true; turn.resolvedAt = now; advance(state, now); }
      }
    }
  }
  state.commands.push({ commandId: command.commandId, fingerprint, appliedAt: now });
  return readSession(state);
}
