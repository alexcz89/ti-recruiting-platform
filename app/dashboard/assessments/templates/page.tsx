// app/dashboard/assessments/templates/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { headers, cookies } from "next/headers";
import Link from "next/link";
import {
  BookOpen, Clock, CheckCircle2, Code2, BarChart3,
  Layers, ChevronRight, Sparkles, Plus, SlidersHorizontal,
} from "lucide-react";
import { authOptions } from "@/lib/server/auth";

export const metadata = { title: "Templates de Evaluación | Panel" };
export const dynamic = "force-dynamic";

type Difficulty = "JUNIOR" | "MID" | "SENIOR";
type AssessmentType = "MCQ" | "CODING" | "MIXED";

type Template = {
  id: string; title: string; slug: string; description: string;
  type: AssessmentType; difficulty: Difficulty;
  language: string | null; isGlobal: boolean;
  totalQuestions: number; passingScore: number; timeLimit: number;
  sections: { name: string; questions: number }[];
  _count: { questions: number };
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
  JUNIOR: { label: "Junior",    color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50", dot: "bg-emerald-500" },
  MID:    { label: "Mid Level", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50",                   dot: "bg-blue-500" },
  SENIOR: { label: "Senior",    color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/50",       dot: "bg-violet-500" },
};

const TYPE_CONFIG: Record<AssessmentType, { label: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = {
  MCQ:    { label: "Opción múltiple", icon: CheckCircle2, accent: "from-emerald-400 to-teal-400" },
  CODING: { label: "Código",          icon: Code2,        accent: "from-violet-400 to-blue-400" },
  MIXED:  { label: "Mixto",           icon: Layers,       accent: "from-amber-400 to-orange-400" },
};

const LANGUAGE_LABELS: Record<string, { label: string; color: string }> = {
  javascript: { label: "JavaScript", color: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800/50" },
  python:     { label: "Python",     color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50" },
  cpp:        { label: "C++",        color: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-300 dark:border-zinc-700" },
};

type PageProps = { searchParams?: { type?: string; language?: string; scope?: string } };

export default async function AssessmentTemplatesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const role = String((session.user as any).role ?? "").toUpperCase();
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const typeFilter  = searchParams?.type     || "";
  const langFilter  = searchParams?.language || "";
  const scopeFilter = searchParams?.scope    || "";

  const baseUrl = getBaseUrl();
  const cookieHeader = cookies().toString();

  const params = new URLSearchParams();
  if (typeFilter)  params.set("type", typeFilter);
  if (langFilter)  params.set("language", langFilter);
  if (scopeFilter) params.set("scope", scopeFilter);

  const res = await fetch(`${baseUrl}/api/dashboard/assessments/templates?${params}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  const data = res.ok ? await res.json() : { templates: [] };
  const templates: Template[] = data.templates ?? [];

  const byDifficulty = templates.reduce<Record<Difficulty, Template[]>>(
    (acc, t) => { const d = (t.difficulty ?? "JUNIOR") as Difficulty; acc[d].push(t); return acc; },
    { JUNIOR: [], MID: [], SENIOR: [] }
  );

  const totalTemplates  = templates.length;
  const totalQuestions  = templates.reduce((s, t) => s + (t._count?.questions ?? 0), 0);
  const avgTime         = templates.length ? Math.round(templates.reduce((s, t) => s + (t.timeLimit ?? 0), 0) / templates.length) : 0;
  const customCount     = templates.filter(t => !t.isGlobal).length;

  // Opciones de filtro disponibles
  const availableLanguages = [...new Set(templates.map(t => t.language).filter(Boolean))] as string[];

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-[1800px] space-y-5 px-3 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50/50 to-white p-5 sm:p-6 shadow-sm dark:border-zinc-800/50 dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-900">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-100 to-blue-100 opacity-20 blur-3xl dark:from-violet-900 dark:to-blue-900 dark:opacity-10" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 p-2 shadow-lg shadow-violet-500/20">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Panel de reclutador
                </span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                Templates de Evaluación
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 max-w-xl">
                Asigna evaluaciones técnicas a tus vacantes o crea tus propias evaluaciones personalizadas.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Link
                href="/dashboard/assessments/builder"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:shadow-lg transition-all"
              >
                <Plus className="h-4 w-4" />
                Crear template
              </Link>
              <Link
                href="/dashboard/assessments"
                className="inline-flex h-9 items-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                ← Ver evaluaciones activas
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: totalTemplates, label: "Templates",         color: "text-violet-600 dark:text-violet-400" },
            { value: totalQuestions, label: "Preguntas",         color: "text-blue-600 dark:text-blue-400" },
            { value: `${avgTime} min`, label: "Tiempo prom.",    color: "text-emerald-600 dark:text-emerald-400" },
            { value: customCount,    label: "Mis templates",     color: "text-amber-600 dark:text-amber-400" },
          ].map(({ value, label, color }) => (
            <div key={label} className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 p-3 sm:p-4 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/80">
              <p className={`text-2xl sm:text-3xl font-black ${color}`}>{value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 dark:border-zinc-800/50 dark:bg-zinc-900/80 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Filtros</span>
          </div>

          <div className="space-y-2">
            {/* Tipo */}
            <div className="overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
              <div className="flex items-center gap-1.5 w-max sm:w-auto sm:flex-wrap">
                <span className="text-[10px] font-semibold uppercase text-zinc-400 shrink-0">Tipo:</span>
                {[
                  { value: "", label: "Todos" },
                  { value: "MCQ", label: "✓ Opción múltiple" },
                  { value: "CODING", label: "</> Código" },
                  { value: "MIXED", label: "⊕ Mixto" },
                ].map(({ value, label }) => (
                  <FilterChip key={value} href={buildFilterUrl(searchParams, "type", value)} active={typeFilter === value}>
                    {label}
                  </FilterChip>
                ))}
              </div>
            </div>

            {/* Lenguaje */}
            <div className="overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
              <div className="flex items-center gap-1.5 w-max sm:w-auto sm:flex-wrap">
                <span className="text-[10px] font-semibold uppercase text-zinc-400 shrink-0">Lenguaje:</span>
                <FilterChip href={buildFilterUrl(searchParams, "language", "")} active={langFilter === ""}>
                  Todos
                </FilterChip>
                {["javascript", "python", "cpp"].map((lang) => (
                  <FilterChip key={lang} href={buildFilterUrl(searchParams, "language", lang)} active={langFilter === lang}>
                    {LANGUAGE_LABELS[lang]?.label ?? lang}
                  </FilterChip>
                ))}
              </div>
            </div>

            {/* Scope */}
            <div className="overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
              <div className="flex items-center gap-1.5 w-max sm:w-auto sm:flex-wrap">
                <span className="text-[10px] font-semibold uppercase text-zinc-400 shrink-0">Origen:</span>
                {[
                  { value: "", label: "Todos" },
                  { value: "global", label: "🌐 Taskio" },
                  { value: "custom", label: "🏢 Mis templates" },
                ].map(({ value, label }) => (
                  <FilterChip key={value} href={buildFilterUrl(searchParams, "scope", value)} active={scopeFilter === value}>
                    {label}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Templates por nivel ── */}
        {templates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <BookOpen className="mx-auto h-12 w-12 text-zinc-400" />
            <p className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-100">Sin templates</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              No hay templates que coincidan con los filtros seleccionados.
            </p>
            <Link href="/dashboard/assessments/templates" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:underline">
              Limpiar filtros
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {(["JUNIOR", "MID", "SENIOR"] as Difficulty[]).map((level) => {
              const group = byDifficulty[level];
              if (!group.length) return null;
              const config = DIFFICULTY_CONFIG[level];

              return (
                <section key={level}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
                      <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">{config.label}</h2>
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {group.length} template{group.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {group.map((template) => (
                      <TemplateCard key={template.id} template={template} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Helpers ──
function buildFilterUrl(
  current: PageProps["searchParams"],
  key: string,
  value: string
): string {
  const params = new URLSearchParams();
  if (current?.type)     params.set("type",     current.type);
  if (current?.language) params.set("language", current.language);
  if (current?.scope)    params.set("scope",    current.scope);
  if (value) params.set(key, value);
  else params.delete(key);
  const qs = params.toString();
  return `/dashboard/assessments/templates${qs ? `?${qs}` : ""}`;
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border transition whitespace-nowrap
        ${active
          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
          : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800"
        }`}
    >
      {children}
    </Link>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const diffConfig = DIFFICULTY_CONFIG[template.difficulty as Difficulty] ?? DIFFICULTY_CONFIG.JUNIOR;
  const typeConfig = TYPE_CONFIG[template.type as AssessmentType] ?? TYPE_CONFIG.MCQ;
  const TypeIcon = typeConfig.icon;
  const sections = Array.isArray(template.sections) ? template.sections : [];
  const questionCount = template._count?.questions ?? template.totalQuestions ?? 0;
  const langConfig = template.language ? LANGUAGE_LABELS[template.language] : null;
  const isCoding = template.type === "CODING";

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.01] hover:shadow-lg dark:bg-zinc-900/80
      ${isCoding
        ? "border-violet-200/80 dark:border-violet-800/30"
        : "border-zinc-200/80 dark:border-zinc-800/50"
      }`}
    >
      {/* Top accent line — distinto por tipo */}
      <div className={`h-1 w-full bg-gradient-to-r ${typeConfig.accent}`} />

      {/* Badge de origen */}
      {!template.isGlobal && (
        <div className="absolute top-3 right-3 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
          Mi template
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="mb-3">
          {/* Tipo badge prominente */}
          <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold mb-2
            ${isCoding
              ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            <TypeIcon className="h-3.5 w-3.5" />
            {typeConfig.label}
          </div>

          <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50 leading-tight">
            {template.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {template.description}
          </p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${diffConfig.color}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${diffConfig.dot}`} />
            {diffConfig.label}
          </span>
          {langConfig && (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${langConfig.color}`}>
              {langConfig.label}
            </span>
          )}
        </div>

        {/* Métricas */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { value: questionCount, label: "Preguntas" },
            { value: template.timeLimit, label: "Min", icon: Clock },
            { value: `${template.passingScore}%`, label: "Mínimo", icon: BarChart3 },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center rounded-xl bg-zinc-50 py-2 dark:bg-zinc-800/50">
              <div className="flex items-center gap-0.5">
                {Icon && <Icon className="h-3 w-3 text-zinc-500" />}
                <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{value}</p>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Secciones */}
        {sections.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Secciones</p>
            <div className="flex flex-wrap gap-1">
              {sections.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {s.name} <span className="text-zinc-400">·{s.questions}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* CTA */}
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800 flex gap-2">
          <Link
            href={`/dashboard/jobs?assignTemplate=${template.id}`}
            className={`group/btn flex flex-1 items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]
              ${isCoding
                ? "bg-gradient-to-br from-violet-600 to-blue-600 shadow-violet-500/20 hover:shadow-violet-500/30"
                : "bg-gradient-to-br from-emerald-600 to-teal-600 shadow-emerald-500/20 hover:shadow-emerald-500/30"
              }`}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Asignar a vacante
            </span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </Link>
          {!template.isGlobal && (
            <Link
              href={`/dashboard/assessments/builder?edit=${template.id}`}
              className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition"
              title="Editar template"
            >
              ✏️
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}