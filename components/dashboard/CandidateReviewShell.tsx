// components/dashboard/CandidateReviewShell.tsx
"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, ChevronLeft, ChevronRight, GitBranch,
  CheckCircle2, Clock, Star, FileText, User, ClipboardList,
  Sparkles, ThumbsUp, XCircle,
  Download, MessageCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavEntry = {
  candidateId: string;
  applicationId: string;
  name: string;
  seniority: string | null;
  location: string | null;
  status: string;
  recruiterInterest: string;
  starred: boolean;
};

export type AppState = {
  id: string;
  status: string;
  recruiterInterest: string;
  internalNotes: string | null;
  starred: boolean;
  createdAt: string;
  submittedAt: string;
  reviewingAt: string | null;
  interviewAt: string | null;
  offerAt: string | null;
  hiredAt: string | null;
  rejectedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
};

export type ShellProps = {
  // Candidate
  candidateId: string;
  candidateName: string | null;
  candidateSeniority: string | null;
  candidateLocation: string | null;
  resumeUrl: string | null;
  waHref: string | null;

  // Job context
  fromJobId: string | null | undefined;
  jobTitle: string | null;
  matchScore: number | null;
  matchLocked: boolean;

  // Application
  applicationId: string;
  currentApplication: AppState | null;

  // Navigation
  navList: NavEntry[];
  navIndex: number;

  // Slot content
  slots: {
    summary: React.ReactNode;
    profile: React.ReactNode;
    cv: React.ReactNode | null;
    assessments: React.ReactNode | null;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Debe coincidir exactamente con el kanban (page.tsx de applications):
// REVIEW → "Por revisar" | MAYBE → "Preselecto" | ACCEPTED → "Entrevista" | REJECTED → "Descartado"
const INTEREST_MAP: Record<string, { label: string; short: string; color: string; activeColor: string }> = {
  REVIEW:    { label: "Por revisar",  short: "Revisar",     color: "border-zinc-300 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800",                                                             activeColor: "border-zinc-500 bg-zinc-100 text-zinc-900 font-semibold dark:border-zinc-400 dark:bg-zinc-700 dark:text-zinc-100" },
  MAYBE:     { label: "Preselecto",   short: "Preselecto",  color: "border-violet-300 text-violet-600 hover:bg-violet-50 dark:border-violet-600/50 dark:text-violet-400 dark:hover:bg-violet-900/20",                                            activeColor: "border-violet-500 bg-violet-100 text-violet-900 font-semibold dark:border-violet-400 dark:bg-violet-900/40 dark:text-violet-100" },
  ACCEPTED:  { label: "Entrevista",   short: "Entrevista",  color: "border-sky-300 text-sky-600 hover:bg-sky-50 dark:border-sky-600/50 dark:text-sky-400 dark:hover:bg-sky-900/20",                                                              activeColor: "border-sky-500 bg-sky-100 text-sky-900 font-semibold dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-100" },
  REJECTED:  { label: "Descartado",   short: "Descartar",   color: "border-red-300 text-red-500 hover:bg-red-50 dark:border-red-700/50 dark:text-red-400 dark:hover:bg-red-900/20",                                                              activeColor: "border-red-500 bg-red-100 text-red-900 font-semibold dark:border-red-400 dark:bg-red-900/40 dark:text-red-100" },
};

const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Jr", MID: "Mid", SENIOR: "Sr", LEAD: "Lead",
};

const INTEREST_ICON: Record<string, React.ReactNode> = {
  MAYBE:    <ThumbsUp className="h-3.5 w-3.5" />,   // Preselecto
  ACCEPTED: <User className="h-3.5 w-3.5" />,        // Entrevista
  REJECTED: <XCircle className="h-3.5 w-3.5" />,     // Descartar
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  MAYBE:     <ThumbsUp className="h-3 w-3 text-violet-500 dark:text-violet-400" />,   // Preselecto
  ACCEPTED:  <User className="h-3 w-3 text-sky-500 dark:text-sky-400" />,              // Entrevista
  REJECTED:  <XCircle className="h-3 w-3 text-red-500 dark:text-red-400" />,           // Descartado
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "summary",     label: "Resumen IA", icon: Sparkles },
  { id: "profile",     label: "Perfil",     icon: User },
  { id: "cv",          label: "CV",         icon: FileText },
  { id: "assessments", label: "Evaluaciones", icon: ClipboardList },
] as const;

type TabId = typeof TABS[number]["id"];

// ─── Helper ───────────────────────────────────────────────────────────────────

