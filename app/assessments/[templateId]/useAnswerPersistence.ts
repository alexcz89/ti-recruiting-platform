'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnswerPersistenceQueue,
  type AnswerPersistenceSnapshot,
  type AnswerServerSnapshot,
} from '@/lib/assessments/answer-persistence';

type UseAnswerPersistenceOptions = {
  attemptId: string | null;
  serverSnapshot: AnswerServerSnapshot | null;
  onAnswersChange: (answers: Record<string, string[]>) => void;
  onExpired: () => void;
};

const EMPTY_SNAPSHOT: AnswerPersistenceSnapshot = {
  answers: {},
  states: {},
  pendingCount: 0,
};

export function useAnswerPersistence({
  attemptId,
  serverSnapshot,
  onAnswersChange,
  onExpired,
}: UseAnswerPersistenceOptions) {
  const queueRef = useRef<AnswerPersistenceQueue | null>(null);
  const onAnswersChangeRef = useRef(onAnswersChange);
  const onExpiredRef = useRef(onExpired);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [readyAttemptId, setReadyAttemptId] = useState<string | null>(null);

  useEffect(() => {
    onAnswersChangeRef.current = onAnswersChange;
  }, [onAnswersChange]);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    if (!attemptId || !serverSnapshot || typeof window === 'undefined') {
      queueRef.current?.dispose();
      queueRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
      setReadyAttemptId(null);
      return;
    }

    setReadyAttemptId(null);
    const queue = new AnswerPersistenceQueue({
      attemptId,
      storage: window.localStorage,
      persist: async ({ questionId, selectedOptions, timeSpent }) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);
        try {
          const response = await fetch(`/api/assessments/attempts/${attemptId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId, selectedOptions, timeSpent }),
            signal: controller.signal,
          });
          return { ok: response.ok, status: response.status };
        } finally {
          window.clearTimeout(timeout);
        }
      },
      onPermanentFailure: (status) => {
        if (status === 410) onExpiredRef.current();
      },
      onTelemetry: (event) => {
        // There is no product analytics transport yet. This privacy-safe local
        // event provides an integration seam without sending answer content.
        window.dispatchEvent(
          new CustomEvent('taskio:assessment-telemetry', { detail: event }),
        );
      },
    });

    queueRef.current = queue;
    const unsubscribe = queue.subscribe(() => {
      const next = queue.getSnapshot();
      setSnapshot(next);
      onAnswersChangeRef.current(next.answers);
    });
    queue.hydrate(serverSnapshot);
    const hydrated = queue.getSnapshot();
    setSnapshot(hydrated);
    onAnswersChangeRef.current(hydrated.answers);
    setReadyAttemptId(attemptId);

    const retryWhenOnline = () => queue.retryPending();
    window.addEventListener('online', retryWhenOnline);

    return () => {
      window.removeEventListener('online', retryWhenOnline);
      unsubscribe();
      queue.dispose();
      if (queueRef.current === queue) queueRef.current = null;
    };
  }, [attemptId, serverSnapshot]);

  const saveAnswer = useCallback(
    (questionId: string, selectedOptions: string[], timeSpent: number) => {
      queueRef.current?.select(questionId, selectedOptions, timeSpent);
    },
    [],
  );

  const retryPending = useCallback(() => {
    queueRef.current?.retryPending();
  }, []);

  const flushPending = useCallback(async (timeoutMs: number) => {
    const queue = queueRef.current;
    if (!queue) return { allConfirmed: true, pendingCount: 0 };
    return queue.flushPending(timeoutMs);
  }, []);

  const clearPending = useCallback(() => {
    queueRef.current?.clear();
  }, []);

  return {
    ready: readyAttemptId === attemptId,
    answerStates: snapshot.states,
    pendingCount: snapshot.pendingCount,
    saveAnswer,
    retryPending,
    flushPending,
    clearPending,
  };
}
