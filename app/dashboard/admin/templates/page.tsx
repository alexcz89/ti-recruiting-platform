// app/dashboard/admin/templates/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { BookOpen, ArrowLeft, Plus } from "lucide-react";
import { TemplateActionsClient } from "./TemplateActionsClient";

export const metadata = { title: "Admin · Templates" };
export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if ((session.user as any)?.role !== "ADMIN") redirect("/");

  const templates = await prisma.assessmentTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isGlobal: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, title: true, type: true, difficulty: true,
      language: true, isGlobal: true, passingScore: true,
      timeLimit: true, totalQuestions: true, createdAt: true,
      companyId: true,
      _count: { select: { questions: true } },
    },
  });

  // Server Action — toggle isGlobal
  async function toggleGlobalAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user || (s.user as any)?.role !== "ADMIN") return { error: "Sin permisos" };

    const templateId = String(fd.get("templateId") || "");
    const isGlobal = fd.get("isGlobal") === "true";

    await prisma.assessmentTemplate.update({
      where: { id: templateId },
      data: {
        isGlobal,
        // Si se hace global, quitar el companyId
        companyId: isGlobal ? null : undefined,
      },
    });

    revalidatePath("/dashboard/admin/templates");
    revalidatePath("/dashboard/assessments/templates");
    return { ok: true };
  }

  // Server Action — desactivar template
  async function deactivateTemplateAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user || (s.user as any)?.role !== "ADMIN") return { error: "Sin permisos" };

    const templateId = String(fd.get("templateId") || "");
    await prisma.assessmentTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });

    revalidatePath("/dashboard/admin/templates");
    return { ok: true };
  }

  const globalTemplates = templates.filter(t => t.isGlobal);
  const customTemplates = templates.filter(t => !t.isGlobal);

  const TYPE_LABELS: Record<string, string> = {
    MCQ: "Opción múltiple", CODING: "Código", MIXED: "Mixto",
  };
  const DIFF_COLORS: Record<string, string> = {
    JUNIOR: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    MID: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    SENIOR: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-2.5 shadow-md">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-zinc-900 dark:text-white">Templates</h1>
                <p className="text-sm text-zinc-500">{globalTemplates.length} globales · {customTemplates.length} de empresas</p>
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/assessments/builder"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition"
          >
            <Plus className="h-4 w-4" />
            Crear template global
          </Link>
        </div>

        {/* Templates globales */}
        <section>
          <h2 className="text-sm font-bold uppercase text-zinc-400 tracking-wider mb-3">
            🌐 Templates Globales ({globalTemplates.length})
          </h2>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Título</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Nivel</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Preguntas</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {globalTemplates.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{t.title}</td>
                    <td className="px-4 py-3 text-zinc-500">{TYPE_LABELS[t.type] || t.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFF_COLORS[t.difficulty] || ""}`}>
                        {t.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">{t._count.questions}</td>
                    <td className="px-4 py-3 text-right">
                      <TemplateActionsClient
                        templateId={t.id}
                        isGlobal={t.isGlobal}
                        onToggleGlobal={toggleGlobalAction}
                        onDeactivate={deactivateTemplateAction}
                      />
                    </td>
                  </tr>
                ))}
                {globalTemplates.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400 text-sm">Sin templates globales</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Templates de empresas */}
        <section>
          <h2 className="text-sm font-bold uppercase text-zinc-400 tracking-wider mb-3">
            🏢 Templates de Empresas ({customTemplates.length})
          </h2>
          <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Título</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Nivel</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Empresa ID</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Preguntas</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {customTemplates.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{t.title}</td>
                    <td className="px-4 py-3 text-zinc-500">{TYPE_LABELS[t.type] || t.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFF_COLORS[t.difficulty] || ""}`}>
                        {t.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">{t.companyId?.slice(-8) || "—"}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{t._count.questions}</td>
                    <td className="px-4 py-3 text-right">
                      <TemplateActionsClient
                        templateId={t.id}
                        isGlobal={t.isGlobal}
                        onToggleGlobal={toggleGlobalAction}
                        onDeactivate={deactivateTemplateAction}
                      />
                    </td>
                  </tr>
                ))}
                {customTemplates.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400 text-sm">Sin templates de empresas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}