function navUrl(entry: NavEntry, fromJobId: string | null | undefined) {
  return `/dashboard/candidates/${entry.candidateId}?jobId=${fromJobId}&applicationId=${entry.applicationId}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CandidateReviewShell({
  candidateId,
  candidateName,
  candidateSeniority,
  candidateLocation,
  resumeUrl,
  waHref,
  fromJobId,
  jobTitle,
  matchScore,
  matchLocked,
  applicationId,
  currentApplication,
  navList,
  navIndex,
  slots,
}: ShellProps) {
  const [app, setApp] = useState<AppState | null>(currentApplication);
  // currentInterest es estado propio para que el botón se resalte incluso si app es null
  const [currentInterest, setCurrentInterest] = useState<string>(
    currentApplication?.recruiterInterest ??
    (navIndex >= 0 ? navList[navIndex]?.recruiterInterest : undefined) ??
    "REVIEW"
  );
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [notes, setNotes] = useState(currentApplication?.internalNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const notesTimer = useRef<NodeJS.Timeout | null>(null);

  const prevNav = navIndex > 0 ? navList[navIndex - 1] : null;
  const nextNav = navIndex >= 0 && navIndex < navList.length - 1 ? navList[navIndex + 1] : null;

  const visibleTabs = TABS.filter((t) => {
    if (t.id === "cv") return !!resumeUrl;
    if (t.id === "assessments") return !!slots.assessments;
    return true;
  });

  // ── API calls ──────────────────────────────────────────────────────────────

  const patchInterest = useCallback((recruiterInterest: string) => {
    if (!applicationId) return;
    // Actualización optimista inmediata — el botón responde al instante
    setCurrentInterest(recruiterInterest);
    startTransition(async () => {
      const res = await fetch(`/api/applications/${applicationId}/interest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterInterest }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentInterest(data.recruiterInterest);
        setApp((prev) => prev ? { ...prev, recruiterInterest: data.recruiterInterest } : prev);
      } else {
        // Revertir si falla
        setCurrentInterest(app?.recruiterInterest ?? "REVIEW");
      }
    });
  }, [applicationId, app?.recruiterInterest]);

  const saveNotes = useCallback(() => {
    if (!applicationId) return;
    startTransition(async () => {
      const res = await fetch(`/api/applications/${applicationId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    });
  }, [applicationId, notes]);

  // Auto-save notes after 1.5s idle
  useEffect(() => {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    if (notes !== (app?.internalNotes ?? "")) {
      notesTimer.current = setTimeout(saveNotes, 1500);
    }
    return () => { if (notesTimer.current) clearTimeout(notesTimer.current); };
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initials ──────────────────────────────────────────────────────────────

  const initials = (candidateName ?? "C")
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8">

      {/* ── LEFT SIDEBAR — candidate list ────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        {fromJobId && (
          <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 sticky top-12 z-10 bg-white dark:bg-zinc-950">
            <Link
              href={`/dashboard/jobs/${fromJobId}/applications`}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="truncate max-w-[140px]">{jobTitle ?? "Vacante"}</span>
            </Link>
            <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-600">
              {navList.length} candidato{navList.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {navList.map((entry, i) => {
            const isActive = entry.applicationId === applicationId;
            const interest = entry.recruiterInterest;
            return (
              <Link
                key={entry.applicationId}
                href={navUrl(entry, fromJobId)}
                className={`flex flex-col gap-0.5 px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60 transition-colors ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-l-emerald-500"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-medium truncate ${isActive ? "text-emerald-800 dark:text-emerald-200" : "text-zinc-800 dark:text-zinc-200"}`}>
                    {i + 1}. {entry.name}
                  </span>
                  {STATUS_ICON[interest] ?? null}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {entry.seniority && <span>{SENIORITY_LABEL[entry.seniority] ?? entry.seniority}</span>}
                  {entry.seniority && entry.location && <span>·</span>}
                  {entry.location && <span className="truncate">{entry.location.split(",")[0]}</span>}
                </div>
                {entry.recruiterInterest !== "REVIEW" && (
                  <span className={`text-[9px] font-medium ${
                    entry.recruiterInterest === "MAYBE"
                      ? "text-violet-600 dark:text-violet-400"
                      : entry.recruiterInterest === "ACCEPTED"
                      ? "text-sky-600 dark:text-sky-400"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}>
                    {entry.recruiterInterest === "MAYBE" ? "Preselecto"
                    : entry.recruiterInterest === "ACCEPTED" ? "Entrevista"
                    : "Descartado"}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* ── CENTER — sticky header + tabs + content ──────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Sticky header */}
        <div className="sticky top-12 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm px-4 sm:px-6 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            {/* Left: avatar + name + meta */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                    {candidateName ?? "Candidato"}
                  </span>
                  {candidateSeniority && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      {SENIORITY_LABEL[candidateSeniority] ?? candidateSeniority}
                    </span>
                  )}
                  {matchScore != null && !matchLocked && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      matchScore >= 70 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : matchScore >= 40 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                    }`}>
                      {matchScore}% match
                    </span>
                  )}

                </div>
                {candidateLocation && (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{candidateLocation}</p>
                )}
              </div>
            </div>

            {/* Right: quick actions + nav */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {/* Interest buttons */}
              {(["MAYBE", "ACCEPTED", "REJECTED"] as const).map((key) => {
                const m = INTEREST_MAP[key];
                const isSelected = currentInterest === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isPending}
                    onClick={() => patchInterest(isSelected ? "REVIEW" : key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      isSelected ? m.activeColor : m.color
                    }`}
                  >
                    {INTEREST_ICON[key]}
                    {m.short}
                  </button>
                );
              })}

              {/* Divider */}
              <span className="hidden sm:block h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

              {/* Utility buttons */}
              {waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WA
                </a>
              )}
              {resumeUrl && (
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  CV
                </a>
              )}

              {fromJobId && (
                <Link
                  href={`/dashboard/jobs/${fromJobId}`}
                  className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Pipeline
                </Link>
              )}

              {/* Prev / next */}
              {navList.length > 1 && (
                <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                  {prevNav ? (
                    <Link href={navUrl(prevNav, fromJobId)} className="inline-flex h-8 w-8 items-center justify-center rounded-l-lg text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-l-lg text-zinc-300 dark:text-zinc-700">
                      <ChevronLeft className="h-4 w-4" />
                    </span>
                  )}
                  <span className="border-x border-zinc-200 dark:border-zinc-700 px-2 text-[11px] font-medium tabular-nums text-zinc-600 dark:text-zinc-400 min-w-[40px] text-center">
                    {navIndex + 1}/{navList.length}
                  </span>
                  {nextNav ? (
                    <Link href={navUrl(nextNav, fromJobId)} className="inline-flex h-8 w-8 items-center justify-center rounded-r-lg text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-r-lg text-zinc-300 dark:text-zinc-700">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-2.5 border-b-0 -mb-px">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-5 space-y-5">
          {activeTab === "summary"     && slots.summary}
          {activeTab === "profile"     && slots.profile}
          {activeTab === "cv"          && slots.cv}
          {activeTab === "assessments" && slots.assessments}
        </div>
      </div>

      {/* ── RIGHT SIDEBAR — stage, notes, activity ───────────────────────── */}
      <aside className="hidden xl:flex flex-col w-72 shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex-1 overflow-y-auto sticky top-12 max-h-[calc(100vh-3rem)]">
          <div className="px-4 py-4 space-y-5">

            {/* Internal notes */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Nota interna
                </h3>
                {notesSaved && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <CheckCircle2 className="h-3 w-3" /> Guardado
                  </span>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escribe tus notas sobre este candidato..."
                rows={4}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:placeholder-zinc-600"
              />
              <button
                type="button"
                onClick={saveNotes}
                disabled={isPending || notes === (app?.internalNotes ?? "")}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                Guardar nota
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-100 dark:border-zinc-800" />

            {/* Activity timeline */}
            {app && (
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Actividad
                </h3>
                <ol className="space-y-2.5">
                  {[
                    { date: app.submittedAt || app.createdAt, label: "Postulación enviada" },
                    { date: app.reviewingAt,   label: "En revisión" },
                    { date: app.interviewAt,   label: "Entrevista agendada" },
                    { date: app.offerAt,       label: "Oferta enviada" },
                    { date: app.hiredAt,       label: "Candidato contratado" },
                    { date: app.rejectedAt,    label: "Descartado" },
                    { date: app.lastViewedAt,  label: `Perfil visto${app.viewCount > 1 ? ` (${app.viewCount}×)` : ""}` },
                  ]
                    .filter((e) => e.date)
                    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
                    .map((event, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-tight">{event.label}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{fmtDate(event.date)}</p>
                        </div>
                      </li>
                    ))
                  }
                </ol>
              </div>
            )}

            {/* Stats row */}
            {app && (
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <Clock className="h-3.5 w-3.5" />
                  Aplicó {fmtDate(app.submittedAt || app.createdAt)}
                </div>
                {app.viewCount > 0 && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <Star className="h-3.5 w-3.5" />
                    Perfil visto {app.viewCount} vez{app.viewCount !== 1 ? "es" : ""}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
