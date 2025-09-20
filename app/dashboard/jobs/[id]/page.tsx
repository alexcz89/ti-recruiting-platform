import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSessionCompanyId } from "@/lib/session"
import KanbanBoard from "./KanbanBoard"

export default async function JobKanbanPage({ params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId()
  if (!companyId) return notFound()

  const job = await prisma.job.findFirst({
    where: { id: params.id, companyId },
    select: { id: true, title: true }
  })
  if (!job) return notFound()

  const applications = await prisma.application.findMany({
    where: { jobId: job.id },
    include: {
      candidate: {
        select: {
          id: true, name: true, email: true, resumeUrl: true,
          frontend: true, backend: true, cloud: true, database: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Kanban — {job.title}</h1>
      <KanbanBoard jobId={job.id} initialApplications={applications} />
    </div>
  )
}
