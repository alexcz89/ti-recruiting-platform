// app/dashboard/assessments/templates/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { headers, cookies } from "next/headers";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  Code2,
  BarChart3,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import { authOptions } from "@/lib/server/auth";

export const metadata = { title: "Templates de Evaluación | Panel" };
export const dynamic = "force-dynamic";

type Difficulty = "JUNIOR" | "MID" | "SENIOR";
type AssessmentType = "MCQ" | "CODING" | "MIXED";

type Template = {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: AssessmentType;
  difficulty: Difficulty;
  totalQuestions: number;
  passingScore: number;
  timeLimit: number;
  sections: { name: string; questions: number }[];
  _count: { questions: number };
};

function getBaseUrl() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  const env =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;
  return (env ? (env.startsWith("http") ? env : `https://${env}`) : "http://localhost:3000").replace(/\/$/, "");
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; dot: string }> = {
  JUNIOR: {
    label: "Junior",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50",
    dot: "bg-emerald-500",
  },
  MID: {
    label: "Mid Level",
    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50",
    dot: "bg-blue-500",
  },
  SENIOR: {
    label: "Senior",
    color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/50",
    dot: "bg-violet-500",
  },
};

const TYPE_CONFIG: Record<AssessmentType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  MCQ: { label: "Opción múltiple", icon: CheckCircle2 },
  CODING: { label: "Código", icon: Code2 },
  MIXED: { label: "Mixto", icon: Layers },
};

export default async function AssessmentTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const role = String((session.user as any).role ?? "").toUpperCase();
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const baseUrl = getBaseUrl();
  const cookieHeader = cookies().toString();

  const res = await fetch(`${baseUrl}/api/dashboard/assessments/templates`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  const data = res.ok ? await res.json() : { templates: [] };
  const templates: Template[] = data.templates ?? [];

  // Agrupar por dificultad
  const byDifficulty = templates.reduce<Record<Difficulty, Template[]>>(
    (acc, t) => {
      const d = (t.difficulty ?? "JUNIOR") as Difficulty;
      if (!acc[d]) acc[d] = [];
      acc[d].push(t);
      return acc;
    },
    { JUNIOR: [], MID: [], SENIOR: [] }
  );

  const totalTemplates = templates.length;
  const totalQuestions = templates.reduce((s, t) => s + (t._count?.questions ?? t.totalQuestions ?? 0), 0);
  const avgTime = templates.length
    ? Math.round(templates.reduce((s, t) => s + (t.timeLimit ?? 0), 0) / templates.length)
    : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50/50 to-white p-6 shadow-sm dark:border-zinc-800/50 dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-900">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-100 to-blue-100 opacity-20 blur-3xl dark:from-violet-900 dark:to-blue-900 dark:opacity-10" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-20 blur-3xl dark:from-emerald-900 dark:to-teal-900 dark:opacity-10" />

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
              <h1 className="mt-3 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 bg-clip-text text-3xl font-black tracking-tight text-transparent dark:from-white dark:via-zinc-100 dark:to-white">
                Templates de Evaluación
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
                Asigna evaluaciones técnicas a tus vacantes. Cada template incluye preguntas curadas por nivel y área.
              </p>
            </div>

            <Link
              href="/dashboard/assessments"
              className="inline-flex h-9 items-center gap-2 self-start rounded-xl border-2 border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              ← Ver evaluaciones activas
            </Link>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/80">
            <p className="text-3xl font-black text-violet-600 dark:text-violet-400">{totalTemplates}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Templates</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/80">
            <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{totalQuestions}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Preguntas</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/80">
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{avgTime} min</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tiempo prom.</p>
          </div>
        </div>

        {/* Templates por nivel */}
        {templates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <BookOpen className="mx-auto h-12 w-12 text-zinc-400" />
            <p className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-100">No hay templates disponibles</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Ejecuta <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">npx prisma db seed</code> para cargar los templates.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {(["JUNIOR", "MID", "SENIOR"] as Difficulty[]).map((level) => {
              const group = byDifficulty[level];
              if (!group.length) return null;
              const config = DIFFICULTY_CONFIG[level];

              return (
                <section key={level}>
                  {/* Encabezado de nivel */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
                      <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                        {config.label}
                      </h2>
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {group.length} template{group.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
                  </div>

                  {/* Grid de cards */}
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

function TemplateCard({ template }: { template: Template }) {
  const diffConfig = DIFFICULTY_CONFIG[template.difficulty as Difficulty] ?? DIFFICULTY_CONFIG.JUNIOR;
  const typeConfig = TYPE_CONFIG[template.type as AssessmentType] ?? TYPE_CONFIG.MCQ;
  const TypeIcon = typeConfig.icon;
  const sections = Array.isArray(template.sections) ? template.sections : [];
  const questionCount = template._count?.questions ?? template.totalQuestions ?? 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.01] hover:shadow-lg dark:border-zinc-800/50 dark:bg-zinc-900/80">
      {/* Top accent line */}
      <div className={`h-1 w-full bg-gradient-to-r ${
        template.difficulty === "JUNIOR" ? "from-emerald-400 to-teal-400" :
        template.difficulty === "MID" ? "from-blue-400 to-cyan-400" :
        "from-violet-400 to-purple-400"
      }`} />

      <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="truncate text-base font-black text-zinc-900 dark:text-zinc-50">
              {template.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {template.description}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${diffConfig.color}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${diffConfig.dot}`} />
            {diffConfig.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </span>
        </div>

        {/* Métricas */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center rounded-xl bg-zinc-50 py-2 dark:bg-zinc-800/50">
            <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{questionCount}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Preguntas</p>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-zinc-50 py-2 dark:bg-zinc-800/50">
            <div className="flex items-center gap-0.5">
              <Clock className="h-3 w-3 text-zinc-500" />
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{template.timeLimit}</p>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Minutos</p>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-zinc-50 py-2 dark:bg-zinc-800/50">
            <div className="flex items-center gap-0.5">
              <BarChart3 className="h-3 w-3 text-zinc-500" />
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{template.passingScore}%</p>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Mínimo</p>
          </div>
        </div>

        {/* Secciones */}
        {sections.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Secciones
            </p>
            <div className="flex flex-wrap gap-1">
              {sections.map((s: { name: string; questions: number }) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {s.name}
                  <span className="text-zinc-400 dark:text-zinc-500">·{s.questions}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <AssignTemplateButton templateId={template.id} templateTitle={template.title} />
        </div>
      </div>
    </div>
  );
}

// Server-side: link a vacantes para asignar
function AssignTemplateButton({ templateId, templateTitle }: { templateId: string; templateTitle: string }) {
  return (
    <Link
      href={`/dashboard/jobs?assignTemplate=${templateId}`}
      className="group/btn flex w-full items-center justify-between rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/30 active:scale-[0.98]"
    >
      <span className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        Asignar a vacante
      </span>
      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
    </Link>
  );
}