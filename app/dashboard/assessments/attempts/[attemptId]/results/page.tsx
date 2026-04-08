// app/dashboard/assessments/attempts/[attemptId]/results/page.tsx
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Target,
  User,
  ChevronLeft,
  ShieldAlert,
  Trophy,
  Zap,
  Eye,
  Code2,
} from "lucide-react";

type Option = {
  id?: string;
  value?: string;
  text?: string;
  label?: string;
  isCorrect?: boolean;
};

type Answer = {
  questionId: string;
  section: string;
  difficulty: string;
  questionText: string;
  codeSnippet?: string | null;
  options: Option[];
  selectedOptions: string[];
  isCorrect: boolean | null;
  pointsEarned: number | null;
  timeSpent?: number | null;
  explanation?: string | null;
  // ✅ Campos CODING
  type?: string | null;
  codeSubmission?: string | null;
  language?: string | null;
  passedTests?: number;
  totalTests?: number;
};

type SectionScore = Record<string, number>;

type FlagsJson = {
  tooFast?: boolean;
  [key: string]: unknown;
};

type Anticheat = {
  tooFast: boolean;
  tabSwitches: number;
  visibilityHidden: number;
  copyAttempts: number;
  pasteAttempts: number;
  rightClicks: number;
  focusLoss: number;
  pageHides: number;
  multiSession: boolean;
  severity: string;
  severityScore: number;
};

type ResultsData = {
  attempt: {
    id: string;
    status: string;
    attemptNumber?: number;
    startedAt?: string;
    submittedAt?: string;
    timeSpent?: number;
    totalScore?: number;
    sectionScores?: SectionScore;
    passed?: boolean;
    flagsJson?: FlagsJson;
    anticheat?: Anticheat;
  };
  template: {
    id: string;
    title: string;
    difficulty?: string;
    passingScore?: number;
    sections?: string[];
  };
  candidate?: {
    id: string;
    name?: string;
    email?: string;
  };
  answers: Answer[];
  stats: {
    correctAnswers?: number;
    answeredQuestions: number;
    totalQuestions: number;
    accuracy?: number;
  };
  summaryOnly: boolean;
};

const CODE_SENTINEL = "__CODE_SUBMITTED__";

function formatTime(seconds?: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getOptionKey(o: Option): string {
  return String(o.id ?? o.value ?? JSON.stringify(o));
}

function getOptionLabel(o: Option): string {
  return String(o.text ?? o.label ?? o.value ?? o.id ?? "");
}

function scoreColor(score: number, passing: number) {
  if (score >= passing) return "text-emerald-600 dark:text-emerald-400";
  if (score >= passing * 0.7) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function scoreBg(score: number, passing: number) {
  if (score >= passing) {
    return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800";
  }
  if (score >= passing * 0.7) {
    return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
  }
  return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
}

function difficultyBadge(d: string) {
  const map: Record<string, string> = {
    JUNIOR: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    MID: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    SENIOR: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  };
  return map[d?.toUpperCase()] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  return "http://localhost:3000";
}

async function getResults(attemptId: string): Promise<ResultsData | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return null;

    const res = await fetch(
      `${getBaseUrl()}/api/assessments/attempts/${encodeURIComponent(attemptId)}/results`,
      {
        method: "GET",
        cache: "no-store",
        headers: { cookie: headers().get("cookie") ?? "" },
      }
    );

    if (!res.ok) return null;
    return (await res.json()) as ResultsData;
  } catch (error) {
    console.error("[results/page] error", error);
    return null;
  }
}

