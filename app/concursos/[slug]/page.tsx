import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import {
  Award,
  CalendarDays,
  Check,
  Clock3,
  Code2,
  Globe2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
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
const CONTEST_TIMEZONE = "America/Mexico_City";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const contest = await prisma.contest.findUnique({
    where: { slug: params.slug },
    select: { title: true, subtitle: true },
  });
  return contest
    ? { title: `${contest.title} | TaskIO`, description: contest.subtitle ?? "Reto práctico de programación de TaskIO" }
    : { title: "Challenge | TaskIO" };
}

function formatDate(value: Date | null) {
  if (!value) return "Por anunciar";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CONTEST_TIMEZONE,
    timeZoneName: "short",
  }).format(value);
}

const briefSections = [
  {
    title: "Objetivo",
    body: "Implementa una función que valide solicitudes de candidatos, elimine duplicados y devuelva los perfiles mejor clasificados.",
  },
  {
    title: "Entrada",
    body: "Recibirás una lista de registros con name, score, experience e english, además de un entero topN que limita el resultado.",
  },
  {
    title: "Reglas",
    body: "Descarta nombres vacíos, valores no numéricos, experiencia negativa, niveles de inglés desconocidos y scores menores a 70. Los nombres se comparan sin distinguir mayúsculas.",
  },
  {
    title: "Fórmula",
    body: "puntaje = score × 0.70 + min(experience, 5) × 4 + inglés. Inglés: A1=0, A2=2, B1=4, B2=6, C1=8 y C2=10.",
  },
  {
    title: "Ordenamiento",
    body: "Ordena por puntaje final descendente, luego por score descendente y finalmente por nombre ascendente. En duplicados conserva el registro con mayor puntaje final.",
  },
  {
    title: "Salida esperada",
    body: "Devuelve como máximo topN nombres, en el orden calculado. Si topN es 0 o no hay registros válidos, devuelve una lista vacía.",
  },
  {
    title: "Casos inválidos",
    body: "Tu solución se probará con listas vacías, duplicados, empates, campos faltantes, topN fuera de rango y límites de experiencia.",
  },
  {
    title: "Restricciones",
    body: "No uses servicios externos ni acceso a red. La solución debe ejecutarse dentro de los límites de 5 segundos y 256 MB.",
  },
];

