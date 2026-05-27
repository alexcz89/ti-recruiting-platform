// app/dashboard/assessments/templates/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { headers, cookies } from "next/headers";
import Link from "next/link";
import {
  BookOpen, Clock, CheckCircle2, Code2, BarChart3,
  Layers, Sparkles, Plus, SlidersHorizontal,
  Eye, Pencil, ChevronDown,
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

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; dot: string; row: string }> = {
  JUNIOR: { label: "Junior",    dot: "bg-emerald-500", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50", row: "border-l-emerald-500" },
  MID:    { label: "Mid Level", dot: "bg-blue-500",    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50",                   row: "border-l-blue-500" },
  SENIOR: { label: "Senior",    dot: "bg-violet-500",  color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/50",       row: "border-l-violet-500" },
};

const TYPE_CONFIG: Record<AssessmentType, { label: string; icon: React.ComponentType<{ className?: string }>; badge: string }> = {
  MCQ:    { label: "Opción múltiple", icon: CheckCircle2, badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  CODING: { label: "Código",          icon: Code2,        badge: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
  MIXED:  { label: "Mixto",           icon: Layers,       badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
};

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript", python: "Python", cpp: "C++", java: "Java",
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

  const totalTemplates = templates.length;
  const totalQuestions = templates.reduce((s, t) => s + (t._count?.questions ?? 0), 0);
  const avgTime        = templates.length ? Math.round(templates.reduce((s, t) => s + (t.timeLimit ?? 0), 0) / templates.length) : 0;
  const customCount    = templates.filter(t => !t.isGlobal).length;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-[1400px] space-y-5 px-3 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 p-2 shadow-lg shadow-violet-500/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
                Templates de Evaluación
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Asigna, previsualiza o edita evaluaciones técnicas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/assessments/builder"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:shadow-lg transition-all"
            >
              <Plus className="h-4 w-4" />
              Crear template
            </Link>
            <Link
              href="/dashboard/assessments"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition"
            >
              ← Evaluaciones activas
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: totalTemplates,    label: "Templates",    color: "text-violet-600 dark:text-violet-400" },
            { value: totalQuestions,    label: "Preguntas",    color: "text-blue-600 dark:text-blue-400" },
            { value: `${avgTime} min`,  label: "Tiempo prom.", color: "text-emerald-600 dark:text-emerald-400" },
            { value: customCount,       label: "Mis templates",color: "text-amber-600 dark:text-amber-400" },
          ].map(({ value, label, color }) => (
            <div key={label} className="flex flex-col items-center justify-center rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Filtros</span>
          </div>
          <div className="flex flex-wrap gap-y-2 gap-x-4">
            {/* Tipo */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase text-zinc-400">Tipo:</span>
              {[{ value: "", label: "Todos" }, { value: "MCQ", label: "✓ Múltiple" }, { value: "CODING", label: "</> Código" }, { value: "MIXED", label: "⊕ Mixto" }].map(({ value, label }) => (
                <FilterChip key={value} href={buildFilterUrl(searchParams, "type", value)} active={typeFilter === value}>{label}</FilterChip>
              ))}
            </div>
            {/* Lenguaje */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase text-zinc-400">Lenguaje:</span>
              {[{ value: "", label: "Todos" }, ...["javascript", "python", "cpp", "java"].map(l => ({ value: l, label: LANGUAGE_LABELS[l] ?? l }))].map(({ value, label }) => (
                <FilterChip key={value} href={buildFilterUrl(searchParams, "language", value)} active={langFilter === value}>{label}</FilterChip>
              ))}
            </div>
            {/* Scope */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase text-zinc-400">Origen:</span>
              {[{ value: "", label: "Todos" }, { value: "global", label: "🌐 Taskio" }, { value: "custom", label: "🏢 Mis templates" }].map(({ value, label }) => (
                <FilterChip key={value} href={buildFilterUrl(searchParams, "scope", value)} active={scopeFilter === value}>{label}</FilterChip>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla */}
        {templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <BookOpen className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-base font-bold text-zinc-600 dark:text-zinc-300">Sin resultados</p>
            <Link href="/dashboard/assessments/templates" className="mt-2 inline-block text-xs text-violet-600 hover:underline">
              Limpiar filtros
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {(["JUNIOR", "MID", "SENIOR"] as Difficulty[]).map((level) => {
              const group = byDifficulty[level];
              if (!group.length) return null;
              const cfg = DIFFICULTY_CONFIG[level];
              return (
                <section key={level}>
                  {/* Section header */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    <h2 className="text-sm font-black text-zinc-800 dark:text-zinc-200">{cfg.label}</h2>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {group.length} template{group.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Template</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tipo</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">Preguntas</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tiempo</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">Mínimo</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">Secciones</th>
                          <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-500">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900/50">
                        {group.map((t) => <TemplateRow key={t.id} template={t} />)}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden grid grid-cols-1 gap-3">
                    {group.map((t) => <TemplateMobileCard key={t.id} template={t} />)}
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

// ── Table row (desktop) ──
function TemplateRow({ template }: { template: Template }) {
  const typeConfig = TYPE_CONFIG[template.type as AssessmentType] ?? TYPE_CONFIG.MCQ;
  const TypeIcon = typeConfig.icon;
  const questionCount = template._count?.questions ?? template.totalQuestions ?? 0;
  const sections = Array.isArray(template.sections) ? template.sections : [];
  const diffConfig = DIFFICULTY_CONFIG[template.difficulty as Difficulty] ?? DIFFICULTY_CONFIG.JUNIOR;
  const canEdit = !template.isGlobal;

  return (
    <tr className={`group hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors border-l-2 ${diffConfig.row}`}>
      {/* Name + description */}
      <td className="px-4 py-3 max-w-xs">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-tight">
                {template.title}
              </span>
              {!template.isGlobal && (
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-600/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                  Mi template
                </span>
              )}
              {template.language && (
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 dark:text-zinc-400">
                  {LANGUAGE_LABELS[template.language] ?? template.language}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1 leading-relaxed">
              {template.description}
            </p>
          </div>
        </div>
      </td>

      {/* Tipo */}
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${typeConfig.badge}`}>
          <TypeIcon className="h-3 w-3" />
          {typeConfig.label}
        </span>
      </td>

      {/* Preguntas */}
      <td className="px-3 py-3 text-center">
        <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">{questionCount}</span>
      </td>

      {/* Tiempo */}
      <td className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          <Clock className="h-3 w-3 text-zinc-400" />
          {template.timeLimit}m
        </span>
      </td>

      {/* Mínimo */}
      <td className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          <BarChart3 className="h-3 w-3 text-zinc-400" />
          {template.passingScore}%
        </span>
      </td>

      {/* Secciones */}
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1 justify-center max-w-[180px]">
          {sections.slice(0, 3).map((s) => (
            <span key={s.name} className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
              {s.name}
            </span>
          ))}
          {sections.length > 3 && (
            <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">
              +{sections.length - 3}
            </span>
          )}
        </div>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {/* Ver evaluación */}
          <Link
            href={`/dashboard/assessments/templates/${template.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 transition"
            title="Ver evaluación"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver
          </Link>

          {/* Editar (solo templates propios) */}
          {canEdit ? (
            <Link
              href={`/dashboard/assessments/builder?edit=${template.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 transition"
              title="Editar template"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 dark:text-zinc-600 cursor-not-allowed select-none" title="Solo puedes editar tus propios templates">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </span>
          )}

          {/* Asignar */}
          <Link
            href={`/dashboard/jobs?assignTemplate=${template.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm shadow-violet-500/20 hover:shadow-md transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Asignar
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Mobile card ──
function TemplateMobileCard({ template }: { template: Template }) {
  const typeConfig = TYPE_CONFIG[template.type as AssessmentType] ?? TYPE_CONFIG.MCQ;
  const TypeIcon = typeConfig.icon;
  const diffConfig = DIFFICULTY_CONFIG[template.difficulty as Difficulty] ?? DIFFICULTY_CONFIG.JUNIOR;
  const questionCount = template._count?.questions ?? template.totalQuestions ?? 0;
  const canEdit = !template.isGlobal;

  return (
    <div className={`rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 shadow-sm border-l-2 ${diffConfig.row} p-4`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${typeConfig.badge}`}>
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </span>
            {!template.isGlobal && (
              <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                Mi template
              </span>
            )}
          </div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{template.title}</h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{template.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400 mb-3">
        <span className="flex items-center gap-1"><strong className="text-zinc-900 dark:text-zinc-100 font-black">{questionCount}</strong> preg.</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{template.timeLimit}m</span>
        <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{template.passingScore}%</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Link href={`/dashboard/assessments/templates/${template.id}`} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 py-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
          <Eye className="h-3.5 w-3.5" /> Ver
        </Link>
        {canEdit && (
          <Link href={`/dashboard/assessments/builder?edit=${template.id}`} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 py-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Link>
        )}
        <Link href={`/dashboard/jobs?assignTemplate=${template.id}`} className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 py-2 text-[11px] font-bold text-white shadow-sm transition">
          <Sparkles className="h-3.5 w-3.5" /> Asignar
        </Link>
      </div>
    </div>
  );
}

// ── Helpers ──
function buildFilterUrl(current: PageProps["searchParams"], key: string, value: string): string {
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
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold border transition whitespace-nowrap
        ${active
          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
          : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800"
        }`}
    >
      {children}
    </Link>
  );
}
