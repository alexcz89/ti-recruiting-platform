// app/certificaciones/page.tsx
// Catálogo de certificaciones gratuitas, personalizado con el perfil:
// "Para ti" muestra cards completas de los skills del candidato (o con
// badge); el resto vive en filas compactas plegables para no abrumar.
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  badgeLevelLabel,
  badgeLogoSrc,
  BADGE_LEVELS,
  BADGE_RETRY_COOLDOWN_DAYS,
  BADGE_VALIDITY_MONTHS,
  buildLinkedInCertificationUrl,
  isBadgeCurrent,
} from "@/lib/badges";
import { BadgeMedal } from "@/components/badges/BadgeMedal";
import { Clock, ListChecks, Lock, CheckCircle2, Award, ChevronDown } from "lucide-react";
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

type SkillGroup = {
  termId: string;
  label: string;
  slug: string;
  examsByLevel: Map<number, ExamRow>;
};

export default async function CertificacionesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  const isCandidate = user?.role === "CANDIDATE";

  const [exams, badgeRows, mySkills] = await Promise.all([
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
          orderBy: { earnedAt: "desc" },
          select: {
            termId: true,
            level: true,
            slug: true,
            isPublic: true,
            earnedAt: true,
            term: { select: { label: true, slug: true } },
          },
        })
      : Promise.resolve([]),
    isCandidate && user?.id
      ? prisma.candidateSkill.findMany({
          where: { userId: user.id },
          select: { termId: true },
        })
      : Promise.resolve([]),
  ]);

  const myBadges = badgeRows.filter((badge) =>
    isBadgeCurrent(badge.earnedAt)
  );
  const earned = new Set(myBadges.map((b) => `${b.termId}:${b.level}`));
  const profileTermIds = new Set(mySkills.map((s) => s.termId));

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
  const bySkill = new Map<string, SkillGroup>();
  for (const exam of exams) {
    if (!exam.badgeTerm || exam.badgeLevel == null) continue;
    const key = exam.badgeTerm.id;
    if (!bySkill.has(key)) {
      bySkill.set(key, {
        termId: key,
        label: exam.badgeTerm.label,
        slug: exam.badgeTerm.slug,
        examsByLevel: new Map(),
      });
    }
    bySkill.get(key)!.examsByLevel.set(exam.badgeLevel, exam);
  }
  // Orden por demanda de vacantes TI, no alfabético
  const DEMAND_ORDER = [
    "javascript",
    "python",
    "react",
    "typescript",
    "java",
    "sql",
    "nodejs",
    "node-js",
    "git",
  ];
  const demandIndex = (slug: string) => {
    const i = DEMAND_ORDER.indexOf(slug);
    return i === -1 ? DEMAND_ORDER.length : i;
  };
  const allSkills = [...bySkill.values()].sort(
    (a, b) =>
      demandIndex(a.slug) - demandIndex(b.slug) ||
      a.label.localeCompare(b.label)
  );

  const highestEarnedOf = (termId: string) => {
    let highest = 0;
    for (const lvl of BADGE_LEVELS) {
      if (earned.has(`${termId}:${lvl}`)) highest = lvl;
    }
    return highest;
  };

  // "Para ti": skills del perfil del candidato o con badge ya obtenido
  const forYou = allSkills.filter(
    (s) => profileTermIds.has(s.termId) || highestEarnedOf(s.termId) > 0
  );
  const forYouIds = new Set(forYou.map((s) => s.termId));
  const explore = allSkills.filter((s) => !forYouIds.has(s.termId));

  const totalEarned = myBadges.length;

  // Card lateral: compartir el badge más reciente, o sugerir el siguiente reto
  const latestPublicBadge = myBadges.find((b) => b.isPublic) ?? null;
  const nextChallenge =
    forYou.find((s) => highestEarnedOf(s.termId) === 0) ??
    explore.find((s) => s.examsByLevel.has(1)) ??
    null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";
  const linkedInCertificationUrl = latestPublicBadge
    ? buildLinkedInCertificationUrl({
        skill: latestPublicBadge.term.label,
        level: latestPublicBadge.level,
        slug: latestPublicBadge.slug,
        earnedAt: latestPublicBadge.earnedAt,
        appUrl,
        organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
      })
    : null;

  // ── Sub-render: filas de niveles de un skill (compartido entre vistas) ──
  const levelRows = (skill: SkillGroup, compactEarned = false) => {
    const highest = highestEarnedOf(skill.termId);
    const levels: number[] =
      compactEarned && highest > 0
        ? [
            highest,
            ...(highest < BADGE_LEVELS.length ? [highest + 1] : []),
          ]
        : [...BADGE_LEVELS];

    return (
      <ul className="flex flex-col gap-1.5">
        {levels.map((level) => {
          const exam = skill.examsByLevel.get(level);
          const isEarned = earned.has(skill.termId + ":" + level);
          const isLocked =
            level >= 3 && !earned.has(skill.termId + ":" + (level - 1));
          const retryAt = exam
            ? (retryAtByTemplate.get(exam.id) ?? null)
            : null;
          const isNextLevel = compactEarned && highest > 0 && level > highest;
          const levelTextClass = isEarned
            ? "text-teal-700 dark:text-teal-300"
            : exam
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-400 dark:text-zinc-600";

          return (
            <li
              key={level}
              className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className={"text-sm font-semibold " + levelTextClass}>
                  {isNextLevel
                    ? "Siguiente nivel: " + badgeLevelLabel(level)
                    : badgeLevelLabel(level)}
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
                  title={"Requiere " + badgeLevelLabel(level - 1)}
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
    );
  };

  return (
    <main className="w-full">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
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
            <Link
              href="/profile/summary#skills"
              title="Ver mis badges en el perfil"
              className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-2.5 transition-colors hover:bg-teal-100/60 dark:border-teal-800/50 dark:bg-teal-950/20 dark:hover:bg-teal-900/30"
            >
              <Award className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                {totalEarned} de {exams.length}{" "}
                {exams.length === 1 ? "badge obtenido" : "badges obtenidos"}
              </span>
            </Link>
          ) : (
            <Link
              href="/auth/signup"
              className="inline-flex h-11 shrink-0 items-center rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              Crea tu cuenta gratis para certificarte
            </Link>
          )}
        </header>

        {allSkills.length === 0 ? (
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
          <>
            {/* ── Para ti: skills del perfil o con badge ── */}
            {forYou.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Para ti
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Según los skills de tu perfil
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  {forYou.map((skill) => {
                    const highest = highestEarnedOf(skill.termId);
                    return (
                      <div
                        key={skill.termId}
                        className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="flex items-center gap-4">
                          <BadgeMedal
                            skill={skill.label}
                            level={highest || 1}
                            state={highest > 0 ? "earned" : "available"}
                            size={88}
                            logoSrc={badgeLogoSrc(skill.slug)}
                          />
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                              {skill.label}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {highest > 0
                                ? `Nivel ${badgeLevelLabel(highest)} obtenido`
                                : "Está en tu perfil — certifícalo"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                          {levelRows(skill, highest > 0)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Card lateral: compartir el logro o siguiente reto */}
                  {latestPublicBadge && linkedInCertificationUrl ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-teal-200 bg-teal-50/50 p-6 text-center dark:border-teal-800/50 dark:bg-teal-950/20">
                      <BadgeMedal
                        skill={latestPublicBadge.term.label}
                        level={latestPublicBadge.level}
                        size={96}
                        logoSrc={badgeLogoSrc(latestPublicBadge.term.slug)}
                      />
                      <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Presume tu badge de {latestPublicBadge.term.label}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        Tus datos ya están precargados. Solo revisa la
                        información antes de guardar.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <a
                          href={linkedInCertificationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[40px] items-center rounded-lg bg-[#0a66c2] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          Añadir a LinkedIn
                        </a>
                        <Link
                          href={"/badge/" + latestPublicBadge.slug}
                          className="inline-flex min-h-[40px] items-center rounded-lg border border-teal-300 px-4 py-2 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100/60 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-900/30"
                        >
                          Ver credencial
                        </Link>
                      </div>
                      <p className="mt-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                        Paso final: en LinkedIn agrega la aptitud{" "}
                        <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {latestPublicBadge.term.label}
                        </strong>{" "}
                        y pulsa Guardar.
                      </p>
                      <a
                        href={
                          "https://www.linkedin.com/sharing/share-offsite/?url=" +
                          encodeURIComponent(
                            appUrl + "/badge/" + latestPublicBadge.slug
                          )
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 text-[11px] font-medium text-[#0a66c2] hover:underline"
                      >
                        Compartir como publicación
                      </a>

                      {nextChallenge?.examsByLevel.get(1) && (
                        <div className="mt-5 w-full border-t border-teal-200 pt-4 text-left dark:border-teal-800/50">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Siguiente recomendado
                          </p>
                          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {nextChallenge.label} · Básico
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                Continúa fortaleciendo tu perfil técnico
                              </p>
                            </div>
                            <StartBadgeExamButton
                              templateId={nextChallenge.examsByLevel.get(1)!.id}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : nextChallenge ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
                      <BadgeMedal
                        skill={nextChallenge.label}
                        level={1}
                        state="available"
                        size={96}
                        logoSrc={badgeLogoSrc(nextChallenge.slug)}
                      />
                      <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Tu siguiente reto: {nextChallenge.label}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        Gana tu primer badge y destaca ante los reclutadores.
                      </p>
                      {nextChallenge.examsByLevel.get(1) && isCandidate && (
                        <div className="mt-4">
                          <StartBadgeExamButton
                            templateId={nextChallenge.examsByLevel.get(1)!.id}
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {/* ── Explorar el resto: filas compactas plegables ── */}
            {explore.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {forYou.length > 0
                    ? "Explora más tecnologías"
                    : "Todas las tecnologías"}
                </h2>
                {forYou.length === 0 && isCandidate && (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Agrega skills a tu perfil y aquí destacaremos sus
                    certificaciones primero.
                  </p>
                )}

                <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {explore.map((skill) => {
                    const highest = highestEarnedOf(skill.termId);
                    const basicExam = skill.examsByLevel.get(1);
                    return (
                      <details key={skill.termId} className="group">
                        <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 [&::-webkit-details-marker]:hidden">
                          <BadgeMedal
                            skill={skill.label}
                            level={highest || 1}
                            state={highest > 0 ? "earned" : "available"}
                            size={40}
                            logoSrc={badgeLogoSrc(skill.slug)}
                            variant="compact"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {skill.label}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              {highest > 0
                                ? `Nivel ${badgeLevelLabel(highest)} obtenido`
                                : basicExam
                                  ? `${basicExam.totalQuestions} preguntas · ${basicExam.timeLimit} min`
                                  : "Próximamente"}
                            </p>
                          </div>
                          <span
                            className={
                              highest > 0
                                ? "hidden shrink-0 rounded-full bg-teal-100 px-2 py-1 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 sm:inline-flex"
                                : basicExam
                                  ? "hidden shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 sm:inline-flex"
                                  : "hidden shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 sm:inline-flex"
                            }
                          >
                            {highest > 0
                              ? "Obtenido"
                              : basicExam
                                ? "Disponible"
                                : "Próximamente"}
                          </span>
                          <ChevronDown
                            className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                          <div className="max-w-xl">{levelRows(skill)}</div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            Credenciales con vigencia de {BADGE_VALIDITY_MONTHS} meses
          </p>
          <p className="mt-1">
            Cada intento usa una selección aleatoria del banco y mezcla las
            opciones. Si no apruebas, podrás reintentar después de{" "}
            {BADGE_RETRY_COOLDOWN_DAYS} días.
          </p>
        </div>
      </div>
    </main>
  );
}
