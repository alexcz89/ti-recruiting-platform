import type { Metadata } from "next";
import { Award, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { contestLanguageLabel, rankContestRegistrations } from "@/lib/contests/domain";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificado verificable | TaskIO",
  robots: { index: false, follow: false },
};

export default async function ContestCertificatePage({ params }: { params: { slug: string; registrationId: string } }) {
  const contest = await prisma.contest.findUnique({
    where: { slug: params.slug },
    include: {
      registrations: {
        where: {
          rankingConsent: true,
          status: { not: "DISQUALIFIED" },
          attempt: { status: { in: ["SUBMITTED", "EVALUATED", "COMPLETED"] } },
        },
        include: {
          candidate: { select: { name: true } },
          track: { select: { language: true } },
          attempt: { select: { totalScore: true, timeSpent: true, submittedAt: true } },
        },
      },
    },
  });
  if (!contest) notFound();

  const ranking = rankContestRegistrations(contest.registrations);

  const recipient = ranking.find((entry) => entry.registrationId === params.registrationId);
  if (!recipient || recipient.rank > 10) notFound();

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 px-4 py-12 dark:bg-zinc-950 sm:py-20">
      <article className="relative mx-auto max-w-4xl overflow-hidden border-[10px] border-zinc-950 bg-white px-7 py-14 text-center text-zinc-950 shadow-2xl dark:border-emerald-500 dark:bg-zinc-900 dark:text-white sm:px-16 sm:py-20">
        <div className="absolute left-0 top-0 h-2 w-full bg-emerald-500" />
        <Award className="mx-auto h-14 w-14 text-emerald-600" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.32em] text-emerald-700 dark:text-emerald-400">Certificado verificable</p>
        <h1 className="mt-5 text-3xl font-black sm:text-5xl">TaskIO Coding Challenge 2026</h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">TaskIO reconoce a</p>
        <p className="mt-3 text-3xl font-black sm:text-4xl">{recipient.candidateName || recipient.publicName}</p>
        <p className="mx-auto mt-6 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-300">por obtener el <strong>lugar #{recipient.rank}</strong> en la etapa clasificatoria, resolviendo el reto en <strong>{contestLanguageLabel(recipient.language)}</strong> con una calificación de <strong>{recipient.totalScore}/100</strong>.</p>
        <div className="mx-auto mt-10 flex max-w-md items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Credencial validada por TaskIO</div>
        <p className="mt-12 font-mono text-[11px] text-zinc-400">ID: {recipient.registrationId}</p>
      </article>
    </main>
  );
}