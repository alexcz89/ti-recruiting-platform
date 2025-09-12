// app/dashboard/jobs/new/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JobForm from "../JobForm";

export default async function NewJobPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session) redirect(`/signin?callbackUrl=/dashboard/jobs/new`);
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  // opcional: buscar recruiterId por email
  async function createAction(fd: FormData) {
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

    // asigna recruiterId si hay usuario en DB
    let recruiterId: string | null = null;
    const email = session?.user?.email || "";
    if (email) {
      const recruiter = await prisma.user.findUnique({ where: { email } });
      if (recruiter) recruiterId = recruiter.id;
    }

    const job = await prisma.job.create({
      data: {
        title, company, location,
        employmentType: employmentType as any,
        seniority: seniority as any,
        description,
        skills,
        salaryMin, salaryMax, currency,
        remote,
        recruiterId: recruiterId ?? undefined,
      },
      select: { id: true },
    });

    redirect("/dashboard/jobs");
  }

  return (
    <main>
      <h2 className="text-lg font-semibold mb-4">Nueva vacante</h2>
      <JobForm onSubmit={createAction} submitLabel="Crear vacante" />
    </main>
  );
}
