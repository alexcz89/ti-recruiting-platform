// app/assessments/[templateId]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import AssessmentIntro from './AssessmentIntro';
import AssessmentQuestion from './AssessmentQuestion';
import AssessmentProgress from './AssessmentProgress';
import AssessmentTimer from './AssessmentTimer';
import { useAntiCheating } from './useAntiCheating';

type Question = {
  id: string;
  section: string;
  difficulty: string;
  questionText: string;
  codeSnippet?: string;
  options: Array<{ id: string; text: string }>;
  allowMultiple: boolean;
};

type AttemptState = {
  attemptId: string;
  status?: string;
  expiresAt?: string | Date | null;
  expired?: boolean;
  answers?: Record<string, string[]>;
  timeSpent?: Record<string, number>;
  currentIndex?: number;
};

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const templateId = params.templateId as string;

  // invite flow (from URL)
  const inviteToken = searchParams.get('token');
  const applicationIdQS = searchParams.get('applicationId');

  // ✅ resume flow (from URL)
  const attemptIdQS = searchParams.get('attemptId');

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<any>(null);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);

  // Persistir en qué pregunta va (para que refresh no “reinicie” la UI)
  const lastHydratedAttemptIdRef = useRef<string | null>(null);
  const autoStartOnceRef = useRef(false);

  useAntiCheating({
    enabled: started && !!attemptId && !expired,
    attemptId,
    maxTabSwitches: 5,
  });

  // Cargar template
  useEffect(() => {
    async function loadTemplate() {
      try {
        const res = await fetch(`/api/assessments/${templateId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Error al cargar template');
        const data = await res.json();
        setTemplate(data.template);

        // ✅ si vienes por invitación o por resume (attemptId), NO bloquees aquí
        if (!data.userStatus.canStart && !inviteToken && !attemptIdQS) {
          toast.error('Ya completaste esta evaluación');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar evaluación');
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [templateId, router, inviteToken, attemptIdQS]);

  // Restore currentIndex desde localStorage (solo una vez por attempt)
  useEffect(() => {
    if (!attemptId || questions.length === 0) return;

    if (lastHydratedAttemptIdRef.current === attemptId) return;
    lastHydratedAttemptIdRef.current = attemptId;

    const key = `assessment:${attemptId}:currentIndex`;
    const raw = localStorage.getItem(key);
    if (raw == null) return;

    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return;

    const clamped = Math.max(0, Math.min(n, questions.length - 1));
    setCurrentIndex(clamped);
  }, [attemptId, questions.length]);

  useEffect(() => {
    if (!attemptId) return;
    const key = `assessment:${attemptId}:currentIndex`;
    localStorage.setItem(key, String(currentIndex));
  }, [attemptId, currentIndex]);

  const handleExpire = () => {
    setExpired((prev) => {
      if (prev) return prev;
      toast.error('⏰ Tiempo expirado. Ya no puedes responder.');
      return true;
    });
  };

  function firstUnansweredIndex(qs: Question[], a: Record<string, string[]>) {
    const idx = qs.findIndex((q) => {
      const ans = a[q.id];
      return !ans || ans.length === 0;
    });
    return idx === -1 ? 0 : idx;
  }

  async function hydrateFromState(tryAttemptId: string, qs: Question[]) {
    const res = await fetch(`/api/assessments/attempts/${tryAttemptId}/state`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`state_not_ok_${res.status}`);
    }

    const st = (await res.json()) as AttemptState;

    const savedAnswers = st.answers || {};
    const savedTimeSpent = st.timeSpent || {};

    setAnswers(savedAnswers);
    setTimeSpent(savedTimeSpent);

    if (st.expiresAt) setExpiresAt(new Date(st.expiresAt));
    if (st.expired) handleExpire();

    if (typeof st.currentIndex === 'number') {
      const clamped = Math.max(0, Math.min(st.currentIndex, qs.length - 1));
      setCurrentIndex(clamped);
    } else {
      setCurrentIndex(firstUnansweredIndex(qs, savedAnswers));
    }
  }

  const handleStart = async () => {
    if (starting || started) return;
    setStarting(true);

    try {
      const res = await fetch(`/api/assessments/${templateId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteToken || undefined,
          applicationId: applicationIdQS || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || 'Error al iniciar';
        throw new Error(msg);
      }

      const newAttemptId = data.attemptId as string;
      const qs = (data.questions || []) as Question[];

      setAttemptId(newAttemptId);
      setQuestions(qs);
      setStarted(true);
      setExpired(false);
      setSubmitting(false);

      if (data.expiresAt) setExpiresAt(new Date(data.expiresAt));

      // ✅ Persist attemptId en URL para que refresh pueda reanudar (sin token)
      // Mantiene token/applicationId si vienen.
      const next = new URLSearchParams(searchParams.toString());
      next.set('attemptId', newAttemptId);
      router.replace(`/assessments/${templateId}?${next.toString()}`);

      // 1) Si /start regresa savedAnswers/savedTimeSpent y NO está vacío, úsalo.
      const savedAnswers = (data?.savedAnswers ?? null) as Record<string, string[]> | null;
      const savedTimeSpent = (data?.savedTimeSpent ?? null) as Record<string, number> | null;

      const hasSavedAnswers =
        savedAnswers &&
        typeof savedAnswers === 'object' &&
        Object.keys(savedAnswers).length > 0;

      if (hasSavedAnswers) {
        setAnswers(savedAnswers!);
        setTimeSpent(savedTimeSpent || {});
        setCurrentIndex(firstUnansweredIndex(qs, savedAnswers!));
      } else {
        // 2) Si no, intenta hidratar desde /state:
        //    - siempre que venga attemptIdQS (resume)
        //    - o si el backend dijo reused
        //    - o si no sabemos (mejor intentar)
        const shouldTryState = Boolean(attemptIdQS) || Boolean(data?.reused) || true;

        if (shouldTryState) {
          try {
            await hydrateFromState(newAttemptId, qs);
          } catch {
            setAnswers({});
            setTimeSpent({});
            setCurrentIndex(0);
          }
        } else {
          setAnswers({});
          setTimeSpent({});
          setCurrentIndex(0);
        }
      }

      toast.success(data.reused ? 'Reanudando evaluación…' : '¡Evaluación iniciada! Mucha suerte 🍀');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Error al iniciar evaluación');
    } finally {
      setStarting(false);
    }
  };

  // ✅ Auto-start si viene token (invite) O attemptId (resume)
  useEffect(() => {
    if (autoStartOnceRef.current) return;
    if (loading) return;
    if (!template) return;
    if (started || starting) return;

    if (inviteToken || attemptIdQS) {
      autoStartOnceRef.current = true;
      handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, template, inviteToken, attemptIdQS, started, starting]);

  // ✅ Si vienes con attemptIdQS, hidrata desde /state en cuanto ya tengas questions + attemptId
  useEffect(() => {
    if (!attemptIdQS) return;
    if (!started) return;
    if (!attemptId) return;
    if (attemptId !== attemptIdQS) return; // solo si corresponde
    if (questions.length === 0) return;

    // evitar rehidratar repetido
    if (lastHydratedAttemptIdRef.current === attemptIdQS) return;

    hydrateFromState(attemptIdQS, questions).catch(() => {
      // si falla, no tronar UX
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptIdQS, started, attemptId, questions.length]);

  const handleAnswer = async (questionId: string, selectedOptions: string[]) => {
    if (!attemptId || expired) return;

    setAnswers((prev) => ({ ...prev, [questionId]: selectedOptions }));

    const questionTime = timeSpent[questionId] || 0;

    try {
      const res = await fetch(`/api/assessments/attempts/${attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          selectedOptions,
          timeSpent: questionTime,
        }),
      });

      if (!res.ok && res.status === 400) {
        const data = await res.json().catch(() => null);
        if (data?.error?.toLowerCase?.().includes('expir')) {
          handleExpire();
        }
      }
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const handleNext = () => {
    if (expired) return;
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrevious = () => {
    if (expired) return;
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleSubmit = async () => {
    if (!attemptId || submitting) return;

    if (!expired) {
      const unanswered = questions.filter((q) => !answers[q.id]);
      if (unanswered.length > 0) {
        const confirmed = confirm(
          `Tienes ${unanswered.length} pregunta(s) sin responder. ¿Deseas enviar de todos modos?`
        );
        if (!confirmed) return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/assessments/attempts/${attemptId}/submit`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.error ||
          (expired ? 'Tiempo expirado. No se pudo enviar.' : 'Error al enviar');
        throw new Error(msg);
      }

      const result = await res.json();

      toast.success(
        result.passed
          ? `¡Felicidades! Aprobaste con ${result.totalScore}%`
          : `Evaluación completada. Score: ${result.totalScore}%`
      );

      localStorage.removeItem(`assessment:${attemptId}:currentIndex`);
      router.push(`/assessments/attempts/${attemptId}/results`);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Error al enviar evaluación');
      setSubmitting(false);
    }
  };

  // Timer para tiempo en pregunta actual
  useEffect(() => {
    if (!started || expired || !questions[currentIndex]) return;

    const questionId = questions[currentIndex].id;
    const interval = setInterval(() => {
      setTimeSpent((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || 0) + 1,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [started, expired, currentIndex, questions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-muted">Cargando evaluación...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Evaluación no encontrada</p>
        </div>
      </div>
    );
  }

  if (!started) {
    return <AssessmentIntro template={template} onStart={handleStart} />;
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion?.id] || [];

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-8">
        <div className="sticky top-0 z-30 mb-6 pb-4 bg-white dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-default">{template.title}</h1>
              <p className="text-sm text-muted">
                Pregunta {currentIndex + 1} de {questions.length}
              </p>
            </div>

            {expiresAt && <AssessmentTimer expiresAt={expiresAt} onExpire={handleExpire} />}
          </div>

          <AssessmentProgress
            current={currentIndex + 1}
            total={questions.length}
            answered={Object.keys(answers).length}
          />

          {expired && (
            <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-900/10 dark:text-amber-200">
              ⏰ Tiempo expirado. La evaluación quedó bloqueada.
            </div>
          )}
        </div>

        <AssessmentQuestion
          question={currentQuestion}
          selectedOptions={currentAnswer}
          onAnswer={(options) => handleAnswer(currentQuestion.id, options)}
        />

        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0 || expired}
            className="btn-ghost disabled:opacity-50"
          >
            ← Anterior
          </button>

          <div className="flex items-center gap-2">
            {currentIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={submitting || expired}
                className="btn btn-primary"
              >
                {submitting ? 'Enviando...' : 'Enviar evaluación ✓'}
              </button>
            ) : (
              <button onClick={handleNext} disabled={expired} className="btn btn-primary">
                Siguiente →
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 p-6 rounded-2xl border glass-card">
          <h3 className="text-sm font-semibold mb-3">Mapa de preguntas</h3>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => !expired && setCurrentIndex(idx)}
                className={`
                  h-10 w-10 rounded-lg text-sm font-medium transition
                  ${
                    idx === currentIndex
                      ? 'bg-emerald-600 text-white'
                      : answers[q.id]
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }
                  ${expired ? 'opacity-60 cursor-not-allowed' : ''}
                `}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
