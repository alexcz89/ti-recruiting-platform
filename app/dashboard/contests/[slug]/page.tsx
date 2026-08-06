import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { contestLanguageLabel, rankContestRegistrations } from "@/lib/contests/domain";
import ManualScoreForm from "./ManualScoreForm";

export const dynamic = "force-dynamic";

export default async function ContestAdminPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const role = String((session?.user as { role?: string } | undefined)?.role ?? "").toUpperCase();
  if (!session?.user) redirect("/auth/signin");
  if (role !== "ADMIN") redirect("/dashboard");

  const contest = await prisma.contest.findUnique({
    where: { slug: params.slug },
    include: {
      registrations: {
        include: {
          candidate: { select: { name: true, email: true } },
          track: { select: { language: true } },
          attempt: { select: { status: true, totalScore: true, timeSpent: true, submittedAt: true, severity: true, severityScore: true } },
        },
        orderBy: { registeredAt: "desc" },
      },
    },
  });
  if (!contest) notFound();

  const completed = contest.registrations.filter((item) => item.attempt && ["SUBMITTED", "EVALUATED", "COMPLETED"].includes(item.attempt.status));
  const ranking = rankContestRegistrations(completed.filter((item) => item.status !== "DISQUALIFIED"));

  const rankByRegistration = new Map(ranking.map((item) => [item.registrationId, item.rank]));

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Operación del concurso</p><h1 className="mt-2 text-3xl font-black">{contest.title}</h1></div>
        <Link href={`/concursos/${contest.slug}`} className="btn btn-ghost">Ver convocatoria pública</Link>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[["Registros", contest.registrations.length], ["Entregas", completed.length], ["Interés laboral", contest.registrations.filter((r) => r.jobInterest).length], ["Alertas", contest.registrations.filter((r) => (r.attempt?.severityScore ?? 0) > 0).length]].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>
        ))}
      </div>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Participante</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Lenguaje</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Rúbrica</th><th className="px-4 py-3">Integridad</th><th className="px-4 py-3">IA declarada</th></tr></thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {contest.registrations.map((registration) => {
              const rank = rankByRegistration.get(registration.id);
              return <tr key={registration.id} className={rank && rank <= 10 ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""}>
                <td className="px-4 py-4 font-black">{rank ? `#${rank}` : "—"}</td>
                <td className="px-4 py-4"><p className="font-semibold">{registration.candidate.name || "Sin nombre"}</p><a className="text-xs text-emerald-700 hover:underline dark:text-emerald-400" href={`mailto:${registration.candidate.email}`}>{registration.candidate.email}</a></td>
                <td className="px-4 py-4"><a className="hover:underline" href={registration.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>{registration.githubUrl ? <> · <a className="hover:underline" href={registration.githubUrl} target="_blank" rel="noreferrer">GitHub</a></> : null}<p className="mt-1 text-xs text-zinc-500">{registration.city} · {registration.experienceLevel}</p></td>
                <td className="px-4 py-4">{contestLanguageLabel(registration.track.language)}</td>
                <td className="px-4 py-4"><strong>{registration.finalScore}</strong><span className="text-zinc-400"> / 100</span><p className="text-xs text-zinc-500">Auto: {registration.automatedScore}/75</p></td>
                <td className="px-4 py-4">{registration.attempt && ["SUBMITTED", "EVALUATED", "COMPLETED"].includes(registration.attempt.status) ? <ManualScoreForm slug={contest.slug} registration={registration} /> : <span className="text-xs text-zinc-400">Esperando entrega</span>}</td>
                <td className="px-4 py-4"><span className={(registration.attempt?.severityScore ?? 0) > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>{registration.attempt?.severity ?? "NORMAL"}</span><p className="text-xs text-zinc-500">{registration.attempt?.severityScore ?? 0} pts</p></td>
                <td className="max-w-[220px] px-4 py-4 text-xs text-zinc-500">{registration.aiFreeCategory ? "Código sin IA" : registration.aiToolDisclosure || "Sin herramienta declarada"}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}