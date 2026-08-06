import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { Award, Check, Clock3, Code2, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import {
  challengeAvailability,
  contestLanguageLabel,
  contestLanguageRunner,
  rankContestRegistrations,
  registrationAvailability,
} from "@/lib/contests/domain";
import ContestRegistrationForm from "./ContestRegistrationForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const contest = await prisma.contest.findUnique({ where: { slug: params.slug }, select: { title: true, subtitle: true } });
  return contest
    ? { title: `${contest.title} | TaskIO`, description: contest.subtitle ?? "Reto de programación de TaskIO" }
    : { title: "Concurso | TaskIO" };
}

function formatDate(value: Date | null) {
  if (!value) return "Por anunciar";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" }).format(value);
}

export default async function ContestPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  const contest = await prisma.contest.findUnique({
    where: { slug: params.slug },
    include: {
      tracks: { where: { isActive: true }, include: { template: { select: { id: true, timeLimit: true } } }, orderBy: { language: "asc" } },
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
      _count: { select: { registrations: true } },
    },
  });

  if (!contest || contest.status === "DRAFT" || contest.status === "CANCELLED") notFound();

  const ownRegistration = user?.id && String(user.role).toUpperCase() === "CANDIDATE"
    ? await prisma.contestRegistration.findUnique({
        where: { contestId_candidateId: { contestId: contest.id, candidateId: user.id } },
        include: { track: true, attempt: true },
      })
    : null;

  const availability = registrationAvailability({ ...contest, registrationCount: contest._count.registrations });
  const challenge = challengeAvailability(contest);
  const ranking = rankContestRegistrations(contest.registrations);


  const ownRunner = ownRegistration ? contestLanguageRunner(ownRegistration.track.language) : null;
  const existing = ownRegistration
    ? {
        status: ownRegistration.attempt?.status ?? ownRegistration.status,
        challengeMessage: challenge.reason,
        score: ownRegistration.attempt?.totalScore ?? null,
        assessmentUrl: ownRegistration.attemptId && challenge.open
          ? `/assessments/${ownRegistration.track.templateId}?attemptId=${ownRegistration.attemptId}&language=${ownRunner}`
          : null,
        resultUrl: ownRegistration.attemptId && ["SUBMITTED", "EVALUATED", "COMPLETED"].includes(String(ownRegistration.attempt?.status))
          ? `/assessments/attempts/${ownRegistration.attemptId}/results`
          : null,        certificateUrl: (ranking.find((entry) => entry.registrationId === ownRegistration.id)?.rank ?? 999) <= 10
          ? `/concursos/${contest.slug}/certificados/${ownRegistration.id}`
          : null,
      }
    : null;

  return (
    <main className="overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="relative border-b border-zinc-200 bg-zinc-950 text-white dark:border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.25),transparent_28%),radial-gradient(circle_at_85%_60%,rgba(20,184,166,0.18),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_.8fr] lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" /> Primera edición · 2026
            </div>
            <h1 className="mt-7 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl">{contest.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">{contest.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#registro" className="btn bg-emerald-400 px-6 py-3 font-bold text-zinc-950 hover:bg-emerald-300">Participar ahora</a>
              <a href="#reto" className="btn border border-white/20 bg-white/5 px-6 py-3 text-white hover:bg-white/10">Conocer el reto</a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400">
              <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-400" /> 60 minutos</span>
              <span className="flex items-center gap-2"><Code2 className="h-4 w-4 text-emerald-400" /> 4 lenguajes</span>
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-400" /> Individual</span>
            </div>
          </div>
          <div className="self-end rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur sm:p-8">
            <p className="text-sm font-semibold text-emerald-300">Bolsa de premios</p>
            <p className="mt-2 text-5xl font-black">$9,000 <span className="text-lg font-semibold text-zinc-400">MXN</span></p>
            <div className="mt-6 space-y-3 text-sm text-zinc-300">
              <p className="flex justify-between border-b border-white/10 pb-3"><span>1er lugar</span><strong className="text-white">$5,000</strong></p>
              <p className="flex justify-between border-b border-white/10 pb-3"><span>2º lugar</span><strong className="text-white">$2,500</strong></p>
              <p className="flex justify-between"><span>3er lugar</span><strong className="text-white">$1,500</strong></p>
            </div>
          </div>
        </div>
      </section>

      <section id="reto" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">El reto clasificatorio</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Programación aplicada a recruiting</h2>
            <p className="mt-5 leading-7 text-zinc-600 dark:text-zinc-300">{contest.description}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              {contest.tracks.map((track) => <span key={track.id} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900">{contestLanguageLabel(track.language)}</span>)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["01", "Depura y valida", "Elimina duplicados, descarta registros inválidos y resuelve casos límite."],
              ["02", "Calcula el ranking", "Combina evaluación, experiencia e inglés con reglas transparentes."],
              ["03", "Pruebas ocultas", "Entre 12 y 20 casos automáticos determinan la calificación principal."],
              ["04", "Defiende tu solución", "El Top 10 modifica y explica su código en una ronda final."],
            ].map(([number, title, body]) => (
              <article key={number} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-xs font-black text-emerald-600">{number}</span>
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              ["Registro", "Comparte ciudad, nivel, lenguaje, LinkedIn y consentimiento de ranking.", formatDate(contest.registrationCloses)],
              ["Clasificatoria", "Un problema práctico, resultado provisional inmediato y una sola participación.", formatDate(contest.challengeOpens)],
              ["Final Top 10", "Corrige, amplía y defiende la solución en 20–30 minutos.", formatDate(contest.finalStartsAt)],
            ].map(([title, body, date], index) => (
              <div key={title} className="relative pl-12">
                <span className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{index + 1}</span>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{body}</p>
                <p className="mt-3 text-xs font-semibold text-zinc-400">{date}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_.9fr] lg:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Reglas claras</p>
          <h2 className="mt-3 text-3xl font-black">Se evalúa lo que entiendes, no sólo lo que entregas</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {["Pruebas automáticas: 60 puntos", "Casos límite: 15 puntos", "Calidad y legibilidad: 10 puntos", "Eficiencia: 10 puntos", "Explicación: 5 puntos", "IA permitida con declaración"].map((item) => (
              <p key={item} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</p>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>Uso responsable de IA:</strong> puedes consultar documentación o herramientas generativas si lo declaras. En la final deberás explicar, modificar y defender personalmente el código entregado.
          </div>
        </div>
        <ContestRegistrationForm
          slug={contest.slug}
          languages={contest.tracks.map((track) => track.language)}
          registrationOpen={availability.open}
          closedReason={availability.reason}
          existing={existing}
        />
      </section>

      <section id="ranking" className="bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">Clasificación</p><h2 className="mt-3 text-3xl font-black">Ranking provisional</h2></div>
            <p className="text-sm text-zinc-400">Desempate: menor tiempo y envío más temprano.</p>
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
            {ranking.length ? (
              <div className="divide-y divide-white/10">
                {ranking.slice(0, 50).map((entry) => (
                  <div key={entry.registrationId} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 bg-white/[0.03] px-4 py-4 sm:grid-cols-[4rem_1fr_10rem_7rem] sm:px-6">
                    <span className={`text-lg font-black ${entry.rank <= 3 ? "text-emerald-400" : "text-zinc-500"}`}>#{entry.rank}</span>
                    <span className="font-semibold">{entry.publicName}</span>
                    <span className="hidden text-sm text-zinc-400 sm:block">{contestLanguageLabel(entry.language)}</span>
                    <span className="text-right font-mono text-lg font-bold">{entry.totalScore}<small className="text-zinc-500">/100</small></span>
                  </div>
                ))}
              </div>
            ) : <div className="px-6 py-14 text-center text-zinc-400"><Trophy className="mx-auto mb-4 h-9 w-9 text-zinc-600" />El ranking aparecerá cuando lleguen las primeras soluciones.</div>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-950/30"><Award className="h-6 w-6 text-emerald-600" /><h3 className="mt-4 font-bold">Certificado verificable</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">El Top 10 obtiene una credencial pública de TaskIO.</p></div>
          <div className="rounded-2xl bg-sky-50 p-5 dark:bg-sky-950/30"><Users className="h-6 w-6 text-sky-600" /><h3 className="mt-4 font-bold">Visibilidad con empresas</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Los mejores perfiles podrán presentarse a aliados.</p></div>
          <div className="rounded-2xl bg-violet-50 p-5 dark:bg-violet-950/30"><ShieldCheck className="h-6 w-6 text-violet-600" /><h3 className="mt-4 font-bold">Evaluación consistente</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Pruebas ocultas, control de plagio y defensa final.</p></div>
        </div>
      </section>
    </main>
  );
}