export default async function ContestPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  const contest = await prisma.contest.findUnique({
    where: { slug: params.slug },
    include: {
      tracks: {
        where: { isActive: true },
        include: { template: { select: { id: true, timeLimit: true } } },
        orderBy: { language: "asc" },
      },
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
  const ownRank = ownRegistration
    ? ranking.find((entry) => entry.registrationId === ownRegistration.id)?.rank
    : undefined;
  const credentialVerified = Boolean(
    ownRegistration &&
    ["FINALIST", "WINNER"].includes(String(ownRegistration.status)) &&
    ownRank &&
    ownRank <= 10
  );

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
          : null,
        certificateUrl: credentialVerified
          ? `/concursos/${contest.slug}/certificados/${ownRegistration.id}`
          : null,
      }
    : null;

  return (
    <main className="overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="relative border-b border-zinc-800 bg-zinc-950 text-white">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.22),transparent_30%),radial-gradient(circle_at_88%_70%,rgba(20,184,166,0.14),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_.8fr] lg:items-end lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm font-bold text-emerald-300">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Edición Junior · 2026
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-[-0.03em] [text-wrap:balance] sm:text-6xl lg:text-7xl">{contest.title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300 [text-wrap:pretty] sm:text-xl">{contest.subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#registro" className="btn min-h-12 bg-emerald-400 px-6 font-bold text-zinc-950 hover:bg-emerald-300">Participar ahora</a>
              <a href="#reglas" className="btn min-h-12 border border-white/20 bg-white/5 px-6 text-white hover:bg-white/10">Ver reglas y ejemplo</a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-zinc-300">
              <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-400" aria-hidden="true" />60 minutos continuos</span>
              <span className="flex items-center gap-2"><Code2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />3 lenguajes</span>
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-400" aria-hidden="true" />Máximo 2 años de experiencia</span>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 sm:p-7" aria-label="Datos principales del challenge">
            <p className="text-sm font-semibold text-emerald-300">La meta</p>
            <p className="mt-2 text-4xl font-black">Top 10</p>
            <dl className="mt-6 divide-y divide-white/10 text-sm">
              <div className="flex justify-between gap-4 py-3 first:pt-0"><dt className="text-zinc-400">Cierre de registro</dt><dd className="text-right font-semibold text-white">{formatDate(contest.registrationCloses)}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-400">Público</dt><dd className="text-right font-semibold text-white">Junior · México</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-400">Modalidad</dt><dd className="text-right font-semibold text-white">Remota</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-zinc-400">Horario</dt><dd className="text-right font-semibold text-white">Hora del centro de México</dd></div>
              <div className="flex justify-between gap-4 py-3 last:pb-0"><dt className="text-zinc-400">Premio</dt><dd className="text-right font-semibold text-white">Por anunciar</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section id="reto" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-black tracking-[-0.025em] [text-wrap:balance] sm:text-4xl">Un enunciado preciso, como en un proyecto real</h2>
          <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-300">Lee el alcance antes de iniciar. La clasificatoria utiliza la misma especificación y añade casos ocultos para validar consistencia.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {contest.tracks.map((track) => <span key={track.id} className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900">{contestLanguageLabel(track.language)}</span>)}
          </div>
        </div>

        <article className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {briefSections.map((section) => (
              <section key={section.title} className="grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[11rem_1fr] sm:gap-6">
                <h3 className="font-bold text-zinc-950 dark:text-white">{section.title}</h3>
                <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300">{section.body}</p>
              </section>
            ))}
          </div>

          <section id="ejemplo" className="mt-8 border-t border-zinc-200 pt-8 dark:border-zinc-800">
            <h3 className="font-bold">Prueba de práctica · sin puntuación</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Este ejemplo sirve para verificar el formato; no cuenta para el ranking.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><p className="mb-2 text-sm font-semibold">Entrada</p><pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 text-sm leading-6 text-zinc-100"><code>{`2\nAna|85|3|B2\nLuis|92|1|C1`}</code></pre></div>
              <div><p className="mb-2 text-sm font-semibold">Salida</p><pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 text-sm leading-6 text-emerald-300"><code>Ana,Luis</code></pre></div>
            </div>
          </section>
        </article>
      </section>

      <section className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black tracking-[-0.025em]">Cómo funciona</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Registro", "Cuenta TaskIO, elegibilidad y consentimientos.", formatDate(contest.registrationCloses)],
              ["Práctica", "Revisa el ejemplo público sin afectar tu puntuación.", "Disponible en esta página"],
              ["Clasificatoria", "Ventana de 72 horas; al iniciar corren 60 minutos continuos.", `${formatDate(contest.challengeOpens)} — ${formatDate(contest.challengeCloses)}`],
              ["Final Top 10", "Defensa remota de 30 minutos, sujeta a verificación.", formatDate(contest.finalStartsAt)],
            ].map(([title, body, date], index) => (
              <article key={title} className="relative pl-11">
                <span className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{index + 1}</span>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{body}</p>
                <p className="mt-3 text-sm font-semibold text-zinc-500 dark:text-zinc-300">{date}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="reglas" className="mx-auto grid max-w-7xl scroll-mt-20 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_.9fr] lg:px-8 lg:py-24">
        <div>
          <h2 className="text-3xl font-black tracking-[-0.025em] [text-wrap:balance]">Qué se califica y cómo se verifica</h2>
          <div className="mt-8 space-y-4">
            {["Pruebas funcionales automáticas: 60 puntos", "Casos límite y robustez: 15 puntos", "Calidad y legibilidad: 10 puntos", "Eficiencia: 10 puntos", "Explicación y defensa: 5 puntos", "Una sola entrega final; ranking sujeto a verificación"].map((item) => (
              <p key={item} className="flex items-start gap-3 text-base text-zinc-700 dark:text-zinc-300"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{item}</p>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>Uso responsable de IA:</strong> puedes usar documentación o herramientas generativas si las declaras. En la final deberás explicar, modificar y defender personalmente el código.
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <strong>Protocolo de incidentes:</strong> si una falla de TaskIO interrumpe el intento, conserva el ID y repórtalo en los siguientes 30 minutos mediante el <a href="mailto:alejandro@taskio.com.mx?subject=Incidente%20TaskIO%20Coding%20Challenge&amp;body=ID%20del%20intento%3A%20%0ADescripci%C3%B3n%20de%20la%20falla%3A%20" className="font-bold underline underline-offset-2">correo de soporte</a>. El equipo revisará los registros técnicos y sólo autorizará un reinicio cuando sea atribuible a la plataforma.
            </div>
          </div>

          <div className="mt-10">
            <h3 className="text-xl font-bold">Defensa final · 30 minutos</h3>
            <ol className="mt-5 space-y-3 text-base text-zinc-700 dark:text-zinc-300">
              <li><strong>5 min:</strong> explicar la solución y sus decisiones.</li>
              <li><strong>10 min:</strong> corregir un caso límite.</li>
              <li><strong>10 min:</strong> añadir una nueva regla.</li>
              <li><strong>5 min:</strong> responder sobre complejidad y alternativas.</li>
            </ol>
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
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><h2 className="text-3xl font-black">Ranking provisional</h2><p className="mt-2 text-sm text-zinc-400">El Top 10 queda sujeto a validación de identidad, solución y elegibilidad.</p></div>
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
            ) : <div className="px-6 py-14 text-center text-zinc-400"><Trophy className="mx-auto mb-4 h-9 w-9 text-zinc-600" aria-hidden="true" />El ranking aparecerá cuando lleguen las primeras soluciones.</div>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black">Reconocimientos</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl bg-amber-50 p-5 dark:bg-amber-950/30"><Trophy className="h-6 w-6 text-amber-700" aria-hidden="true" /><h3 className="mt-4 font-bold">Premio para el Top 3</h3><p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">Los primeros tres lugares recibirán un premio. El monto todavía está por definir.</p></article>
          <article className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-950/30"><Award className="h-6 w-6 text-emerald-600" aria-hidden="true" /><h3 className="mt-4 font-bold">Certificado verificable</h3><p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">El Top 10 verificado obtiene una credencial pública de TaskIO.</p></article>
          <article className="rounded-2xl bg-sky-50 p-5 dark:bg-sky-950/30"><Code2 className="h-6 w-6 text-sky-700" aria-hidden="true" /><h3 className="mt-4 font-bold">Distinciones técnicas</h3><p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">Mejor solución por lenguaje y reconocimiento a código legible.</p></article>
          <article className="rounded-2xl bg-violet-50 p-5 dark:bg-violet-950/30"><ShieldCheck className="h-6 w-6 text-violet-700" aria-hidden="true" /><h3 className="mt-4 font-bold">Directorio de talento</h3><p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">Participación opcional y únicamente con consentimiento del candidato.</p></article>
        </div>
        <div className="mt-8 flex flex-wrap gap-5 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />México</span>
          <span className="flex items-center gap-2"><Globe2 className="h-4 w-4" aria-hidden="true" />Modalidad remota</span>
          <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />Horarios publicados en zona centro</span>
        </div>
      </section>
    </main>
  );
}