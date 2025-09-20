// app/jobs/[id]/page.tsx
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function JobDetail({ params }: { params: { id: string } }) {
  // 1) Cargar la vacante con la relación a Company
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      location: true,
      employmentType: true,
      seniority: true,
      remote: true,
      description: true,
      skills: true,
      updatedAt: true,
      company: { select: { name: true } },
    },
  })
  if (!job) notFound()

  // 2) Leer sesión (si existe) para decidir qué botón mostrar
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  const isCandidate = role === "CANDIDATE"

  // 3) Server Action para postularse
  async function applyAction() {
    "use server"
    const s = await getServerSession(authOptions)

    if (!s?.user) {
      redirect(`/signin?role=CANDIDATE&callbackUrl=/jobs/${params.id}`)
    }
    if ((s.user as any).role !== "CANDIDATE") {
      // Solo candidatos pueden postular
      redirect("/")
    }

    // Ubicar candidateId por email de sesión
    const candidate = await prisma.user.findUnique({
      where: { email: s.user.email! },
      select: { id: true },
    })
    if (!candidate) redirect("/")

    // Evitar duplicados
    const existing = await prisma.application.findFirst({
      where: { jobId: params.id, candidateId: candidate.id },
      select: { id: true },
    })
    if (existing) {
      // Ya postuló; regresa al resumen con aviso
      redirect("/profile/summary?applied=existing")
    }

    await prisma.application.create({
      data: {
        jobId: params.id,
        candidateId: candidate.id,
        status: "SUBMITTED",
      },
    })

    // Éxito
    redirect("/profile/summary?applied=1")
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        <p className="text-zinc-600">
          {job.company?.name ?? "—"} — {job.location}
        </p>
        <p className="text-sm text-zinc-500">
          {job.employmentType} · {job.seniority} · {job.remote ? "Remoto" : "Presencial/Híbrido"}
        </p>
      </header>

      <section className="prose prose-zinc max-w-none">
        <pre className="whitespace-pre-wrap font-sans text-[15px] leading-6">
          {job.description}
        </pre>
      </section>

      {job.skills?.length > 0 && (
        <section className="mt-2 flex flex-wrap gap-2">
          {job.skills.map((s) => (
            <span key={s} className="text-xs bg-gray-100 px-2 py-1 rounded border">
              {s}
            </span>
          ))}
        </section>
      )}

      <footer className="pt-4">
        {isCandidate ? (
          <form action={applyAction}>
            <button className="border rounded-xl px-4 py-2 hover:bg-gray-50">
              Postularme
            </button>
          </form>
        ) : (
          <a
            href={`/signin?role=CANDIDATE&callbackUrl=/jobs/${job.id}`}
            className="border rounded-xl px-4 py-2 hover:bg-gray-50 inline-block"
          >
            Iniciar sesión como candidato para postular
          </a>
        )}
      </footer>
    </main>
  )
}
