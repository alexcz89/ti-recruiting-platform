// app/assessments/[templateId]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  SkipForward,
} from 'lucide-react';
import { toastSuccess, toastError, toastInfo, toastWarning } from '@/lib/ui/toast';
import AssessmentIntro from './AssessmentIntro';
import AssessmentQuestion from './AssessmentQuestion';
import AssessmentProgress from './AssessmentProgress';
import AssessmentTimer from './AssessmentTimer';
import { useAntiCheating } from './useAntiCheating';

type Option = {
  id?: string;
  value?: string;
  text?: string;
  label?: string;
  [k: string]: any;
};

type Question = {
  id: string;
  section: string;
  difficulty: string;
  questionText: string;
  codeSnippet?: string;
  options: Option[];
  allowMultiple: boolean;
  type?: 'MULTIPLE_CHOICE' | 'OPEN_ENDED' | 'CODING';
  language?: string;
  allowedLanguages?: string[];
  starterCode?: string;
  testCases?: any[];
  points?: number;
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

type StartResponse = {
  attemptId: string;
  expiresAt?: string | Date | null;
  reused?: boolean;
  completed?: boolean;
  questions?: Question[];
  savedAnswers?: Record<string, string[]>;
  savedTimeSpent?: Record<string, number>;
  expired?: boolean;
};

const CODE_SENTINEL = '__CODE_SUBMITTED__';

function keyOfOption(o: any) {
  return String(o?.id ?? o?.value ?? JSON.stringify(o));
}

function normalizeQuestions(raw: any[]): Question[] {
  const qs = Array.isArray(raw) ? raw : [];
  return qs.map((q: any) => {
    const opts = Array.isArray(q?.options) ? q.options : [];
    return {
      id: String(q.id),
      section: String(q.section ?? ''),
      difficulty: String(q.difficulty ?? ''),
      questionText: String(q.questionText ?? ''),
      codeSnippet: q.codeSnippet ? String(q.codeSnippet) : undefined,
      allowMultiple: Boolean(q.allowMultiple),
      options: opts.map((o: any) => ({
        ...o,
        id: o?.id != null ? String(o.id) : undefined,
        value: o?.value != null ? String(o.value) : undefined,
        text: o?.text != null ? String(o.text) : o?.label != null ? String(o.label) : undefined,
      })),
      type: q.type || 'MULTIPLE_CHOICE',
      language: q.language,
      allowedLanguages: q.allowedLanguages ? JSON.parse(q.allowedLanguages) : undefined,
      starterCode: q.starterCode || q.codeSnippet || undefined,
      testCases: q.testCases || [],
      points: typeof q.points === 'number' ? q.points : 10,
    };
  });
}

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const templateId = params.templateId as string;

  const inviteToken = searchParams.get('token');
  const applicationIdQS = searchParams.get('applicationId');
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
  const [expirationState, setExpirationState] = useState<
    'idle' | 'finalizing' | 'finalized' | 'error'
  >('idle');
  const [antiCheatBypass, setAntiCheatBypass] = useState(false);

  // Anti-cheat: modal bloqueante al regresar al tab
  const [tabWarning, setTabWarning] = useState<{ show: boolean; count: number }>({ show: false, count: 0 });

  // ✅ NUEVO: trackear qué preguntas CODING fueron enviadas con solución
  const [codingSubmitted, setCodingSubmitted] = useState<Record<string, boolean>>({});

  const lastIndexHydratedAttemptIdRef = useRef<string | null>(null);
  const autoStartOnceRef = useRef(false);
  const expirationAttemptRef = useRef<{
    id: string;
    state: 'finalizing' | 'finalized';
  } | null>(null);

  async function finalizeExpiredAttempt(targetAttemptId: string) {
    const tracked = expirationAttemptRef.current;
    if (tracked?.id === targetAttemptId) return;

    expirationAttemptRef.current = { id: targetAttemptId, state: 'finalizing' };
    setExpirationState('finalizing');

    try {
      const res = await fetch(`/api/assessments/attempts/${targetAttemptId}/submit`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo cerrar la evaluación vencida');
      }

      expirationAttemptRef.current = { id: targetAttemptId, state: 'finalized' };
      setExpirationState('finalized');
      localStorage.removeItem(`assessment:${targetAttemptId}:currentIndex`);
    } catch (error) {
      console.error('Error finalizing expired assessment:', error);
      expirationAttemptRef.current = null;
      setExpirationState('error');
    }
  }

  function markExpired(targetAttemptId: string | null, notify = false) {
    setExpired(true);
    if (notify && expirationAttemptRef.current?.id !== targetAttemptId) {
      toastError('El tiempo terminó. Estamos calculando tu resultado.');
    }
    if (targetAttemptId) void finalizeExpiredAttempt(targetAttemptId);
  }

  function handleExpire() {
    markExpired(attemptId, true);
  }

  useAntiCheating({
    enabled: started && !!attemptId && !expired && !submitting && !antiCheatBypass,
    attemptId,
    maxTabSwitches: 5,
    onTabReturn: (count) => {
      setTabWarning({ show: true, count });
    },
  });

  const total = questions.length;


  const isAnsweredId = (qid?: string) => {
    if (!qid) return false;
    const a = answers[qid];
    return Array.isArray(a) && a.length > 0;
  };

  const answeredCount = useMemo(() => {
    return Object.values(answers).reduce(
      (acc, arr) => acc + (Array.isArray(arr) && arr.length > 0 ? 1 : 0),
      0
    );
  }, [answers]);

  const allQuestionsAnswered = useMemo(
    () =>
      questions.length > 0 &&
      questions.every((question) => {
        const answer = answers[question.id];
        return Array.isArray(answer) && answer.length > 0;
      }),
    [answers, questions]
  );

  useEffect(() => {
    async function loadTemplate() {
      try {
        const res = await fetch(`/api/assessments/${templateId}`, { cache: 'no-store' });

        if (res.status === 401) {
          const callbackUrl = encodeURIComponent(
            window.location.pathname + window.location.search
          );
          window.location.href = `/signin?callbackUrl=${callbackUrl}`;
          return;
        }

        if (!res.ok) throw new Error('Error al cargar template');
        const data = await res.json();
        setTemplate(data.template);
        setAntiCheatBypass(Boolean(data.antiCheatBypass));

        if (!data.userStatus.canStart && !inviteToken && !attemptIdQS) {
          toastError('Ya completaste esta evaluación');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error(error);
        toastError('Error al cargar evaluación');
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [templateId, router, inviteToken, attemptIdQS]);

  function firstUnansweredIndex(qs: Question[], a: Record<string, string[]>) {
    const idx = qs.findIndex((q) => {
      const ans = a[q.id];
      return !ans || ans.length === 0;
    });
    return idx === -1 ? 0 : idx;
  }

  // Restore currentIndex desde localStorage
  useEffect(() => {
    if (!attemptId || total === 0) return;
    if (lastIndexHydratedAttemptIdRef.current === attemptId) return;
    lastIndexHydratedAttemptIdRef.current = attemptId;

    const key = `assessment:${attemptId}:currentIndex`;
    const raw = localStorage.getItem(key);
    if (raw == null) return;

    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return;

    const clamped = Math.max(0, Math.min(n, total - 1));
    setCurrentIndex(clamped);
  }, [attemptId, total]);

  useEffect(() => {
    if (!attemptId) return;
    const key = `assessment:${attemptId}:currentIndex`;
    localStorage.setItem(key, String(currentIndex));
  }, [attemptId, currentIndex]);

  async function hydrateFromState(tryAttemptId: string, qs: Question[]) {
    const res = await fetch(`/api/assessments/attempts/${tryAttemptId}/state`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`state_not_ok_${res.status}`);

    const st = (await res.json()) as AttemptState;

    const savedAnswers = st.answers || {};
    const savedTimeSpent = st.timeSpent || {};

    setAnswers(savedAnswers);
    setTimeSpent(savedTimeSpent);

    if (st.expiresAt) setExpiresAt(new Date(st.expiresAt));
    if (st.expired) {
      const finalStatuses = ['SUBMITTED', 'EVALUATED', 'COMPLETED'];
      if (finalStatuses.includes(String(st.status ?? '').toUpperCase())) {
        setExpired(true);
        setExpirationState('finalized');
        expirationAttemptRef.current = { id: tryAttemptId, state: 'finalized' };
      } else {
        markExpired(tryAttemptId);
      }
    }

    // ✅ Restaurar codingSubmitted desde savedAnswers
    const submitted: Record<string, boolean> = {};
    for (const [qid, opts] of Object.entries(savedAnswers)) {
      if (Array.isArray(opts) && opts.includes(CODE_SENTINEL)) {
        submitted[qid] = true;
      }
    }
    setCodingSubmitted(submitted);

    if (typeof st.currentIndex === 'number') {
      const clamped = Math.max(0, Math.min(st.currentIndex, Math.max(0, qs.length - 1)));
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
          attemptId: attemptIdQS || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as StartResponse;

      if (!res.ok) {
        const msg = (data as any)?.error || 'Error al iniciar';
        throw new Error(msg);
      }

      const newAttemptId = data.attemptId;
      if (data.completed) {
        router.replace(`/assessments/attempts/${newAttemptId}/results`);
        return;
      }

      const qs = normalizeQuestions(data.questions || []);
      if (!qs.length) throw new Error('Respuesta inválida de /start (sin questions)');

      const expiredAtStart = Boolean(
        data.expired ||
          (data.expiresAt && new Date(data.expiresAt).getTime() <= Date.now())
      );

      setAttemptId(newAttemptId);
      setQuestions(qs);
      setStarted(true);
      setExpired(expiredAtStart);
      setExpirationState('idle');
      setSubmitting(false);

      if (data.expiresAt) setExpiresAt(new Date(data.expiresAt));

      const next = new URLSearchParams(searchParams.toString());
      next.set('attemptId', newAttemptId);
      router.replace(`/assessments/${templateId}?${next.toString()}`);

      const savedAnswers = data.savedAnswers ?? null;
      const savedTimeSpent = data.savedTimeSpent ?? null;

      const hasSavedAnswers =
        savedAnswers &&
        typeof savedAnswers === 'object' &&
        Object.keys(savedAnswers).some((k) => (savedAnswers as any)[k]?.length > 0);

      if (hasSavedAnswers) {
        setAnswers(savedAnswers!);
        setTimeSpent(savedTimeSpent || {});
        setCurrentIndex(firstUnansweredIndex(qs, savedAnswers!));

        // Restaurar codingSubmitted
        const submitted: Record<string, boolean> = {};
        for (const [qid, opts] of Object.entries(savedAnswers!)) {
          if (Array.isArray(opts) && opts.includes(CODE_SENTINEL)) {
            submitted[qid] = true;
          }
        }
        setCodingSubmitted(submitted);
      } else {
        try {
          await hydrateFromState(newAttemptId, qs);
        } catch {
          setAnswers({});
          setTimeSpent({});
          setCurrentIndex(0);
        }
      }

      if (expiredAtStart) {
        markExpired(newAttemptId);
        toastInfo('La evaluación terminó por tiempo. Conservamos las respuestas enviadas.');
      } else {
        toastSuccess(data.reused ? 'Reanudando evaluación…' : '¡Evaluación iniciada! Mucha suerte 🍀');
      }
    } catch (error: any) {
      console.error(error);
      toastError(error?.message || 'Error al iniciar evaluación');
    } finally {
      setStarting(false);
    }
  };

  // Auto-start si viene token (invite) O attemptId (resume)
  useEffect(() => {
    if (autoStartOnceRef.current) return;
    if (loading) return;
    if (!template) return;
    if (started || starting) return;

    if (attemptIdQS) {
      autoStartOnceRef.current = true;
      handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, template, inviteToken, attemptIdQS, started, starting]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentQuestion?.id || ''] || [];

  const handleAnswer = async (
    questionId: string,
    selectedOptions: string[]
  ): Promise<boolean> => {
    if (!attemptId || expired) return false;

    const unique = Array.from(new Set(selectedOptions.map((x) => String(x).trim()))).filter(Boolean);
    setAnswers((prev) => ({ ...prev, [questionId]: unique }));

    const questionTime = timeSpent[questionId] || 0;

    try {
      const res = await fetch(`/api/assessments/attempts/${attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, selectedOptions: unique, timeSpent: questionTime }),
      });

      if (!res.ok && res.status === 400) {
        const data = await res.json().catch(() => null);
        if (data?.error?.toLowerCase?.().includes('expir')) handleExpire();
        return false;
      }

      if (!res.ok) return false;
      return true;
    } catch (error) {
      console.error('Error saving answer:', error);
      return false;
    }
  };

  const isCurrentQuestionComplete =
    currentQuestion?.type === 'CODING'
      ? Boolean(codingSubmitted[currentQuestion.id])
      : currentAnswer.length > 0;

  const handleQuestionChange = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= total || targetIndex === currentIndex) return;
    setCurrentIndex(targetIndex);
  };

  const handleNext = () => {
    if (expired) return;
    handleQuestionChange(currentIndex + 1);
  };

  const handlePrevious = () => {
    if (expired) return;
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  type SubmitOptions = {
    answeredQuestionId?: string;
    skipConfirmation?: boolean;
  };

  const handleSubmit = async (options: SubmitOptions = {}) => {
    if (!attemptId || submitting) return;

    if (expired) {
      await finalizeExpiredAttempt(attemptId);
      return;
    }

    if (!expired) {
      const unansweredQuestions = questions.filter(
        (question) =>
          question.id !== options.answeredQuestionId && !isAnsweredId(question.id)
      );

      if (!options.skipConfirmation && unansweredQuestions.length > 0) {
        const unsubmittedCoding = unansweredQuestions.filter(
          (question) => question.type === 'CODING'
        );
        const codingNotice =
          unsubmittedCoding.length > 0
            ? `\n${unsubmittedCoding.length} son ejercicios de código sin una solución enviada.`
            : '';
        const confirmed = confirm(
          `Tienes ${unansweredQuestions.length} pregunta(s) sin responder.${codingNotice}\n\n¿Deseas finalizar de todos modos? Se calificarán con 0 puntos.`
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
          data?.error || (expired ? 'Tiempo expirado. No se pudo enviar.' : 'Error al enviar');
        throw new Error(msg);
      }

      const result = await res.json();

      toastSuccess(
        result.passed
          ? `¡Felicidades! Aprobaste con ${result.totalScore}%`
          : `Evaluación completada. Score: ${result.totalScore}%`
      );

      localStorage.removeItem(`assessment:${attemptId}:currentIndex`);
      router.push(`/assessments/attempts/${attemptId}/results`);
    } catch (error: any) {
      console.error(error);
      toastError(error?.message || 'Error al enviar evaluación');
      setSubmitting(false);
    }
  };

  const handleCodeSubmitted = async (qid: string) => {
    if (expired || submitting) return;

    setAnswers((prev) => ({ ...prev, [qid]: [CODE_SENTINEL] }));
    setCodingSubmitted((prev) => ({ ...prev, [qid]: true }));

    const answerSaved = await handleAnswer(qid, [CODE_SENTINEL]);
    if (!answerSaved) {
      toastError('La solución se ejecutó, pero no pudimos cerrar la respuesta. Intenta de nuevo.');
      return;
    }

    const isLastQuestion = currentIndex === total - 1;
    const allAnsweredAfterThis = questions.every(
      (question) => question.id === qid || isAnsweredId(question.id)
    );

    if (isLastQuestion && allAnsweredAfterThis) {
      await handleSubmit({
        answeredQuestionId: qid,
        skipConfirmation: true,
      });
      return;
    }

    toastSuccess(
      isLastQuestion
        ? 'Solución enviada. Revisa las preguntas pendientes antes de finalizar.'
        : 'Solución enviada. Puedes continuar con la siguiente pregunta.'
    );
  };

  // Timer para tiempo en pregunta actual
  useEffect(() => {
    if (!started || expired || submitting) return;
    if (!currentQuestion?.id) return;

    const questionId = currentQuestion.id;
    const interval = setInterval(() => {
      setTimeSpent((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || 0) + 1,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [started, expired, submitting, currentQuestion?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-4 text-muted">Cargando evaluación...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center max-w-sm">
          <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
            Evaluación no encontrada
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            El link puede haber expirado o necesitas iniciar sesión para acceder.
          </p>
          <a
            href={`/signin?callbackUrl=${encodeURIComponent(
              typeof window !== 'undefined'
                ? window.location.pathname + window.location.search
                : '/assessments'
            )}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  if (!started) {
    return <AssessmentIntro template={template} onStart={handleStart} />;
  }

  if (!currentQuestion) {
    return (
      <main className="max-w-none p-0">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto" />
              <p className="mt-4 text-muted">Cargando pregunta...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const isCodingQuestion = currentQuestion.type === 'CODING';

  return (
    <main className="max-w-none p-0">

      {/* ══ Modal bloqueante: regreso al tab ══════════════════════════════ */}
      {tabWarning.show && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
            {/* Banda roja superior */}
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <h2 className="text-lg font-bold text-white">Salida detectada</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-zinc-800 dark:text-zinc-200 font-medium">
                Detectamos que saliste de la evaluación.
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Este evento quedó registrado ({tabWarning.count}{' '}
                {tabWarning.count === 1 ? 'salida' : 'salidas'} en total).
                Tu reclutador verá un reporte completo de toda la actividad sospechosa al revisar tus resultados.
              </p>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                ⚠️ El uso de herramientas externas (IA, buscadores, etc.) durante el examen es considerado trampa y puede resultar en la descalificación automática.
              </div>
              <button
                onClick={() => setTabWarning({ show: false, count: tabWarning.count })}
                className="mt-5 w-full rounded-xl bg-zinc-900 dark:bg-white px-4 py-3 text-sm font-semibold text-white dark:text-zinc-900 transition hover:bg-zinc-700 dark:hover:bg-zinc-200"
              >
                Entendido — continuar evaluación
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`mx-auto px-4 lg:px-8 ${
          isCodingQuestion ? 'max-w-[1680px] py-2' : 'max-w-[1200px] py-4'
        }`}
      >

        {/* Header — NO-CODING */}
        {!isCodingQuestion && (
          <div className="sticky top-14 z-40 -mx-2 mb-6 border-b border-zinc-200/80 bg-zinc-50/95 px-2 py-3 backdrop-blur md:top-16 dark:border-zinc-800/80 dark:bg-zinc-950/95">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-default">{template.title}</h1>
                <p className="text-sm text-muted">
                  Pregunta {currentIndex + 1} de {total}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Contador de salidas — visible si hay al menos una */}
                {tabWarning.count > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400">
                    🚨 {tabWarning.count} {tabWarning.count === 1 ? 'salida' : 'salidas'} registradas
                  </span>
                )}
                {expiresAt && !submitting && (
                  <AssessmentTimer expiresAt={expiresAt} onExpire={handleExpire} />
                )}
              </div>
            </div>

            <AssessmentProgress current={currentIndex + 1} total={total} answered={answeredCount} />


          </div>
        )}

        {/* Header - CODING: contexto, mapa, timer y navegacion en una franja */}
        {isCodingQuestion && (
          <div className="sticky top-12 z-40 -mx-2 mb-2 border-b border-zinc-200/80 bg-zinc-50/95 px-2 py-2 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/95">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 min-w-0 max-w-[20rem]">
                <h1 className="truncate text-base font-bold text-default">{template.title}</h1>
                <p className="text-xs text-muted">
                  Pregunta {currentIndex + 1} de {total}
                </p>
              </div>

              <div
                className="order-3 flex w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-1 md:order-none md:w-auto md:max-w-[36rem]"
                aria-label="Navegación de preguntas"
              >
                {questions.map((q, idx) => {
                  const isAnswered = isAnsweredId(q.id);
                  const isCurrent = idx === currentIndex;
                  const questionStatus = isAnswered ? 'Respondida' : 'Pendiente';

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleQuestionChange(idx)}
                      title={`Pregunta ${idx + 1} - ${questionStatus}`}
                      aria-label={`Pregunta ${idx + 1}: ${questionStatus}`}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={[
                        'relative flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors',
                        isCurrent
                          ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                          : isAnswered
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : 'border-zinc-300 bg-white text-zinc-600 hover:border-teal-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
                      ].join(' ')}
                    >
                      {idx + 1}
                      {isAnswered && !isCurrent && (
                        <span
                          title="Respondida"
                          aria-hidden="true"
                          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="hidden items-center gap-3 text-[11px] text-zinc-500 2xl:flex dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Respondida
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  Pendiente
                </span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0 || expired}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:border-teal-400 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  title="Pregunta anterior"
                  aria-label="Pregunta anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {expiresAt && !submitting && (
                  <AssessmentTimer compact expiresAt={expiresAt} onExpire={handleExpire} />
                )}

                {currentIndex < total - 1 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={expired}
                    title={!isCurrentQuestionComplete ? 'Podrás volver desde el mapa de preguntas' : 'Siguiente pregunta'}
                    className={[
                      'inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
                      !isCurrentQuestionComplete
                        ? 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-600/60 dark:bg-amber-950/30 dark:text-amber-200'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:border-teal-400 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                    ].join(' ')}
                  >
                    {!isCurrentQuestionComplete ? (
                      <>
                        <SkipForward className="h-4 w-4" />
                        Omitir
                      </>
                    ) : (
                      <>
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}

                {(currentIndex === total - 1 || allQuestionsAnswered) && (
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={submitting || expired}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {submitting ? 'Enviando...' : 'Finalizar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {expired && (
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 md:flex-row md:items-center md:justify-between dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
            <div>
              <p className="text-sm font-semibold">La evaluación terminó por tiempo.</p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200/80">
                Respondidas: {answeredCount} de {total}. Se califican únicamente las respuestas enviadas a tiempo.
              </p>
            </div>
            {expirationState === 'finalized' ? (
              <button
                type="button"
                onClick={() => router.push(`/assessments/attempts/${attemptId}/results`)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200"
              >
                Ver resultados
              </button>
            ) : expirationState === 'error' ? (
              <button
                type="button"
                onClick={() => attemptId && finalizeExpiredAttempt(attemptId)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold transition hover:bg-amber-100 dark:border-amber-300 dark:hover:bg-amber-900/40"
              >
                Reintentar cierre
              </button>
            ) : (
              <span className="shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-200">
                Calculando resultado…
              </span>
            )}
          </div>
        )}

        {/* ✅ Banner instrucciones CODING — solo si no ha enviado aún */}
        {isCodingQuestion && !expired && !codingSubmitted[currentQuestion.id] && (
          <details className="group mb-3 overflow-hidden rounded-lg border border-blue-200 bg-blue-50/70 text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/30 dark:text-blue-100">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-2">
                <CircleHelp className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                <span className="truncate text-sm font-semibold">¿Necesitas ayuda?</span>
                <span className="hidden text-xs font-normal text-blue-700 sm:inline dark:text-blue-300">
                  Ver pasos y atajos
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="grid gap-2 border-t border-blue-200 px-3 py-3 text-xs text-blue-800 md:grid-cols-3 dark:border-blue-800/60 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">1</span>
                <span>Escribe tu solución en el editor.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">2</span>
                <span>Ejecuta los tests con el botón o con Ctrl/Cmd + Enter.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">3</span>
                <span>Si los tests pasan, se envía automáticamente; también puedes enviarla manualmente.</span>
              </li>
            </ol>
          </details>
        )}
        {/* ✅ Banner de confirmación cuando ya fue enviada */}
        {isCodingQuestion && !expired && codingSubmitted[currentQuestion.id] && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-200">
            <span className="text-lg leading-none">✅</span>
            <p className="font-semibold">
              {currentIndex === total - 1
                ? submitting
                  ? 'Solución correcta. Finalizando evaluación...'
                  : 'Solución enviada correctamente. Finaliza la evaluación.'
                : 'Solución enviada correctamente. Puedes continuar con la siguiente pregunta.'}
            </p>
          </div>
        )}

        {/* Question */}
        <AssessmentQuestion
          question={{
            ...currentQuestion,
            options: currentQuestion.options.map((o) => ({
              id: keyOfOption(o),
              text: String(o.text ?? o.label ?? o.value ?? ''),
            })),
          }}
          selectedOptions={currentAnswer}
          onAnswer={(optionKeys) => handleAnswer(currentQuestion.id, optionKeys)}
          disabled={expired}
          attemptId={attemptId || undefined}
          onCodeSubmit={() => handleCodeSubmitted(currentQuestion.id)}
          templateLanguage={template?.language || 'javascript'}
        />

        {/* Navegación — NO-CODING */}
        {!isCodingQuestion && !expired && (
          <div className="sticky bottom-3 z-20 mt-4 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0 || expired}
              className="btn-ghost disabled:opacity-50"
            >
              ← Anterior
            </button>

            <div className="flex items-center gap-2">
              {currentIndex === total - 1 || allQuestionsAnswered ? (
                <button
                  onClick={() => void handleSubmit()}
                  disabled={submitting || expired}
                  className="btn btn-primary"
                >
                  {submitting ? 'Enviando...' : 'Enviar evaluación ✓'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={expired}
                  title={!isCurrentQuestionComplete ? 'Podrás volver a esta pregunta desde el mapa' : undefined}
                  className={
                    !isCurrentQuestionComplete
                      ? 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-600/60 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50'
                      : 'btn btn-primary'
                  }
                >
                  {!isCurrentQuestionComplete ? (
                    <><SkipForward className="h-4 w-4" /> Omitir pregunta</>
                  ) : (
                    <>Siguiente →</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mapa de preguntas — NO-CODING */}
        {!isCodingQuestion && (
          <div className="mt-8 p-6 rounded-2xl border glass-card">
            <h3 className="text-sm font-semibold mb-3">Mapa de preguntas</h3>
            <div className="grid grid-cols-10 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = isAnsweredId(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleQuestionChange(idx)}
                    title={`Pregunta ${idx + 1} - ${isAnswered ? 'Respondida' : 'Pendiente'}`}
                    aria-label={`Pregunta ${idx + 1}: ${isAnswered ? 'Respondida' : 'Pendiente'}`}
                    className={`
                      h-10 w-10 rounded-lg text-sm font-medium transition
                      ${
                        idx === currentIndex
                          ? 'bg-emerald-600 text-white'
                          : isAnswered
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }
                      ${expired ? 'cursor-pointer opacity-80' : ''}
                    `}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}