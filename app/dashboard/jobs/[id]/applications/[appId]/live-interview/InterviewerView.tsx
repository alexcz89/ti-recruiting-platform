"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock, Play, Square, Video, Github, Globe, Star,
  ChevronDown, ChevronUp, CheckCircle2, Loader2,
  ClipboardList, ArrowRight, User, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

type Phase = "SCHEDULED" | "CODING_PHASE" | "REVIEW_PAUSE" | "QA_PHASE" | "COMPLETED" | "CANCELLED";
type Rec = "HIRE" | "MAYBE" | "REJECT";

interface Question {
  id: string;
  question: string;
  expectedTopics: string[];
  category: string | null;
  techStack: string | null;
  seniority: string | null;
}

interface QAScore {
  questionId: string;
  score: number;
  notes: string | null;
  question: { id: string; question: string; expectedTopics: string[]; category: string | null };
}

interface ExistingInterview {
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
  codingEndedAt: string | null;
  qaStartedAt: string | null;
  submittedAt: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  codingScore: number | null;
  qaScore: number | null;
  finalScore: number | null;
  interviewerNotes: string | null;
  recommendation: Rec | null;
  qaScores: QAScore[];
}

interface Props {
  application: {
    id: string;
    jobId: string;
    candidate: { id: string; name: string | null; email: string };
    job: { id: string; title: string };
  };
  existingInterview: ExistingInterview | null;
  questionBank: Question[];
}

function useCountdown(startedAt: string | null, durationMinutes: number) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!startedAt) return;
    const endMs = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationMinutes]);
  return secondsLeft;
}

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

// ── Setup form (create new interview) ────────────────────────────────────────

