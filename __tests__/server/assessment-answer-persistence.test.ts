import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnswerPersistenceQueue,
  answerQueueStorageKey,
  type AnswerPersistenceStorage,
  type PersistAnswer,
  type PersistAnswerResult,
} from "@/lib/assessments/answer-persistence";

class MemoryStorage implements AnswerPersistenceStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AnswerPersistenceQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps an answer saving until the server acknowledges it", async () => {
    const request = deferred<{ ok: boolean; status: number }>();
    const persist: PersistAnswer = vi.fn(() => request.promise);
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-a",
      storage: new MemoryStorage(),
      persist,
      now: () => 100,
    });

    queue.select("question-a", ["option-a"], 4);

    expect(queue.getSnapshot().states["question-a"]?.status).toBe("saving");
    expect(queue.getSnapshot().states["question-a"]?.status).not.toBe("saved");

    request.resolve({ ok: true, status: 200 });
    await settle();

    expect(queue.getSnapshot().states["question-a"]?.status).toBe("saved");
    expect(queue.getSnapshot().pendingCount).toBe(0);
  });

  it("keeps a network failure unconfirmed and recovers on retry", async () => {
    const persist = vi
      .fn<PersistAnswer>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-a",
      storage: new MemoryStorage(),
      persist,
      now: () => 100,
      retryDelaysMs: [100],
    });

    queue.select("question-a", ["option-a"], 4);
    await settle();
    expect(queue.getSnapshot().states["question-a"]?.status).toBe("unconfirmed");

    await vi.advanceTimersByTimeAsync(100);
    await settle();

    expect(persist).toHaveBeenCalledTimes(2);
    expect(queue.getSnapshot().states["question-a"]?.status).toBe("saved");
  });

  it("retries a 500 response but does not retry 400 or 410 responses", async () => {
    const transient = vi
      .fn<PersistAnswer>()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const transientQueue = new AnswerPersistenceQueue({
      attemptId: "attempt-500",
      storage: new MemoryStorage(),
      persist: transient,
      retryDelaysMs: [50],
    });

    transientQueue.select("question-a", ["option-a"], 0);
    await vi.advanceTimersByTimeAsync(50);
    await settle();
    expect(transient).toHaveBeenCalledTimes(2);
    expect(transientQueue.getSnapshot().states["question-a"]?.status).toBe("saved");

    for (const status of [400, 410]) {
      const permanent = vi.fn<PersistAnswer>().mockResolvedValue({ ok: false, status });
      const queue = new AnswerPersistenceQueue({
        attemptId: `attempt-${status}`,
        storage: new MemoryStorage(),
        persist: permanent,
        retryDelaysMs: [10],
      });

      queue.select("question-a", ["option-a"], 0);
      await vi.runAllTimersAsync();
      await settle();
      queue.retryPending();
      await settle();

      expect(permanent).toHaveBeenCalledTimes(1);
      expect(queue.getSnapshot().states["question-a"]?.status).toBe("unconfirmed");
    }
  });

  it("serializes saves per question so the newest selection remains authoritative", async () => {
    const first = deferred<{ ok: boolean; status: number }>();
    const second = deferred<{ ok: boolean; status: number }>();
    const persist = vi
      .fn<PersistAnswer>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    let now = 100;
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-a",
      storage: new MemoryStorage(),
      persist,
      now: () => now++,
    });

    queue.select("question-a", ["option-a"], 1);
    queue.select("question-a", ["option-b"], 2);

    expect(persist).toHaveBeenCalledTimes(1);
    first.resolve({ ok: true, status: 200 });
    await settle();

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[1][0].selectedOptions).toEqual(["option-b"]);
    expect(queue.getSnapshot().states["question-a"]?.status).toBe("saving");

    second.resolve({ ok: true, status: 200 });
    await settle();

    expect(queue.getSnapshot().answers["question-a"]).toEqual(["option-b"]);
    expect(queue.getSnapshot().states["question-a"]?.status).toBe("saved");
  });

  it("reconciles reload state using timestamps and retries only a newer local answer", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      answerQueueStorageKey("attempt-a"),
      JSON.stringify({
        version: 1,
        entries: [{
          questionId: "question-a",
          selectedOptions: ["local-newer"],
          timeSpent: 8,
          updatedAt: 200,
          retryCount: 1,
        }],
      }),
    );
    const persist = vi.fn<PersistAnswer>().mockResolvedValue({ ok: true, status: 200 });
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-a",
      storage,
      persist,
      now: () => 300,
    });

    queue.hydrate({
      answers: { "question-a": ["server-older"], "question-b": ["server-newer"] },
      answeredAt: { "question-a": 100, "question-b": 400 },
    });
    await settle();

    expect(persist).toHaveBeenCalledOnce();
    expect(persist.mock.calls[0][0].selectedOptions).toEqual(["local-newer"]);
    expect(queue.getSnapshot().answers["question-b"]).toEqual(["server-newer"]);
  });

  it("normalizes a pending timestamp to the server clock before reload reconciliation", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      answerQueueStorageKey("attempt-clock-skew"),
      JSON.stringify({
        version: 1,
        entries: [{
          questionId: "question-a",
          selectedOptions: ["stale-local"],
          timeSpent: 4,
          updatedAt: 200_000,
          retryCount: 1,
        }],
      }),
    );
    const persist = vi.fn<PersistAnswer>().mockResolvedValue({ ok: true, status: 200 });
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-clock-skew",
      storage,
      persist,
    });

    queue.hydrate({
      answers: { "question-a": ["newer-server"] },
      answeredAt: { "question-a": 400 },
      clientToServerOffsetMs: -199_850,
    });
    await settle();

    expect(persist).not.toHaveBeenCalled();
    expect(queue.getSnapshot().answers["question-a"]).toEqual(["newer-server"]);
  });

  it("flushes pending answers before submit and reports a failed flush", async () => {
    const persist = vi
      .fn<PersistAnswer>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-a",
      storage: new MemoryStorage(),
      persist,
      retryDelaysMs: [10_000],
    });

    queue.select("question-a", ["option-a"], 1);
    await settle();
    const successfulFlush = await queue.flushPending(1_000);
    expect(successfulFlush).toEqual({ allConfirmed: true, pendingCount: 0 });

    const neverSaves = new AnswerPersistenceQueue({
      attemptId: "attempt-b",
      storage: new MemoryStorage(),
      persist: vi.fn<PersistAnswer>().mockRejectedValue(new TypeError("offline")),
      retryDelaysMs: [10_000],
    });
    neverSaves.select("question-b", ["option-b"], 1);
    await settle();

    const resultPromise = neverSaves.flushPending(100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(resultPromise).resolves.toEqual({ allConfirmed: false, pendingCount: 1 });
  });

  it("waits for the latest selection when a flush starts during an older save", async () => {
    const first = deferred<PersistAnswerResult>();
    const second = deferred<PersistAnswerResult>();
    const persist = vi
      .fn<PersistAnswer>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-submit-race",
      storage: new MemoryStorage(),
      persist,
    });

    queue.select("question-a", ["option-a"], 1);
    queue.select("question-a", ["option-b"], 2);
    const flush = queue.flushPending(1_000);

    first.resolve({ ok: true, status: 200 });
    await settle();
    expect(persist).toHaveBeenCalledTimes(2);

    second.resolve({ ok: true, status: 200 });
    await expect(flush).resolves.toEqual({ allConfirmed: true, pendingCount: 0 });
    expect(queue.getSnapshot().answers["question-a"]).toEqual(["option-b"]);
  });

  it("recovers a pending answer during the bounded timer-expiry flush", async () => {
    const persist = vi
      .fn<PersistAnswer>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-timer-recovered",
      storage: new MemoryStorage(),
      persist,
      retryDelaysMs: [10_000],
    });

    queue.select("question-a", ["option-a"], 1);
    await settle();

    await expect(queue.flushPending(2_500)).resolves.toEqual({
      allConfirmed: true,
      pendingCount: 0,
    });
  });

  it("reports the pending answer when timer expiry occurs while offline", async () => {
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-timer-offline",
      storage: new MemoryStorage(),
      persist: vi.fn<PersistAnswer>().mockRejectedValue(new TypeError("offline")),
      retryDelaysMs: [10_000],
    });

    queue.select("question-a", ["option-a"], 1);
    await settle();

    await expect(queue.flushPending(2_500)).resolves.toEqual({
      allConfirmed: false,
      pendingCount: 1,
    });
  });

  it("namespaces and clears queues independently per attempt", async () => {
    const storage = new MemoryStorage();
    const persist = vi.fn<PersistAnswer>().mockRejectedValue(new TypeError("offline"));
    const attemptA = new AnswerPersistenceQueue({
      attemptId: "attempt-a",
      storage,
      persist,
      retryDelaysMs: [],
    });
    const attemptB = new AnswerPersistenceQueue({
      attemptId: "attempt-b",
      storage,
      persist,
      retryDelaysMs: [],
    });

    attemptA.select("question-a", ["option-a"], 0);
    attemptB.select("question-b", ["option-b"], 0);
    await settle();

    expect(storage.getItem(answerQueueStorageKey("attempt-a"))).not.toBeNull();
    expect(storage.getItem(answerQueueStorageKey("attempt-b"))).not.toBeNull();

    attemptA.clear();
    expect(storage.getItem(answerQueueStorageKey("attempt-a"))).toBeNull();
    expect(storage.getItem(answerQueueStorageKey("attempt-b"))).not.toBeNull();
  });

  it("emits telemetry metadata without answer content", async () => {
    const events: unknown[] = [];
    const queue = new AnswerPersistenceQueue({
      attemptId: "attempt-a",
      storage: new MemoryStorage(),
      persist: vi.fn<PersistAnswer>().mockResolvedValue({ ok: false, status: 500 }),
      retryDelaysMs: [],
      onTelemetry: (event) => events.push(event),
    });

    queue.select("question-a", ["secret-option"], 1);
    await settle();

    expect(events).toContainEqual({
      name: "assessment_answer_save_failed",
      status: 500,
      retryCount: 1,
    });
    expect(JSON.stringify(events)).not.toContain("secret-option");
    expect(JSON.stringify(events)).not.toContain("question-a");
  });
});
