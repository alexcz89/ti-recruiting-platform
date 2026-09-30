export type AnswerSaveStatus = "saving" | "saved" | "unconfirmed";

export type PersistAnswerInput = {
  attemptId: string;
  questionId: string;
  selectedOptions: string[];
  timeSpent: number;
  updatedAt: number;
};

export type PersistAnswerResult = {
  ok: boolean;
  status: number;
};

export type PersistAnswer = (
  input: PersistAnswerInput,
) => Promise<PersistAnswerResult>;

export type AnswerPersistenceStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type AnswerPersistenceState = {
  questionId: string;
  selectedOptions: string[];
  status: AnswerSaveStatus;
  updatedAt: number;
  retryCount: number;
};

export type AnswerPersistenceSnapshot = {
  answers: Record<string, string[]>;
  states: Record<string, AnswerPersistenceState>;
  pendingCount: number;
};

export type AnswerServerSnapshot = {
  answers: Record<string, string[]>;
  answeredAt?: Record<string, number>;
  clientToServerOffsetMs?: number;
};

export function summarizeExpiredAnswers(answeredCount: number, pendingCount: number) {
  const safeAnsweredCount = Math.max(0, Math.floor(answeredCount));
  const unconfirmedCount = Math.min(
    safeAnsweredCount,
    Math.max(0, Math.floor(pendingCount)),
  );
  return {
    confirmedCount: safeAnsweredCount - unconfirmedCount,
    unconfirmedCount,
  };
}

export type AnswerPersistenceTelemetry =
  | { name: "assessment_answer_save_failed"; status: number | "network"; retryCount: number }
  | { name: "assessment_answer_save_recovered"; retryCount: number }
  | { name: "assessment_answer_save_latency"; latencyMs: number }
  | { name: "assessment_submit_with_pending"; pendingCount: number };

type PendingAnswer = {
  questionId: string;
  selectedOptions: string[];
  timeSpent: number;
  updatedAt: number;
  retryCount: number;
};

type InternalAnswerState = AnswerPersistenceState & {
  timeSpent: number;
  retryable: boolean;
  permanentFailure: boolean;
};

type StoredQueue = {
  version: 1;
  entries: PendingAnswer[];
};

type QueueOptions = {
  attemptId: string;
  storage: AnswerPersistenceStorage;
  persist: PersistAnswer;
  now?: () => number;
  retryDelaysMs?: number[];
  onPermanentFailure?: (status: number) => void;
  onTelemetry?: (event: AnswerPersistenceTelemetry) => void;
};

const DEFAULT_RETRY_DELAYS_MS = [500, 1_500, 3_000, 5_000, 10_000];

export function answerQueueStorageKey(attemptId: string) {
  return `assessment:${attemptId}:pendingAnswers:v1`;
}

function sameAnswer(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isTransientStatus(status: number) {
  return status >= 500 && status <= 599;
}

function sanitizeOptions(value: unknown) {
  if (!Array.isArray(value)) return null;
  const options = value
    .filter((option): option is string => typeof option === "string")
    .map((option) => option.trim())
    .filter(Boolean);
  return options.length > 0 ? Array.from(new Set(options)) : null;
}

function parseStoredQueue(raw: string | null): PendingAnswer[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<StoredQueue>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];

    return parsed.entries.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const questionId =
        typeof candidate.questionId === "string" ? candidate.questionId.trim() : "";
      const selectedOptions = sanitizeOptions(candidate.selectedOptions);
      const updatedAt = Number(candidate.updatedAt);
      if (!questionId || !selectedOptions || !Number.isFinite(updatedAt)) return [];

      return [{
        questionId,
        selectedOptions,
        timeSpent: Number.isFinite(Number(candidate.timeSpent))
          ? Math.max(0, Math.floor(Number(candidate.timeSpent)))
          : 0,
        updatedAt,
        retryCount: Number.isFinite(Number(candidate.retryCount))
          ? Math.max(0, Math.floor(Number(candidate.retryCount)))
          : 0,
      }];
    });
  } catch {
    return [];
  }
}

export class AnswerPersistenceQueue {
  private readonly attemptId: string;
  private readonly storage: AnswerPersistenceStorage;
  private readonly persist: PersistAnswer;
  private readonly now: () => number;
  private readonly retryDelaysMs: number[];
  private readonly onPermanentFailure?: (status: number) => void;
  private readonly onTelemetry?: (event: AnswerPersistenceTelemetry) => void;
  private readonly states = new Map<string, InternalAnswerState>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly listeners = new Set<() => void>();
  private snapshot: AnswerPersistenceSnapshot = {
    answers: {},
    states: {},
    pendingCount: 0,
  };
  private disposed = false;