function SetupForm({ application, onCreated }: {
  application: Props["application"];
  onCreated: (iv: ExistingInterview) => void;
}) {
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [apiName, setApiName] = useState("");
  const [apiDocsUrl, setApiDocsUrl] = useState("");
  const [videoCallUrl, setVideoCallUrl] = useState("");
  const [codingMinutes, setCodingMinutes] = useState(50);
  const [qaMinutes, setQaMinutes] = useState(40);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!challengeTitle.trim() || !challengeDescription.trim()) {
      toast.error("El título y las instrucciones son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/live-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          jobId: application.jobId,
          candidateId: application.candidate.id,
          challengeTitle: challengeTitle.trim(),
          challengeDescription: challengeDescription.trim(),
          apiName: apiName.trim() || undefined,
          apiDocsUrl: apiDocsUrl.trim() || undefined,
          videoCallUrl: videoCallUrl.trim() || undefined,
          codingMinutes,
          qaMinutes,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? "Error al crear sesión");
        return;
      }
      const { interview } = await res.json();
      onCreated({ ...interview, qaScores: [] });
      toast.success("Sesión creada");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-100">Configurar sesión</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Título del challenge <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej: App del clima con OpenWeatherMap"
              value={challengeTitle}
              onChange={(e) => setChallengeTitle(e.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Instrucciones <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={5}
              placeholder={"Construye una app web que consuma la API de OpenWeatherMap.\n\n- Muestra el clima actual de cualquier ciudad\n- Usa React o Vue\n- Despliega en Vercel, Railway o Render"}
              value={challengeDescription}
              onChange={(e) => setChallengeDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nombre de la API
              </label>
              <input
                type="text"
                placeholder="OpenWeatherMap"
                value={apiName}
                onChange={(e) => setApiName(e.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Docs URL
              </label>
              <input
                type="url"
                placeholder="https://openweathermap.org/api"
                value={apiDocsUrl}
                onChange={(e) => setApiDocsUrl(e.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Link de videollamada (Zoom / Meet)
            </label>
            <input
              type="url"
              placeholder="https://meet.google.com/abc-defg-hij"
              value={videoCallUrl}
              onChange={(e) => setVideoCallUrl(e.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tiempo coding (min)
              </label>
              <input
                type="number"
                min={10}
                max={180}
                value={codingMinutes}
                onChange={(e) => setCodingMinutes(Number(e.target.value))}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tiempo Q&A (min)
              </label>
              <input
                type="number"
                min={10}
                max={120}
                value={qaMinutes}
                onChange={(e) => setQaMinutes(Number(e.target.value))}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
          Crear sesión
        </button>
      </div>
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} de 5 estrellas`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5"
        >
          <Star
            className={clsx(
              "h-6 w-6 transition-colors",
              n <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-300 dark:text-zinc-600"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ── Q&A question card ─────────────────────────────────────────────────────────

function QuestionCard({
  question,
  existingScore,
  interviewId,
  onScored,
}: {
  question: Question;
  existingScore: QAScore | undefined;
  interviewId: string;
  onScored: (questionId: string, score: number, notes: string) => void;
}) {
  const [open, setOpen] = useState(!existingScore);
  const [score, setScore] = useState(existingScore?.score ?? 0);
  const [notes, setNotes] = useState(existingScore?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!score) { toast.error("Selecciona una calificación"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/live-interviews/${interviewId}/qa-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, score, notes }),
      });
      if (!res.ok) { toast.error("Error al guardar"); return; }
      onScored(question.id, score, notes);
      setOpen(false);
      toast.success("Guardado");
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  const scored = !!existingScore;

  return (
    <div className={clsx(
      "rounded-xl border transition-colors",
      scored
        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/10"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    )}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          {question.category && (
            <span className="mb-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {question.category}
            </span>
          )}
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{question.question}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {existingScore && (
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map((n) => (
                <Star key={n} className={clsx("h-3.5 w-3.5", n <= existingScore.score ? "fill-amber-400 text-amber-400" : "text-zinc-200 dark:text-zinc-700")} />
              ))}
            </div>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800">
          {question.expectedTopics.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {question.expectedTopics.map((t) => (
                <span key={t} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                  {t}
                </span>
              ))}
            </div>
          )}

          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Calificación</p>
          <StarRating value={score} onChange={setScore} />

          <textarea
            rows={2}
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />

          <button
            onClick={handleSave}
            disabled={saving || !score}
            className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InterviewerView({ application, existingInterview, questionBank }: Props) {
  const [interview, setInterview] = useState<ExistingInterview | null>(existingInterview);
  const [phase, setPhase] = useState<Phase>(existingInterview?.status ?? "SCHEDULED");
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [qaScores, setQaScores] = useState<QAScore[]>(existingInterview?.qaScores ?? []);

  // Final eval form
  const [codingScore, setCodingScore] = useState(existingInterview?.codingScore ?? 0);
  const [qaScore, setQaScore] = useState(existingInterview?.qaScore ?? 0);
  const [notes, setNotes] = useState(existingInterview?.interviewerNotes ?? "");
  const [recommendation, setRecommendation] = useState<Rec | "">(existingInterview?.recommendation ?? "");
  const [completing, setCompleting] = useState(false);

  // Link copy
  const [copied, setCopied] = useState(false);

  // Poll during active phases so recruiter sees candidate URL delivery without refreshing
  useEffect(() => {
    if (!interview || phase === "SCHEDULED" || phase === "COMPLETED" || phase === "CANCELLED") return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/live-interviews/${interview.id}`).catch(() => null);
      if (!res?.ok) return;
      const { interview: updated } = await res.json().catch(() => ({}));
      if (!updated) return;
      setInterview((iv) => iv ? {
        ...iv,
        githubUrl: updated.githubUrl ?? iv.githubUrl,
        liveUrl: updated.liveUrl ?? iv.liveUrl,
        submittedAt: updated.submittedAt ?? iv.submittedAt,
      } : iv);
    }, 10_000);
    return () => clearInterval(id);
  }, [phase, interview?.id]);

  const codingSeconds = useCountdown(interview?.codingStartedAt ?? null, interview?.codingMinutes ?? 50);
  const qaSeconds = useCountdown(interview?.qaStartedAt ?? null, interview?.qaMinutes ?? 40);

  const candidateLink = interview
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/live-interview/${interview.id}`
    : "";

  const copyLink = () => {
    if (!candidateLink) return;
    navigator.clipboard.writeText(candidateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doPhase = useCallback(async (action: string) => {
    if (!interview) return;
    setPhaseLoading(true);
    try {
      const res = await fetch(`/api/live-interviews/${interview.id}/phase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) { toast.error("Error al cambiar fase"); return; }
      const { interview: updated } = await res.json();
      setInterview((iv) => iv ? { ...iv, ...updated } : iv);
      setPhase(updated.status);
    } catch { toast.error("Error de conexión"); }
    finally { setPhaseLoading(false); }
  }, [interview]);

  const handleComplete = useCallback(async () => {
    if (!interview || !recommendation) { toast.error("Selecciona una recomendación"); return; }
    setCompleting(true);
    try {
      const res = await fetch(`/api/live-interviews/${interview.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codingScore, qaScore, interviewerNotes: notes, recommendation }),
      });
      if (!res.ok) { toast.error("Error al finalizar"); return; }
      const { interview: updated } = await res.json();
      setInterview((iv) => iv ? { ...iv, ...updated } : iv);
      setPhase("COMPLETED");
      toast.success("Entrevista finalizada");
    } catch { toast.error("Error de conexión"); }
    finally { setCompleting(false); }
  }, [interview, codingScore, qaScore, notes, recommendation]);

  const handleQAScored = (questionId: string, score: number, questionNotes: string) => {
    const q = questionBank.find((q) => q.id === questionId)!;
    setQaScores((prev) => {
      const without = prev.filter((s) => s.questionId !== questionId);
      return [...without, { questionId, score, notes: questionNotes, question: { id: q.id, question: q.question, expectedTopics: q.expectedTopics, category: q.category } }];
    });
    // autoQaScore is computed reactively from qaScores state on every render
  };

  const isUrgent = (codingSeconds ?? Infinity) < 300;
  const qaIsUrgent = (qaSeconds ?? Infinity) < 300;
  const scoredCount = qaScores.length;
  const autoQaScore = scoredCount > 0
    ? Math.round((qaScores.reduce((a, s) => a + s.score, 0) / scoredCount / 5) * 100)
    : null;

  // ── No interview yet ────────────────────────────────────────────────────────
  if (!interview) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <User className="h-5 w-5 text-zinc-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {application.candidate.name ?? application.candidate.email}
            </p>
            <p className="text-xs text-zinc-500">{application.job.title}</p>
          </div>
        </div>
        <SetupForm
          application={application}
          onCreated={(iv) => { setInterview(iv); setPhase("SCHEDULED"); }}
        />
      </div>
    );
  }

  // ── Session exists ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <User className="h-4 w-4 text-zinc-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {application.candidate.name ?? application.candidate.email}
            </p>
            <p className="text-xs text-zinc-500">{interview.challengeTitle}</p>
          </div>
        </div>

        {/* Active timer */}
        {phase === "CODING_PHASE" && codingSeconds !== null && (
          <div className={clsx(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums",
            isUrgent ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
          )}>
            <Clock className="h-4 w-4 shrink-0" />
            {fmt(codingSeconds)}
          </div>
        )}
        {phase === "QA_PHASE" && qaSeconds !== null && (
          <div className={clsx(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums",
            qaIsUrgent ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          )}>
            <Clock className="h-4 w-4 shrink-0" />
            {fmt(qaSeconds)}
          </div>
        )}
      </div>

      {/* Candidate link — always visible while not completed */}
      {phase !== "COMPLETED" && phase !== "CANCELLED" && (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="min-w-0 flex-1 truncate text-xs text-zinc-500">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Link del candidato: </span>
            {candidateLink}
          </p>
          <button
            onClick={copyLink}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          {interview.videoCallUrl && (
            <a
              href={interview.videoCallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Video className="h-3.5 w-3.5" />
              Meet
            </a>
          )}
        </div>
      )}

      {/* ── SCHEDULED ── */}
      {phase === "SCHEDULED" && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Clock className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Sesión lista</h2>
          <p className="mt-1 text-sm text-zinc-500">Comparte el link con el candidato y cuando estén en la llamada, inicia el timer.</p>
          <button
            onClick={() => doPhase("start_coding")}
            disabled={phaseLoading}
            className="mx-auto mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {phaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Iniciar coding ({interview.codingMinutes} min)
          </button>
        </div>
      )}

      {/* ── CODING_PHASE ── */}
      {phase === "CODING_PHASE" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Fase 1: Coding en vivo</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  El candidato está construyendo su app. Cuando entregue sus links o se acabe el tiempo, termina esta fase.
                </p>
              </div>
              <button
                onClick={() => doPhase("end_coding")}
                disabled={phaseLoading}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700"
              >
                {phaseLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                Terminar coding
              </button>
            </div>
          </div>

          {/* Challenge summary */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-1 text-xs font-semibold text-zinc-400">CHALLENGE</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{interview.challengeTitle}</p>
            {interview.apiName && (
              <p className="mt-0.5 text-xs text-zinc-500">API: {interview.apiName}</p>
            )}
          </div>
        </div>
      )}

      {/* ── REVIEW_PAUSE ── */}
      {phase === "REVIEW_PAUSE" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Revisando entregables</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Abre el repo y la app en vivo. Cuando estés listo, inicia las preguntas.</p>
          </div>

          {(interview.githubUrl || interview.liveUrl) && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-3 text-xs font-semibold text-zinc-400">ENTREGABLES DEL CANDIDATO</p>
              <div className="space-y-2">
                {interview.githubUrl && (
                  <a
                    href={interview.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300"
                  >
                    <Github className="h-4 w-4 text-zinc-400" />
                    <span className="min-w-0 flex-1 truncate">{interview.githubUrl}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  </a>
                )}
                {interview.liveUrl && (
                  <a
                    href={interview.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300"
                  >
                    <Globe className="h-4 w-4 text-zinc-400" />
                    <span className="min-w-0 flex-1 truncate">{interview.liveUrl}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  </a>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => doPhase("start_qa")}
            disabled={phaseLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {phaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Iniciar Q&A ({interview.qaMinutes} min)
          </button>
        </div>
      )}

      {/* ── QA_PHASE ── */}
      {phase === "QA_PHASE" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800/40 dark:bg-blue-950/20">
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Fase 2: Preguntas sin ayuda externa</p>
              <p className="text-xs text-blue-700 dark:text-blue-400">{scoredCount}/{questionBank.length} preguntas respondidas</p>
            </div>
            {scoredCount > 0 && (
              <span className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-bold text-white">
                {autoQaScore ?? qaScore}%
              </span>
            )}
          </div>

          {/* Deliverables (collapsed) */}
          {(interview.githubUrl || interview.liveUrl) && (
            <div className="flex flex-wrap gap-2">
              {interview.githubUrl && (
                <a href={interview.githubUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                  <Github className="h-3.5 w-3.5" /> Repo
                </a>
              )}
              {interview.liveUrl && (
                <a href={interview.liveUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                  <Globe className="h-3.5 w-3.5" /> App en vivo
                </a>
              )}
            </div>
          )}

          <div className="space-y-2">
            {questionBank.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                existingScore={qaScores.find((s) => s.questionId === q.id)}
                interviewId={interview.id}
                onScored={handleQAScored}
              />
            ))}
          </div>

          {/* Complete button (appears after ≥ 3 scored) */}
          {scoredCount >= 3 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-100">Evaluación final</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Score coding (0-100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={codingScore}
                    onChange={(e) => setCodingScore(Number(e.target.value))}
                    className="h-11 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Score Q&A (0-100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={autoQaScore ?? qaScore}
                    onChange={(e) => setQaScore(Number(e.target.value))}
                    className="h-11 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                Score final: <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {Math.round(codingScore * 0.6 + (autoQaScore ?? qaScore) * 0.4)}
                </span>
                <span className="ml-1 text-xs text-zinc-400">(60% coding + 40% Q&A)</span>
              </div>

              <div className="mt-3">
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notas del entrevistador</label>
                <textarea
                  rows={3}
                  placeholder="Fortalezas, áreas de mejora, observaciones..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="mt-3">
                <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Recomendación</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["HIRE", "MAYBE", "REJECT"] as Rec[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRecommendation(r)}
                      className={clsx(
                        "h-10 rounded-lg border text-sm font-semibold transition",
                        recommendation === r
                          ? r === "HIRE" ? "border-emerald-500 bg-emerald-600 text-white"
                            : r === "MAYBE" ? "border-amber-500 bg-amber-500 text-white"
                            : "border-red-500 bg-red-600 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                      )}
                    >
                      {r === "HIRE" ? "Contratar" : r === "MAYBE" ? "Tal vez" : "Rechazar"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleComplete}
                disabled={completing || !recommendation}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Finalizar entrevista
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── COMPLETED ── */}
      {phase === "COMPLETED" && interview.finalScore !== null && (
        <div className="space-y-3">
          <div className={clsx(
            "rounded-xl border p-5 text-center",
            interview.recommendation === "HIRE"
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
              : interview.recommendation === "MAYBE"
              ? "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20"
              : "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
          )}>
            <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100">{interview.finalScore}</p>
            <p className="text-sm font-medium text-zinc-500">Score final</p>
            <span className={clsx(
              "mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold",
              interview.recommendation === "HIRE" ? "bg-emerald-600 text-white"
                : interview.recommendation === "MAYBE" ? "bg-amber-500 text-white"
                : "bg-red-600 text-white"
            )}>
              {interview.recommendation === "HIRE" ? "Contratar"
                : interview.recommendation === "MAYBE" ? "Tal vez"
                : "Rechazar"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{interview.codingScore}</p>
              <p className="text-xs text-zinc-500">Coding (60%)</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{interview.qaScore}</p>
              <p className="text-xs text-zinc-500">Q&A (40%)</p>
            </div>
          </div>

          {interview.interviewerNotes && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-2 text-xs font-semibold text-zinc-400">NOTAS</p>
              <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{interview.interviewerNotes}</p>
            </div>
          )}

          {qaScores.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-3 text-xs font-semibold text-zinc-400">DETALLE Q&A</p>
              <div className="space-y-3">
                {qaScores.map((s) => (
                  <div key={s.questionId}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{s.question.question}</p>
                      <div className="flex shrink-0 gap-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={clsx("h-3.5 w-3.5", n <= s.score ? "fill-amber-400 text-amber-400" : "text-zinc-200 dark:text-zinc-700")} />
                        ))}
                      </div>
                    </div>
                    {s.notes && <p className="mt-0.5 text-xs text-zinc-400">{s.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
