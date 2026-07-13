// app/certificaciones/page.tsx
// Catálogo de certificaciones gratuitas: medallero coleccionable por skill
// con la ruta de progresión Básico → Intermedio → Avanzado.
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { badgeLevelLabel, badgeLogoSrc, BADGE_LEVELS, BADGE_RETRY_COOLDOWN_DAYS } from "@/lib/badges";
import { BadgeMedal } from "@/components/badges/BadgeMedal";
import { Clock, ListChecks, Lock, CheckCircle2, Award } from "lucide-react";
import { StartBadgeExamButton } from "./StartBadgeExamButton";

export const metadata = {
  title: "Certificaciones gratuitas | TaskIO",
  description:
    "Demuestra tu nivel en las tecnologías que dominas con exámenes gratuitos y colecciona badges verificados en tu perfil.",
};
export const dynamic = "force-dynamic";

type ExamRow = {
  id: string;
  timeLimit: number;
  totalQuestions: number;
  badgeLevel: number | null;
};

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
        timeLimit: true,
        totalQuestions: true,
        badgeLevel: true,
        badgeTerm: { select: { id: true, label: true, slug: true } },
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

  // Agrupar exámenes por skill: termId → { label, slug, examsByLevel }
  const bySkill = new Map<
    string,
    { label: string; slug: string; examsByLevel: Map<number, ExamRow> }
  >();
  for (const exam of exams) {
    if (!exam.badgeTerm || exam.badgeLevel == null) continue;
    const key = exam.badgeTerm.id;
    if (!bySkill.has(key)) {
      bySkill.set(key, {
        label: exam.badgeTerm.label,
        slug: exam.badgeTerm.slug,
        examsByLevel: new Map(),
      });
    }
    bySkill.get(key)!.examsByLevel.set(exam.badgeLevel, exam);
  }
  const skills = [...bySkill.entries()].sort((a, b) =>
    a[1].label.localeCompare(b[1].label)
  );

  const totalEarned = myBadges.length;
  const maxLevel = Math.max(...BADGE_LEVELS);

  return (
    <main className="w-full">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
              Certificaciones gratuitas
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
              Demuestra tu nivel por tecnología y colecciona badges verificados
              que destacan tu perfil ante los reclutadores. Sin costo, a tu
              ritmo.
            </p>
          </div>

          {isCandidate ? (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-2.5 dark:border-teal-800/50 dark:bg-teal-950/20">
              <Award className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                {totalEarned} {totalEarned === 1 ? "badge obtenido" : "badges obtenidos"}
              </span>
            </div>
          ) : (
            <Link
              href="/auth/signup"
              className="inline-flex h-11 shrink-0 items-center rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              Crea tu cuenta gratis para certificarte
            </Link>
          )}
        </header>

        {/* Medallero */}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {skills.map(([termId, skill]) => {
              // Nivel más alto obtenido de este skill (0 = ninguno)
              let highestEarned = 0;
              for (const lvl of BADGE_LEVELS) {
                if (earned.has(`${termId}:${lvl}`)) highestEarned = lvl;
              }
              const medalLevel = highestEarned || 1;
              const medalState = highestEarned > 0 ? "earned" : "available";

              return (
                <section
                  key={termId}
                  className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Medallón + título */}
                  <div className="flex items-center gap-4">
                    <BadgeMedal
                      skill={skill.label}
                      level={medalLevel}
                      state={medalState}
                      size={92}
                      logoSrc={badgeLogoSrc(skill.slug)}
                    />
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {skill.label}
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {highestEarned > 0
                          ? `Nivel ${badgeLevelLabel(highestEarned)} obtenido`
                          : "Aún sin certificar"}
                      </p>
                    </div>
                  </div>

                  {/* Ruta de progresión */}
                  <ul className="mt-4 flex flex-1 flex-col gap-1.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    {BADGE_LEVELS.map((level) => {
                      const exam = skill.examsByLevel.get(level);
                      const isEarned = earned.has(`${termId}:${level}`);
                      const isLocked =
                        level >= 3 && !earned.has(`${termId}:${level - 1}`);
                      const retryAt = exam ? (retryAtByTemplate.get(exam.id) ?? null) : null;

                      return (
                        <li
                          key={level}
                          className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-2 py-1.5"
                        >
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold ${
                                isEarned
                                  ? "text-teal-700 dark:text-teal-300"
                                  : exam
                                    ? "text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-400 dark:text-zinc-600"
                              }`}
                            >
                              {badgeLevelLabel(level)}
                            </p>
                            {exam && !isEarned && (
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
                            )}
                          </div>

                          {isEarned ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-teal-600 px-2 py-1 text-[11px] font-semibold text-white">
                              <CheckCircle2 className="h-3 w-3" />
                              Obtenido
                            </span>
                          ) : !exam ? (
                            <span className="inline-flex shrink-0 items-center rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                              Próximamente
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
          Intermedio del mismo skill. Máximo nivel por skill:{" "}
          {badgeLevelLabel(maxLevel)}.
        </p>
      </div>
    </main>
  );
}
