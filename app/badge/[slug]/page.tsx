// app/badge/[slug]/page.tsx
// Página pública compartible de un badge verificado — el motor viral:
// el candidato la comparte en LinkedIn y cada visita es un CTA a Taskio.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/server/prisma";
import { badgeLevelLabel, badgeLogoSrc } from "@/lib/badges";
import { BadgeMedal } from "@/components/badges/BadgeMedal";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";

async function getBadge(slug: string) {
  return prisma.candidateBadge.findUnique({
    where: { slug },
    select: {
      slug: true,
      level: true,
      isPublic: true,
      earnedAt: true,
      term: { select: { label: true, slug: true } },
      candidate: { select: { name: true, firstName: true, lastName: true } },
    },
  });
}

function candidateDisplayName(c: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  return (
    c.name ||
    [c.firstName, c.lastName].filter(Boolean).join(" ") ||
    "Candidato Taskio"
  );
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const badge = await getBadge(params.slug);
  if (!badge || !badge.isPublic) return { title: "Badge | TaskIO" };

  const name = candidateDisplayName(badge.candidate);
  const title = `${name} — ${badge.term.label} · ${badgeLevelLabel(badge.level)} verificado | TaskIO`;
  const description = `${name} aprobó el examen de ${badge.term.label} (${badgeLevelLabel(badge.level)}) en TaskIO. Certifícate gratis y demuestra tu nivel.`;
  const ogImage = `${APP_URL}/api/og/badge?slug=${encodeURIComponent(badge.slug)}`;

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
  const earnedDate = badge.earnedAt.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Credencial */}
        <div className="rounded-2xl border border-teal-200 bg-white p-6 text-center shadow-sm dark:border-teal-800/50 dark:bg-zinc-900 sm:p-8">
          <div className="flex justify-center">
            <BadgeMedal
              skill={badge.term.label}
              level={badge.level}
              size={168}
              logoSrc={badgeLogoSrc(badge.term.slug)}
            />
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
            Skill verificado
          </p>

          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {badge.term.label} · {levelLabel}
          </h1>

          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {name}
            </span>{" "}
            aprobó el examen de certificación de {badge.term.label} nivel{" "}
            {levelLabel} en TaskIO.
          </p>

          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
            Obtenido el {earnedDate}
          </p>
        </div>

        {/* CTA para visitantes */}
        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ¿Tú también dominas {badge.term.label}?
          </p>
          <Link
            href="/certificaciones"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
          >
            Certifícate gratis en TaskIO
          </Link>
        </div>
      </div>
    </main>
  );
}
