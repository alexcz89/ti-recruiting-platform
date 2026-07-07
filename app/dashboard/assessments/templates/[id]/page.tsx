// app/dashboard/assessments/templates/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { headers, cookies } from "next/headers";
import Link from "next/link";
import {
  ArrowLeft, BookOpen, Clock, BarChart3, CheckCircle2,
  Code2, Layers, Pencil, Sparkles, CheckCheck, X,
  ListOrdered, Hash, AlignLeft,
} from "lucide-react";
import { authOptions } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type Difficulty = "JUNIOR" | "MID" | "SENIOR";
type AssessmentType = "MCQ" | "CODING" | "MIXED";
type QuestionType = "MULTIPLE_CHOICE" | "CODING";

type Option = { id: string; text: string; isCorrect: boolean };

type Question = {
  id: string;
  type: QuestionType;
  questionText: string;
  section: string;
  difficulty: Difficulty;
  explanation: string | null;
  options: Option[] | string;
  allowMultiple: boolean;
  codeSnippet: string | null;
  starterCode: string | null;
  language: string | null;
};

type Template = {
  id: string;
  title: string;
  description: string;
  type: AssessmentType;
  difficulty: Difficulty;
  language: string | null;
  passingScore: number;
  timeLimit: number;
  allowRetry: boolean;
  maxAttempts: number;
  isGlobal: boolean;
  companyId: string | null;
  questions: Question[];
};

