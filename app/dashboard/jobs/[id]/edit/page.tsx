// app/dashboard/jobs/[id]/edit/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JobForm from "../../JobForm";

export default async function EditJobPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session) redirect(`/signin?callbackUrl=/dashboard/jobs/${params.id}/edit`);
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) notFound();

  async function updateAction(fd: FormData) {
    "use server";
    const title = String(fd.get("title") || "");
    const company = String(fd.get("company") || "");
    const location = String(fd.get("location") || "");
    const employmentType = String(fd.get("employmentType") || "FULL_TIME");
    const seniority = String(fd.get("seniority") || "MID");
    const description = String(fd.get("description") || "");
    const skillsRaw = String(fd.get("skills") || "");
    const salaryMin = Number(String(fd.get("salaryMin") || "")) || null;
    const salaryMax = Number(String(fd.get("salaryMax") || "")) || null;
    const currency = String(fd.get("currency") || "") || "MXN";
    const remote = String(fd.get("remote") || "false") === "true";

    const skills = skillsRaw.split(",").map(s=>s.trim()).filter(Boolean);

    await prisma.job.update({
      where: { id: params.id },
      data: {
        title, company, location,
        employmentType: employmentType as any,
        seniority: seniority as any,
        description,
        skills,
        salaryMin, salaryMax, currency,
        remote,
      },
    });

    redirect("/dashboard/jobs");
  }

  return (
    <main>
      <h2 className="text-lg font-semibold mb-4">Editar vacante</h2>
      <JobForm
        onSubmit={updateAction}
        submitLabel="Actualizar vacante"
        initial={{
          title: job.title,
          company: job.company,
          location: job.location,
          employmentType: job.employmentType,
          seniority: job.seniority,
          description: job.description,
          skills: job.skills,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          currency: job.currency,
          remote: job.remote,
        }}
      />
    </main>
  );
}
