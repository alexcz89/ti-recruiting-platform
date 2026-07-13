// app/badge/[slug]/page.tsx
// Credencial pública verificable de un badge técnico Taskio.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/server/prisma";
import {
  badgeCredentialId,
  badgeExpiresAt,
  badgeLevelLabel,
  badgeLogoSrc,
  isBadgeCurrent,
} from "@/lib/badges";
import { BadgeMedal } from "@/components/badges/BadgeMedal";
import {
  CalendarDays,
  CheckCircle2,
  Fingerprint,
  ShieldCheck,
  Target,
} from "lucide-react";

export const dynamic = "force-dynamic";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";

async function getBadge(slug: string) {
  return prisma.candidateBadge.findUnique({
    where: { slug },
    select: {
      slug: true,
      level: true,
      isPublic: true,
      earnedAt: true,
      term: { select: { label: true, slug: true } },
      candidate: {
        select: { name: true, firstName: true, lastName: true },
      },
      attempt: {
        select: {
          totalScore: true,
          template: {
            select: {
              passingScore: true,
              totalQuestions: true,
              sections: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });
}

function candidateDisplayName(candidate: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  return (
    candidate.name ||
    [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") ||
    "Candidato Taskio"
  );
}

function extractSkillAreas(sections: unknown): string[] {
  if (!Array.isArray(sections)) return [];

  const areas = sections
    .map((section) => {
      if (typeof section === "string") return section.trim();
      if (!section || typeof section !== "object") return "";
      const value = section as { name?: unknown; title?: unknown };
      return String(value.name ?? value.title ?? "").trim();
    })
    .filter(Boolean);

  return [...new Set(areas)].slice(0, 6);
}


export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const badge = await getBadge(params.slug);
  if (!badge || !badge.isPublic) return { title: "Credencial | TaskIO" };

  const name = candidateDisplayName(badge.candidate);
  const status = isBadgeCurrent(badge.earnedAt) ? "verificada" : "vencida";
  const title =
    name +
    " — " +
    badge.term.label +
    " · " +
    badgeLevelLabel(badge.level) +
    " " +
    status +
    " | TaskIO";
  const description =
    name +
    " aprobó la evaluación de " +
    badge.term.label +
    " (" +
    badgeLevelLabel(badge.level) +
    ") en TaskIO.";
  const ogImage =
    APP_URL + "/api/og/badge?slug=" + encodeURIComponent(badge.slug);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicBadgePage({
  params,
}: {
  params: { slug: string };
}) {
  const badge = await getBadge(params.slug);
  if (!badge || !badge.isPublic) notFound();

  const name = candidateDisplayName(badge.candidate);
  const levelLabel = badgeLevelLabel(badge.level);
  const expiresAt = badgeExpiresAt(badge.earnedAt);
  const current = isBadgeCurrent(badge.earnedAt);
  const areas = extractSkillAreas(badge.attempt.template.sections);
  const examVersion = badge.attempt.template.updatedAt.toLocaleDateString(
    "es-MX",
    { year: "numeric", month: "2-digit" }
  );
  const formatDate = (date: Date) =>
    date.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <main className="w-full px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-6 border-b border-zinc-100 p-6 dark:border-zinc-800 sm:grid-cols-[180px_1fr] sm:p-8">
            <div className="flex justify-center sm:items-start">
              <BadgeMedal
                skill={badge.term.label}
                level={badge.level}
                size={160}
                logoSrc={badgeLogoSrc(badge.term.slug)}
              />
            </div>

            <div className="min-w-0 text-center sm:text-left">
              <span
                className={
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " +
                  (current
                    ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                }
              >
                {current ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <CalendarDays className="h-3.5 w-3.5" />
                )}
                {current ? "Credencial vigente" : "Credencial vencida"}
              </span>

              <h1 className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
                {badge.term.label} · {levelLabel}
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Emitida por Taskio para{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {name}
                </span>
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
                {badge.attempt.totalScore != null && (
                  <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                    Puntaje{" "}
                    <strong className="text-zinc-900 dark:text-white">
                      {badge.attempt.totalScore}%
                    </strong>
                  </span>
                )}
                <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                  Mínimo aprobatorio{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    {badge.attempt.template.passingScore}%
                  </strong>
                </span>
                <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                  {badge.attempt.template.totalQuestions} preguntas
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Fingerprint className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Datos de verificación
              </h2>
              <dl className="mt-3 space-y-3 text-xs">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    ID de credencial
                  </dt>
                  <dd className="mt-0.5 break-all font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {badgeCredentialId(badge.slug)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    Fecha de expedición
                  </dt>
                  <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDate(badge.earnedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    Vigente hasta
                  </dt>
                  <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDate(expiresAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    Versión de la evaluación
                  </dt>
                  <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {examVersion}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Áreas evaluadas
              </h2>
              {areas.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {areas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Fundamentos y aplicación práctica de {badge.term.label}.
                </p>
              )}

              <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-800/50 dark:bg-teal-950/20">
                <p className="flex items-center gap-2 text-xs font-semibold text-teal-800 dark:text-teal-200">
                  <ShieldCheck className="h-4 w-4" />
                  Resultado validado por Taskio
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-teal-700 dark:text-teal-300">
                  El resultado se calcula en servidor con preguntas y opciones
                  aleatorias. Esta credencial valida conocimientos del examen;
                  no sustituye la verificación de identidad o experiencia
                  laboral.
                </p>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ¿Tú también dominas {badge.term.label}?
          </p>
          <Link
            href="/certificaciones"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
          >
            Certifícate gratis en Taskio
          </Link>
        </div>
      </div>
    </main>
  );
}