function AnticheatFlags({ anticheat }: { anticheat: Anticheat }) {
  type Item = { label: string; value: string; warn: boolean };
  const items: Item[] = [];

  if (anticheat.tooFast) items.push({ label: "Velocidad sospechosa", value: "Sí — promedio < 5s por pregunta", warn: true });
  if (anticheat.tabSwitches > 0) items.push({ label: "Cambios de pestaña", value: String(anticheat.tabSwitches), warn: anticheat.tabSwitches >= 3 });
  if (anticheat.visibilityHidden > 0) items.push({ label: "Ocultó la pestaña", value: String(anticheat.visibilityHidden), warn: anticheat.visibilityHidden >= 3 });
  if (anticheat.copyAttempts > 0) items.push({ label: "Intentos de copiar", value: String(anticheat.copyAttempts), warn: true });
  if (anticheat.pasteAttempts > 0) items.push({ label: "Intentos de pegar", value: String(anticheat.pasteAttempts), warn: true });
  if (anticheat.rightClicks > 0) items.push({ label: "Click derecho", value: String(anticheat.rightClicks), warn: anticheat.rightClicks >= 5 });
  if (anticheat.focusLoss > 0) items.push({ label: "Pérdidas de foco", value: String(anticheat.focusLoss), warn: anticheat.focusLoss >= 5 });
  if (anticheat.pageHides > 0) items.push({ label: "Page hides", value: String(anticheat.pageHides), warn: anticheat.pageHides >= 3 });
  if (anticheat.multiSession) items.push({ label: "Múltiples dispositivos", value: "Detectado", warn: true });

  const severity = String(anticheat.severity ?? "NORMAL").toUpperCase();
  const severityColor = { CRITICAL: "text-red-600 dark:text-red-400", SUSPICIOUS: "text-amber-600 dark:text-amber-400", NORMAL: "text-emerald-600 dark:text-emerald-400" }[severity] ?? "text-gray-500";
  const severityLabel = severity === "CRITICAL" ? "🔴 Crítico" : severity === "SUSPICIOUS" ? "🟡 Sospechoso" : "🟢 Normal";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-sm font-semibold ${severityColor}`}>{severityLabel}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">Score: {anticheat.severityScore ?? 0}</span>
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Sin alertas detectadas</span>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm ${item.warn ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"}`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-medium">{item.label}:</span>{" "}
                <span>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ✅ Nuevo componente para preguntas CODING
function CodingAnswerCard({ answer, index }: { answer: Answer; index: number }) {
  const passed = (answer.passedTests ?? 0);
  const total = (answer.totalTests ?? 0);
  const points = typeof answer.pointsEarned === "number" ? answer.pointsEarned : 0;
  const allPassed = total > 0 && passed === total;

  return (
    <div className={`rounded-xl border bg-white p-4 dark:bg-gray-900 sm:p-5 ${allPassed ? "border-emerald-200 dark:border-emerald-800" : "border-amber-200 dark:border-amber-800"}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${allPassed ? "text-emerald-500" : "text-amber-500"}`}>
          <Code2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">#{index + 1}</span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              Coding
            </span>
            {answer.section && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {answer.section}
              </span>
            )}
            {answer.difficulty && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${difficultyBadge(answer.difficulty)}`}>
                {answer.difficulty}
              </span>
            )}
            {answer.language && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {answer.language}
              </span>
            )}
            {answer.timeSpent != null && (
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Clock className="h-3 w-3" />
                {formatTime(answer.timeSpent)}
              </span>
            )}
          </div>
          <div className="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-gray-200 prose-code:rounded prose-code:bg-violet-500/10 prose-code:px-1 prose-code:text-violet-700 prose-pre:bg-gray-100 dark:prose-code:text-violet-400 dark:prose-pre:bg-gray-800">
            <ReactMarkdown>{answer.questionText}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Tests pasados */}
      <div className="mb-3 ml-8 flex items-center gap-3">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${allPassed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
          {allPassed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
          {passed}/{total} tests pasados
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {points} pts obtenidos
        </span>
      </div>

      {/* Código enviado */}
      {answer.codeSubmission ? (
        <div className="ml-8 overflow-hidden rounded-lg border border-gray-800 bg-gray-950 dark:bg-gray-900">
          <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-1.5">
            <Code2 className="h-3 w-3 text-gray-500" />
            <span className="text-xs text-gray-500">Código enviado</span>
          </div>
          <pre className="max-h-64 overflow-auto px-4 py-3 text-xs leading-relaxed text-gray-300">
            <code>{answer.codeSubmission}</code>
          </pre>
        </div>
      ) : (
        <div className="ml-8 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Sin solución enviada
        </div>
      )}
    </div>
  );
}

function AnswerCard({ answer, index }: { answer: Answer; index: number }) {
  // ✅ Detectar preguntas CODING
  const isCoding =
    String(answer.type ?? "").toUpperCase() === "CODING" ||
    (Array.isArray(answer.selectedOptions) && answer.selectedOptions.includes(CODE_SENTINEL));

  if (isCoding) {
    return <CodingAnswerCard answer={answer} index={index} />;
  }

  return (
    <div className={`rounded-xl border bg-white p-4 dark:bg-gray-900 sm:p-5 ${answer.isCorrect ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-900"}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${answer.isCorrect ? "text-emerald-500" : "text-red-500"}`}>
          {answer.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">#{index + 1}</span>
            {answer.section && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {answer.section}
              </span>
            )}
            {answer.difficulty && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${difficultyBadge(answer.difficulty)}`}>
                {answer.difficulty}
              </span>
            )}
            {answer.timeSpent != null && (
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Clock className="h-3 w-3" />
                {formatTime(answer.timeSpent)}
              </span>
            )}
          </div>
          <div className="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-gray-200 prose-code:rounded prose-code:bg-violet-500/10 prose-code:px-1 prose-code:text-violet-700 prose-pre:bg-gray-100 dark:prose-code:text-violet-400 dark:prose-pre:bg-gray-800">
            <ReactMarkdown>{answer.questionText}</ReactMarkdown>
          </div>
        </div>
      </div>

      {answer.codeSnippet && (
        <div className="mb-3 overflow-hidden rounded-lg border border-gray-800 bg-gray-950 dark:bg-gray-900">
          <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-1.5">
            <Code2 className="h-3 w-3 text-gray-500" />
            <span className="text-xs text-gray-500">código</span>
          </div>
          <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-gray-300">
            <code>{answer.codeSnippet}</code>
          </pre>
        </div>
      )}

      <div className="ml-0 space-y-2 sm:ml-8">
        {answer.options.map((opt) => {
          const key = getOptionKey(opt);
          const label = getOptionLabel(opt);
          const isSelected = answer.selectedOptions.includes(key);
          const isCorrectOpt = Boolean(opt.isCorrect);

          let cls = "flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm border transition-colors";

          if (isCorrectOpt && isSelected) {
            cls += " bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200";
          } else if (isCorrectOpt && !isSelected) {
            cls += " bg-emerald-50/50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300";
          } else if (!isCorrectOpt && isSelected) {
            cls += " bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-200";
          } else {
            cls += " bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400";
          }

          return (
            <div key={key} className={cls}>
              <div className="mt-0.5 shrink-0">
                {isCorrectOpt ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : isSelected ? (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-gray-300 dark:border-gray-600" />
                )}
              </div>
              <span className="leading-relaxed">{label}</span>
              {isSelected && !isCorrectOpt && (
                <span className="ml-auto shrink-0 text-xs font-medium text-red-500 dark:text-red-400">
                  Seleccionada
                </span>
              )}
            </div>
          );
        })}
      </div>

      {answer.explanation && (
        <div className="mt-3 ml-0 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-950/30 sm:ml-8">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-300">
            {answer.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

export default async function AttemptResultsPage({
  params,
}: {
  params: { attemptId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin");

  const role = String((session.user as { role?: string }).role ?? "").toUpperCase();
  if (!["RECRUITER", "ADMIN"].includes(role)) notFound();

  const data = await getResults(params.attemptId);
  if (!data) notFound();

  const { attempt, template, candidate, answers, stats } = data;

  const score = Math.min(100, attempt.totalScore ?? 0);
  const passing = template.passingScore ?? 70;
  const passed = attempt.passed ?? score >= passing;

  const anticheat: Anticheat = attempt.anticheat ?? {
    tooFast: false,
    tabSwitches: 0,
    visibilityHidden: 0,
    copyAttempts: 0,
    pasteAttempts: 0,
    rightClicks: 0,
    focusLoss: 0,
    pageHides: 0,
    multiSession: false,
    severity: "NORMAL",
    severityScore: 0,
  };

  const severity = String(anticheat.severity ?? "NORMAL").toUpperCase();

  const hasSuspiciousFlags =
    anticheat.tooFast ||
    anticheat.tabSwitches >= 3 ||
    anticheat.visibilityHidden >= 3 ||
    anticheat.copyAttempts > 0 ||
    anticheat.pasteAttempts > 0 ||
    anticheat.rightClicks >= 5 ||
    anticheat.focusLoss >= 5 ||
    anticheat.pageHides >= 3 ||
    anticheat.multiSession ||
    severity === "CRITICAL" ||
    severity === "SUSPICIOUS";

  const sectionScores = attempt.sectionScores ?? {};

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        {/* ✅ Fix: link correcto al panel de evaluaciones */}
        <Link
          href="/dashboard/assessments"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a evaluaciones
        </Link>

        {/* Header con score */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2 sm:h-24 sm:w-24 ${scoreBg(score, passing)}`}>
              <span className={`text-2xl font-bold sm:text-3xl ${scoreColor(score, passing)}`}>
                {score}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">/100</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
                  {template.title}
                </h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                  {passed ? <><Trophy className="h-3 w-3" />Aprobado</> : <><XCircle className="h-3 w-3" />No aprobado</>}
                </span>
                {hasSuspiciousFlags && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    <ShieldAlert className="h-3 w-3" />Anti-cheat
                  </span>
                )}
              </div>

              {candidate && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span>{candidate.name ?? candidate.email}</span>
                  {candidate.name && candidate.email && (
                    <span className="text-gray-400 dark:text-gray-600">· {candidate.email}</span>
                  )}
                  {candidate.id && (
                    <Link
                      href={`/dashboard/candidates/${candidate.id}`}
                      className="ml-1 text-xs text-violet-600 hover:underline dark:text-violet-400"
                    >
                      Ver perfil →
                    </Link>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Target className="h-4 w-4 text-gray-400" />
                  <span>Mínimo: <strong className="text-gray-800 dark:text-gray-200">{passing}%</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span><strong className="text-gray-800 dark:text-gray-200">{stats.correctAnswers ?? "—"}</strong>/{stats.totalQuestions} correctas</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>{formatTime(attempt.timeSpent)}</span>
                </div>
                {stats.accuracy != null && (
                  <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span>Precisión: <strong className="text-gray-800 dark:text-gray-200">{stats.accuracy}%</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Secciones + Anti-cheat */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Object.keys(sectionScores).length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Resultados por sección
              </h2>
              <div className="space-y-3">
                {Object.entries(sectionScores).map(([section, pct]) => (
                  <div key={section}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{section}</span>
                      <span className={`text-xs font-semibold ${scoreColor(Number(pct), passing)}`}>
                        {Math.min(100, Math.round(Number(pct)))}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full transition-all ${Number(pct) >= passing ? "bg-emerald-400" : Number(pct) >= passing * 0.7 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${Math.min(100, Math.round(Number(pct)))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`rounded-2xl border bg-white p-5 dark:bg-gray-900 ${hasSuspiciousFlags ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-800"}`}>
            <div className="mb-4 flex items-center gap-2">
              <ShieldAlert className={`h-4 w-4 ${hasSuspiciousFlags ? "text-red-500" : "text-gray-400"}`} />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Anti-cheat</h2>
            </div>
            <AnticheatFlags anticheat={anticheat} />
          </div>
        </div>

        {/* Respuestas */}
        {!data.summaryOnly && answers.length > 0 && (
          <div className="space-y-3">
            <h2 className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Desglose de respuestas ({answers.length})
            </h2>
            {answers.map((answer, i) => (
              <AnswerCard key={answer.questionId} answer={answer} index={i} />
            ))}
          </div>
        )}

        {data.summaryOnly && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
            <Eye className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              El desglose de respuestas no está disponible para esta vista.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}