function getBaseUrl() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  const env = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  return (env ? (env.startsWith("http") ? env : `https://${env}`) : "http://localhost:3000").replace(/\/$/, "");
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; dot: string }> = {
  JUNIOR: { label: "Junior",    dot: "bg-emerald-500", color: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50" },
  MID:    { label: "Mid Level", dot: "bg-blue-500",    color: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50" },
  SENIOR: { label: "Senior",    dot: "bg-rose-500",    color: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/50" },
};

const TYPE_CONFIG: Record<AssessmentType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  MCQ:    { label: "Opción múltiple", icon: CheckCircle2 },
  CODING: { label: "Código",          icon: Code2 },
  MIXED:  { label: "Mixto",           icon: Layers },
};

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript", python: "Python", cpp: "C++", java: "Java",
};

function parseOptions(raw: Option[] | string): Option[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

type PageProps = { params: { id: string } };

export default async function TemplateDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const role = String((session.user as any).role ?? "").toUpperCase();
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const baseUrl = getBaseUrl();
  const cookieHeader = cookies().toString();

  const res = await fetch(`${baseUrl}/api/dashboard/assessments/templates/${params.id}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  if (!res.ok) notFound();
  const template: Template = await res.json();

  const diffConfig = DIFFICULTY_CONFIG[template.difficulty ?? "JUNIOR"];
  const TypeIcon = TYPE_CONFIG[template.type]?.icon ?? CheckCircle2;
  const typeLabel = TYPE_CONFIG[template.type]?.label ?? template.type;
  const canEdit = !template.isGlobal || role === "ADMIN";

  // Group questions by section
  const bySection = template.questions.reduce<Record<string, Question[]>>((acc, q) => {
    const sec = q.section || "General";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(q);
    return acc;
  }, {});

  const sectionNames = Object.keys(bySection);
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-5 space-y-5">

        {/* Breadcrumb + back */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/dashboard/assessments/templates" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Templates
          </Link>
          <span>/</span>
          <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate max-w-xs">{template.title}</span>
        </div>

        {/* Header card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <div className="h-1.5 w-full bg-emerald-500" />
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${template.type === "CODING" ? "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
                    <TypeIcon className="h-3.5 w-3.5" />
                    {typeLabel}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${diffConfig.color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${diffConfig.dot}`} />
                    {diffConfig.label}
                  </span>
                  {template.language && (
                    <span className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                      {LANGUAGE_LABELS[template.language] ?? template.language}
                    </span>
                  )}
                  {!template.isGlobal && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-600/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Mi template
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">{template.title}</h1>
                {template.description && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{template.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                {canEdit && (
                  <Link
                    href={`/dashboard/assessments/builder?edit=${template.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Link>
                )}
                <Link
                  href={`/dashboard/jobs?assignTemplate=${template.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Asignar a vacante
                </Link>
              </div>
            </div>

            {/* Métricas */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              {[
                { value: template.questions.length, label: "Preguntas totales", icon: ListOrdered, color: "text-teal-600 dark:text-teal-400" },
                { value: `${template.timeLimit} min`, label: "Tiempo límite", icon: Clock, color: "text-blue-600 dark:text-blue-400" },
                { value: `${template.passingScore}%`, label: "Puntaje mínimo", icon: BarChart3, color: "text-emerald-600 dark:text-emerald-400" },
                { value: sectionNames.length, label: "Secciones", icon: Hash, color: "text-amber-600 dark:text-amber-400" },
              ].map(({ value, label, icon: Icon, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-xl font-black ${color}`}>{value}</p>
                  <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Secciones y preguntas */}
        <div className="space-y-6">
          {sectionNames.map((sectionName, sIdx) => {
            const questions = bySection[sectionName];
            return (
              <section key={sectionName}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 rounded-lg px-3 py-1.5">
                    <AlignLeft className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" />
                    <span className="text-xs font-black text-white dark:text-zinc-900 uppercase tracking-wider">{sectionName}</span>
                  </div>
                  <span className="text-xs text-zinc-400">{questions.length} pregunta{questions.length !== 1 ? "s" : ""}</span>
                  <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
                </div>

                <div className="space-y-3">
                  {questions.map((q, qIdx) => {
                    const opts = parseOptions(q.options);

                    return (
                      <div key={q.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                        {/* Question header */}
                        <div className="flex items-start gap-3 p-4 pb-3">
                          <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-black text-zinc-600 dark:text-zinc-400">
                            {qIdx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              {q.allowMultiple && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-300">
                                  <CheckCheck className="h-2.5 w-2.5" />
                                  Selección múltiple
                                </span>
                              )}
                            </div>
                            {/* Question text — handle code blocks in text */}
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line">
                              {q.questionText}
                            </p>
                          </div>
                        </div>

                        {/* Code snippet if present */}
                        {q.codeSnippet && (
                          <div className="mx-4 mb-3 rounded-lg bg-zinc-950 dark:bg-zinc-950 border border-zinc-800 overflow-x-auto">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
                              <div className="flex gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                                <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                              </div>
                              <span className="text-[9px] text-zinc-500 font-mono">{q.language ?? "java"}</span>
                            </div>
                            <pre className="p-3 text-xs text-zinc-200 font-mono leading-relaxed overflow-x-auto">
                              <code>{q.codeSnippet}</code>
                            </pre>
                          </div>
                        )}

                        {/* Options */}
                        {opts.length > 0 && (
                          <div className="px-4 pb-4 space-y-1.5">
                            {opts.map((opt, oIdx) => (
                              <div
                                key={opt.id ?? oIdx}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition
                                  ${opt.isCorrect
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50"
                                    : "bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800"
                                  }`}
                              >
                                {/* Radio/checkbox indicator */}
                                <div className={`flex-shrink-0 h-4 w-4 rounded-${q.allowMultiple ? "sm" : "full"} border-2 flex items-center justify-center
                                  ${opt.isCorrect
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                                  }`}
                                >
                                  {opt.isCorrect && <CheckCircle2 className="h-3 w-3 text-white" />}
                                </div>

                                <span className={`flex-1 text-sm ${opt.isCorrect ? "font-semibold text-emerald-800 dark:text-emerald-200" : "text-zinc-700 dark:text-zinc-300"}`}>
                                  {opt.text}
                                </span>

                                {opt.isCorrect && (
                                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                    ✓ Correcto
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="mx-4 mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-3 py-2">
                            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-0.5">Explicación</p>
                            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href="/dashboard/assessments/templates"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a templates
          </Link>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link href={`/dashboard/assessments/builder?edit=${template.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                <Pencil className="h-3.5 w-3.5" />
                Editar template
              </Link>
            )}
            <Link href={`/dashboard/jobs?assignTemplate=${template.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition">
              <Sparkles className="h-3.5 w-3.5" />
              Asignar a vacante
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
