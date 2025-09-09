import { notFound } from "next/navigation";

async function getJob(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/jobs?id=${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar la vacante");
  return res.json();
}

export default async function JobDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const data = await getJob(id);
  const job = data.job;
  if (!job) return notFound();

  return (
    <section className="py-6">
      <h2 className="text-2xl font-semibold">{job.title}</h2>
      <p className="text-sm text-zinc-600">{job.company} • {job.location}</p>
      <p className="mt-4 whitespace-pre-wrap">{job.description}</p>
      <form action="/api/applications" method="post" className="mt-6 border rounded-xl p-4">
        <input type="hidden" name="jobId" value={job.id} />
        <div className="grid gap-3">
          <label className="text-sm">Email</label>
          <input required name="email" className="border rounded px-3 py-2" placeholder="tu@email.com" />
          <label className="text-sm">Carta de presentación</label>
          <textarea name="coverLetter" className="border rounded px-3 py-2" rows={4} />
          <button className="border rounded px-4 py-2 w-fit">Postularme</button>
        </div>
      </form>
    </section>
  );
}