  constructor(options: QueueOptions) {
    this.attemptId = options.attemptId;
    this.storage = options.storage;
    this.persist = options.persist;
    this.now = options.now ?? Date.now;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.onPermanentFailure = options.onPermanentFailure;
    this.onTelemetry = options.onTelemetry;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  hydrate(server: AnswerServerSnapshot) {
    this.cancelRetryTimers();
    this.states.clear();

    for (const [questionId, selectedOptions] of Object.entries(server.answers)) {
      const normalized = sanitizeOptions(selectedOptions);
      if (!normalized) continue;
      this.states.set(questionId, {
        questionId,
        selectedOptions: normalized,
        status: "saved",
        updatedAt: server.answeredAt?.[questionId] ?? 0,
        retryCount: 0,
        timeSpent: 0,
        retryable: false,
        permanentFailure: false,
      });
    }

    let storedQueue: string | null = null;
    try {
      storedQueue = this.storage.getItem(answerQueueStorageKey(this.attemptId));
    } catch {
      // Persistence can still operate in memory when browser storage is unavailable.
    }
    const localEntries = parseStoredQueue(storedQueue);

    for (const local of localEntries) {
      const serverUpdatedAt = server.answeredAt?.[local.questionId] ?? 0;
      const serverState = this.states.get(local.questionId);
      const localUpdatedAtOnServerClock =
        local.updatedAt + (server.clientToServerOffsetMs ?? 0);
      const localIsNewer = localUpdatedAtOnServerClock > serverUpdatedAt;
      const differsFromServer = !serverState ||
        !sameAnswer(serverState.selectedOptions, local.selectedOptions);

      if (!localIsNewer || !differsFromServer) continue;

      this.states.set(local.questionId, {
        ...local,
        status: "unconfirmed",
        retryable: true,
        permanentFailure: false,
      });
    }

    this.persistQueue();
    this.emit();
    this.retryPending();
  }

  select(questionId: string, selectedOptions: string[], timeSpent: number) {
    if (this.disposed) return;
    const normalized = sanitizeOptions(selectedOptions);
    if (!questionId || !normalized) return;

    const previous = this.states.get(questionId);
    const updatedAt = Math.max(this.now(), (previous?.updatedAt ?? 0) + 1);
    this.states.set(questionId, {
      questionId,
      selectedOptions: normalized,
      status: "saving",
      updatedAt,
      retryCount: 0,
      timeSpent: Math.max(0, Math.floor(timeSpent || 0)),
      retryable: true,
      permanentFailure: false,
    });
    this.persistQueue();
    this.emit();
    void this.processQuestion(questionId);
  }

  retryPending() {
    if (this.disposed) return;
    for (const state of this.states.values()) {
      if (state.status === "saved") continue;
      if (state.permanentFailure) continue;
      state.retryable = true;
      this.cancelRetryTimer(state.questionId);
      void this.processQuestion(state.questionId, true);
    }
  }

  async flushPending(timeoutMs: number) {
    if (this.disposed) {
      return { allConfirmed: false, pendingCount: this.snapshot.pendingCount };
    }

    const pendingBeforeFlush = this.snapshot.pendingCount;
    if (pendingBeforeFlush > 0) {
      this.onTelemetry?.({
        name: "assessment_submit_with_pending",
        pendingCount: pendingBeforeFlush,
      });
    }

    const deadline = Date.now() + Math.max(0, timeoutMs);
    this.retryPending();

    while (this.snapshot.pendingCount > 0) {
      const active = Array.from(this.inFlight.values());
      const remainingMs = Math.max(0, deadline - Date.now());
      if (remainingMs === 0) break;

      if (active.length === 0) {
        const hasRetryablePending = Array.from(this.states.values()).some(
          (state) =>
            state.status !== "saved" &&
            state.retryable &&
            !state.permanentFailure,
        );
        if (!hasRetryablePending) break;

        await new Promise<void>((resolve) => {
          setTimeout(resolve, Math.min(25, remainingMs));
        });
        continue;
      }

      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      await Promise.race([
        Promise.allSettled(active),
        new Promise<void>((resolve) => {
          timeout = setTimeout(() => {
            timedOut = true;
            resolve();
          }, remainingMs);
        }),
      ]);
      if (timeout) clearTimeout(timeout);
      if (timedOut) break;
    }

    return {
      allConfirmed: this.snapshot.pendingCount === 0,
      pendingCount: this.snapshot.pendingCount,
    };
  }

  clear() {
    this.cancelRetryTimers();
    this.states.clear();
    try {
      this.storage.removeItem(answerQueueStorageKey(this.attemptId));
    } catch {
      // Nothing else to clear when browser storage is unavailable.
    }
    this.emit();
  }

  dispose() {
    this.disposed = true;
    this.cancelRetryTimers();
    this.listeners.clear();
  }

  private async processQuestion(questionId: string, force = false) {
    if (this.disposed || this.inFlight.has(questionId)) return;
    const state = this.states.get(questionId);
    if (!state || state.status === "saved") return;
    if (!force && !state.retryable) return;

    this.cancelRetryTimer(questionId);
    const sent = {
      attemptId: this.attemptId,
      questionId: state.questionId,
      selectedOptions: [...state.selectedOptions],
      timeSpent: state.timeSpent,
      updatedAt: state.updatedAt,
    };
    state.status = "saving";
    this.emit();

    const requestStartedAt = this.now();
    const request = (async () => {
      try {
        const result = await this.persist(sent);
        if (result.ok) {
          this.handleSuccess(sent, Math.max(0, this.now() - requestStartedAt));
          return;
        }
        this.handleFailure(sent, result.status, isTransientStatus(result.status));
      } catch {
        this.handleFailure(sent, "network", true);
      } finally {
        this.inFlight.delete(questionId);
        const latest = this.states.get(questionId);
        if (latest && latest.status !== "saved" && latest.updatedAt !== sent.updatedAt) {
          void this.processQuestion(questionId, true);
        }
      }
    })();

    this.inFlight.set(questionId, request);
    await request;
  }

  private handleSuccess(sent: PersistAnswerInput, latencyMs: number) {
    if (this.disposed) return;
    const current = this.states.get(sent.questionId);
    if (!current || current.updatedAt !== sent.updatedAt) return;

    const recovered = current.retryCount > 0;
    current.status = "saved";
    current.retryable = false;
    current.permanentFailure = false;
    this.onTelemetry?.({ name: "assessment_answer_save_latency", latencyMs });
    if (recovered) {
      this.onTelemetry?.({
        name: "assessment_answer_save_recovered",
        retryCount: current.retryCount,
      });
    }
    this.persistQueue();
    this.emit();
  }

  private handleFailure(
    sent: PersistAnswerInput,
    status: number | "network",
    transient: boolean,
  ) {
    if (this.disposed) return;
    const current = this.states.get(sent.questionId);
    if (!current || current.updatedAt !== sent.updatedAt) return;

    current.status = "unconfirmed";
    current.retryCount += 1;
    current.retryable = transient;
    current.permanentFailure = !transient;
    this.onTelemetry?.({
      name: "assessment_answer_save_failed",
      status,
      retryCount: current.retryCount,
    });
    this.persistQueue();
    this.emit();

    if (!transient) {
      if (typeof status === "number") this.onPermanentFailure?.(status);
      return;
    }

    const delay = this.retryDelaysMs[current.retryCount - 1];
    if (typeof delay !== "number") {
      current.retryable = false;
      return;
    }

    const timer = setTimeout(() => {
      this.retryTimers.delete(sent.questionId);
      void this.processQuestion(sent.questionId, true);
    }, delay);
    this.retryTimers.set(sent.questionId, timer);
  }

  private persistQueue() {
    const entries: PendingAnswer[] = [];
    for (const state of this.states.values()) {
      if (state.status === "saved") continue;
      entries.push({
        questionId: state.questionId,
        selectedOptions: [...state.selectedOptions],
        timeSpent: state.timeSpent,
        updatedAt: state.updatedAt,
        retryCount: state.retryCount,
      });
    }

    const key = answerQueueStorageKey(this.attemptId);
    if (entries.length === 0) {
      try {
        this.storage.removeItem(key);
      } catch {
        // Storage is best-effort; the in-memory queue remains authoritative for this tab.
      }
      return;
    }

    const value: StoredQueue = { version: 1, entries };
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage is best-effort; network persistence and visible status still work.
    }
  }

  private emit() {
    const answers: Record<string, string[]> = {};
    const states: Record<string, AnswerPersistenceState> = {};
    let pendingCount = 0;

    for (const state of this.states.values()) {
      answers[state.questionId] = [...state.selectedOptions];
      states[state.questionId] = {
        questionId: state.questionId,
        selectedOptions: [...state.selectedOptions],
        status: state.status,
        updatedAt: state.updatedAt,
        retryCount: state.retryCount,
      };
      if (state.status !== "saved") pendingCount += 1;
    }

    this.snapshot = { answers, states, pendingCount };
    for (const listener of this.listeners) listener();
  }

  private cancelRetryTimer(questionId: string) {
    const timer = this.retryTimers.get(questionId);
    if (timer) clearTimeout(timer);
    this.retryTimers.delete(questionId);
  }

  private cancelRetryTimers() {
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
  }
}
