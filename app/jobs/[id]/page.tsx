import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function JobDetail({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({ where: { id: params.id } });

  if (!job) notFound();

  async function applyAction() {
    "use server";
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session) {
      redirect(`/signin?callbackUrl=/jobs/${params.id}`);
    }

    if (user?.role !== "CANDIDATE") {
      redirect("/"); // solo candidatos pueden postular
    }

    // busca candidateId en la tabla User
    const candidate = await prisma.user.findUnique({
      where: { email: user.email },
    });
    if (!candidate) redirect("/");

    // evita duplicar aplicación
    const existing = await prisma.application.findFirst({
      where: { jobId: params.id, candidateId: candidate.id },
    });
    if (existing) {
      redirect("/profile"); // ya postuló
    }

    await prisma.application.create({
      data: {
        jobId: params.id,
        candidateId: candidate.id,
        status: "SUBMITTED",
      },
    });

    redirect("/profile"); // o /dashboard/applications para ver como recruiter
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold">{job.title}</h1>
      <p className="text-zinc-600 mt-1">{job.company} — {job.location}</p>
      <p className="text-sm text-zinc-500 mt-1">
        {job.employmentType} · {job.seniority} · {job.remote ? "Remoto" : "Presencial"}
      </p>

      <hr className="my-6" />

      <div className="prose prose-zinc max-w-none">
        <pre className="whitespace-pre-wrap font-sans">{job.description}</pre>
      </div>

      {job.skills?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {job.skills.map((s) => (
            <span key={s} className="text-xs bg-gray-100 px-2 py-1 rounded">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6">
        <form action={applyAction}>
          <button className="border rounded-xl px-4 py-2">Postular</button>
        </form>
      </div>
    </main>
  );
}
