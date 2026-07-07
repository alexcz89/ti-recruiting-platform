// app/certificaciones/page.tsx
// Catálogo de certificaciones gratuitas: exámenes de badge por skill + nivel.
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { badgeLevelLabel, BADGE_RETRY_COOLDOWN_DAYS } from "@/lib/badges";
import { Award, Clock, ListChecks, Lock, CheckCircle2 } from "lucide-react";
import { StartBadgeExamButton } from "./StartBadgeExamButton";

export const metadata = {
  title: "Certificaciones gratuitas | TaskIO",
  description:
    "Demuestra tu nivel en las tecnologías que dominas con exámenes gratuitos y obtén badges verificados en tu perfil.",
};
export const dynamic = "force-dynamic";

export default async function CertificacionesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  const isCandidate = user?.role === "CANDIDATE";

  const [exams, myBadges] = await Promise.all([
    prisma.assessmentTemplate.findMany({
      where: { isBadgeExam: true, isActive: true, isGlobal: true },
      orderBy: [{ badgeLevel: "asc" }],
      select: {
        id: true,
        title: true,
        type: true,
        timeLimit: true,
        totalQuestions: true,
        badgeLevel: true,
        badgeTerm: { select: { id: true, label: true } },
      },
    }),
    isCandidate && user?.id
      ? prisma.candidateBadge.findMany({
          where: { candidateId: user.id },
          select: { termId: true, level: true },
        })
      : Promise.resolve([]),
  ]);

  const earned = new Set(myBadges.map((b) => `${b.termId}:${b.level}`));

  // Cooldown: exámenes reprobados en los últimos 30 días → fecha de reintento
  const cooldownMs = BADGE_RETRY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const retryAtByTemplate = new Map<string, Date>();
  if (isCandidate && user?.id && exams.length > 0) {
    const failed = await prisma.assessmentAttempt.findMany({
      where: {
        candidateId: user.id,
        templateId: { in: exams.map((e) => e.id) },
        inviteId: null,
        applicationId: null,
        status: { in: ["SUBMITTED", "EVALUATED", "COMPLETED"] },
        passed: false,
        submittedAt: { gt: new Date(Date.now() - cooldownMs) },
      },
      select: { templateId: true, submittedAt: true },
    });
    for (const f of failed) {
      if (!f.submittedAt) continue;
      const retryAt = new Date(f.submittedAt.getTime() + cooldownMs);
      const prev = retryAtByTemplate.get(f.templateId);
      if (!prev || retryAt > prev) retryAtByTemplate.set(f.templateId, retryAt);
    }
  }

  // Agrupar exámenes por skill
  const bySkill = new Map<
    string,
    { label: string; exams: typeof exams }
  >();
  for (const exam of exams) {
    if (!exam.badgeTerm || exam.badgeLevel == null) continue;
    const key = exam.badgeTerm.id;
    if (!bySkill.has(key)) {
      bySkill.set(key, { label: exam.badgeTerm.label, exams: [] });
    }
    bySkill.get(key)!.exams.push(exam);
  }
  const skills = [...bySkill.entries()].sort((a, b) =>
    a[1].label.localeCompare(b[1].label)
  );

  return (
    <main className="w-full">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <header className="max-w-2xl">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
            Certificaciones gratuitas
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            Demuestra tu nivel con exámenes por tecnología y obtén badges
            verificados que destacan tu perfil ante los reclutadores. Sin
            costo, a tu ritmo.
          </p>
          {!session?.user && (
            <Link
              href="/auth/signup"
              className="mt-4 inline-flex h-11 items-center rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              Crea tu cuenta gratis para certificarte
            </Link>
          )}
        </header>

        {/* Catálogo */}
        {skills.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white/50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <Award className="mx-auto mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Estamos preparando las primeras certificaciones
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Muy pronto podrás demostrar tu nivel en JavaScript, React, Java,
              Python y más.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {skills.map(([termId, skill]) => {
              const levels = skill.exams
                .filter((e) => e.badgeLevel != null)
                .sort((a, b) => (a.badgeLevel! - b.badgeLevel!));

              return (
                <section
                  key={termId}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
                >
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {skill.label}
                  </h2>

                  <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {levels.map((exam) => {
                      const level = exam.badgeLevel!;
                      const isEarned = earned.has(`${termId}:${level}`);
                      // Avanzado (3+) requiere el nivel anterior del mismo skill
                      const isLocked =
                        level >= 3 && !earned.has(`${termId}:${level - 1}`);
                      const retryAt = retryAtByTemplate.get(exam.id) ?? null;

                      return (
                        <li
                          key={exam.id}
                          className={`flex min-h-[44px] items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                            isEarned
                              ? "border-teal-200 bg-teal-50/60 dark:border-teal-800/50 dark:bg-teal-950/20"
                              : "border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {badgeLevelLabel(level)}
                            </p>
                            <p className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                              <span className="inline-flex items-center gap-1">
                                <ListChecks className="h-3 w-3" />
                                {exam.totalQuestions} preguntas
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {exam.timeLimit} min
                              </span>
                            </p>
                          </div>

                          {isEarned ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-teal-600 px-2 py-1 text-[11px] font-semibold text-white">
                              <CheckCircle2 className="h-3 w-3" />
                              Obtenido
                            </span>
                          ) : isLocked ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                              title={`Requiere ${badgeLevelLabel(level - 1)}`}
                            >
                              <Lock className="h-3 w-3" />
                              Requiere {badgeLevelLabel(level - 1)}
                            </span>
                          ) : retryAt ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                              title="Podrás reintentar cuando termine el periodo de espera"
                            >
                              <Clock className="h-3 w-3" />
                              Disponible el{" "}
                              {retryAt.toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          ) : isCandidate ? (
                            <StartBadgeExamButton templateId={exam.id} />
                          ) : (
                            <Link
                              href="/auth/signup"
                              className="inline-flex shrink-0 items-center rounded border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700 transition-colors hover:bg-teal-100 dark:border-teal-800/50 dark:bg-teal-950/30 dark:text-teal-300 dark:hover:bg-teal-900/40"
                            >
                              Regístrate para presentar
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Los badges se otorgan al aprobar el examen correspondiente. El nivel
          Avanzado incluye retos de código y se desbloquea al obtener el nivel
          Intermedio del mismo skill.
        </p>
      </div>
    </main>
  );
}
