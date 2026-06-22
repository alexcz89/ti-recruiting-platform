"use client";

import { useState, useEffect, useCallback } from "react";
import { Github, Globe, Clock, CheckCircle2, Video, BookOpen, ChevronDown, ChevronUp, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Phase = "SCHEDULED" | "CODING_PHASE" | "REVIEW_PAUSE" | "QA_PHASE" | "COMPLETED" | "CANCELLED";

interface Props {
  interview: {
    id: string;
    status: Phase;
    challengeTitle: string;
    challengeDescription: string;
    apiName: string | null;
    apiDocsUrl: string | null;
    videoCallUrl: string | null;
    codingMinutes: number;
    qaMinutes: number;
    codingStartedAt: string | null;
    qaStartedAt: string | null;
    submittedAt: string | null;
    githubUrl: string | null;
    liveUrl: string | null;
    job: { id: string; title: string };
  };
}

function useCountdown(startedAt: string | null, durationMinutes: number) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const endMs = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;

    const tick = () => {
      const diff = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationMinutes]);

  return secondsLeft;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CandidateLiveInterviewView({ interview }: Props) {
  const [phase, setPhase] = useState<Phase>(interview.status);
  const [githubUrl, setGithubUrl] = useState(interview.githubUrl ?? "");
  const [liveUrl, setLiveUrl] = useState(interview.liveUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!interview.submittedAt);
  const [descOpen, setDescOpen] = useState(true);

  const codingSeconds = useCountdown(interview.codingStartedAt, interview.codingMinutes);
  const qaSeconds = useCountdown(interview.qaStartedAt, interview.qaMinutes);

  // Poll every 10s for phase changes (recruiter controls the clock)
  useEffect(() => {
    if (phase === "COMPLETED" || phase === "CANCELLED") return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/live-interviews/${interview.id}`).catch(() => null);
      if (!res?.ok) return;
      const { interview: updated } = await res.json();
      if (updated?.status && updated.status !== phase) {
        setPhase(updated.status);
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [phase, interview.id]);

  const handleSubmit = useCallback(async () => {
    if (!githubUrl.trim()) {
      toast.error("El link de GitHub es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/live-interviews/${interview.id}/submit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: githubUrl.trim(), liveUrl: liveUrl.trim() }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? "Error al entregar");
        return;
      }
      setSubmitted(true);
      toast.success("¡Links entregados! Espera las instrucciones del entrevistador.");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }, [githubUrl, liveUrl, interview.id]);

  const isUrgent = (codingSeconds ?? Infinity) < 300; // < 5 min

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Sticky header with timer */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{interview.job.title}</p>
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {interview.challengeTitle}
            </p>
          </div>

          {/* Timer */}
          {phase === "CODING_PHASE" && codingSeconds !== null && (
            <div
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums transition-colors ${
                isUrgent
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              {formatTime(codingSeconds)}
            </div>
          )}
          {phase === "QA_PHASE" && qaSeconds !== null && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 font-mono text-lg font-bold tabular-nums text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <Clock className="h-4 w-4 shrink-0" />
              {formatTime(qaSeconds)}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">

        {/* Phase: SCHEDULED */}
        {phase === "SCHEDULED" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <Clock className="mx-auto mb-3 h-10 w-10 text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Esperando al entrevistador</h2>
            <p className="mt-1 text-sm text-zinc-500">La sesión comenzará cuando el entrevistador inicie el tiempo. Mantén esta pantalla abierta.</p>
            {interview.videoCallUrl && (
              <a
                href={interview.videoCallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Video className="h-4 w-4" />
                Unirse a la videollamada
              </a>
            )}
          </div>
        )}

        {/* Phase: CODING_PHASE */}
        {phase === "CODING_PHASE" && (
          <div className="space-y-4">
            {interview.videoCallUrl && (
              <a
                href={interview.videoCallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-950/30 dark:text-blue-300"
              >
                <Video className="h-4 w-4" />
                Videollamada activa — comparte tu pantalla
              </a>
            )}

            {/* Challenge instructions */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <button
                onClick={() => setDescOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Instrucciones del challenge</span>
                </div>
                {descOpen ? (
                  <ChevronUp className="h-4 w-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                )}
              </button>
              {descOpen && (
                <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {interview.challengeDescription}
                  </p>
                  {(interview.apiName || interview.apiDocsUrl) && (
                    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        API a usar
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-emerald-900 dark:text-emerald-200">
                        {interview.apiName ?? "Ver documentación"}
                      </p>
                      {interview.apiDocsUrl && (
                        <a
                          href={interview.apiDocsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
                        >
                          <Globe className="h-3 w-3" />
                          Ver documentación
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit form (always visible during coding) */}
            {!submitted ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-100">Entregar cuando termines</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Repositorio GitHub <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 dark:border-zinc-700 dark:bg-zinc-800">
                      <Github className="h-4 w-4 shrink-0 text-zinc-400" />
                      <input
                        type="url"
                        placeholder="https://github.com/tu-usuario/mi-app"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="h-11 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      URL del deploy (opcional)
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 dark:border-zinc-700 dark:bg-zinc-800">
                      <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
                      <input
                        type="url"
                        placeholder="https://mi-app.vercel.app"
                        value={liveUrl}
                        onChange={(e) => setLiveUrl(e.target.value)}
                        className="h-11 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !githubUrl.trim()}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Entregar links
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Links entregados</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Espera las instrucciones del entrevistador para continuar.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phase: REVIEW_PAUSE */}
        {phase === "REVIEW_PAUSE" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800/40 dark:bg-amber-950/20">
              <Clock className="mx-auto mb-3 h-8 w-8 text-amber-500" />
              <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                El entrevistador está revisando tu app
              </h2>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-400">
                Pronto comenzará la segunda parte — preguntas sin ayuda externa.
              </p>
            </div>

            {submitted ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">LO QUE ENTREGASTE</p>
                {githubUrl && (
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 underline dark:text-blue-400">
                    <Github className="h-4 w-4" /> {githubUrl}
                  </a>
                )}
                {liveUrl && (
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 text-sm text-blue-600 underline dark:text-blue-400">
                    <Globe className="h-4 w-4" /> {liveUrl}
                  </a>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">Entrega tus links</h3>
                <p className="mb-4 text-sm text-zinc-500">Todavía puedes compartir tu repositorio y deploy.</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Repositorio GitHub <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 dark:border-zinc-700 dark:bg-zinc-800">
                      <Github className="h-4 w-4 shrink-0 text-zinc-400" />
                      <input
                        type="url"
                        placeholder="https://github.com/tu-usuario/mi-app"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="h-11 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      URL del deploy (opcional)
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 dark:border-zinc-700 dark:bg-zinc-800">
                      <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
                      <input
                        type="url"
                        placeholder="https://mi-app.vercel.app"
                        value={liveUrl}
                        onChange={(e) => setLiveUrl(e.target.value)}
                        className="h-11 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !githubUrl.trim()}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Entregar links
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phase: QA_PHASE */}
        {phase === "QA_PHASE" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800/40 dark:bg-blue-950/20">
            <h2 className="text-base font-semibold text-blue-900 dark:text-blue-200">Sesión de preguntas en vivo</h2>
            <p className="mt-1 text-sm text-blue-800 dark:text-blue-400">
              Responde las preguntas del entrevistador. No uses Google, ChatGPT u otras herramientas externas en esta fase.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <li>• Respuestas directas y concretas</li>
              <li>• Si no sabes algo, di qué harías para encontrar la respuesta</li>
              <li>• Puedes dibujar o usar papel si necesitas</li>
            </ul>
          </div>
        )}

        {/* Phase: COMPLETED */}
        {phase === "COMPLETED" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
            <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">Entrevista completada</h2>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
              Gracias por tu tiempo. El equipo te contactará con los siguientes pasos.
            </p>
          </div>
        )}

        {/* Phase: CANCELLED */}
        {phase === "CANCELLED" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Esta sesión fue cancelada.</p>
          </div>
        )}
      </main>
    </div>
  );
}
