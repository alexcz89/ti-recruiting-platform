// app/jobs/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from "@/lib/server/prisma";
import JobSearchBar from "@/components/JobSearchBar";
import ClientSplitView from "@/components/jobs/ClientSplitView";
import { redirect } from "next/navigation";
import ActiveFilterChips from "@/components/ActiveFilterChips";
import Footer from "@/components/Footer";
import ProfileCompletionBanner from "@/components/candidate/ProfileCompletionBanner";

export const metadata = { title: "Vacantes | Bolsa TI" };

type SearchParams = {
  q?: string;
  location?: string;
  loc?: string;
  remote?: "true" | "false";
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  seniority?: "JUNIOR" | "MID" | "SENIOR" | "LEAD";
  sort?: "relevance" | "recent";
  page?: string;
};

export default async function PublicJobsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id as string | undefined;

  // 🚧 Si es recruiter/admin, no debe navegar el feed público
  if (role === "RECRUITER" || role === "ADMIN") {
    redirect("/dashboard/jobs");
  }

  // Verificar completitud de perfil del candidato
  let missingCv = false;
  let missingSkills = false;
  let missingExperience = false;

  if (userId && role === "CANDIDATE") {
    const candidate = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        resumeUrl: true,
        _count: {
          select: {
            candidateSkills: true,
            experiences: true,
          },
        },
      },
    });

    if (candidate) {
      missingCv = !candidate.resumeUrl;
      missingSkills = candidate._count.candidateSkills === 0;
      missingExperience = candidate._count.experiences === 0;
    }
  }

  const showBanner = missingCv || missingSkills || missingExperience;

  const filters = {
    q: (searchParams.q || "").trim(),
    location: (searchParams.location ?? searchParams.loc ?? "").trim(),
    remote:
      searchParams.remote === "true"
        ? true
        : searchParams.remote === "false"
        ? false
        : undefined,
    employmentType: (searchParams.employmentType as any) || undefined,
    seniority: (searchParams.seniority as any) || undefined,
    sort: (searchParams.sort as "relevance" | "recent") || "recent",
    limit: 10,
    page: Number(searchParams.page || 1),
  };

  return (
    <>
      <main className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-6 lg:px-10 py-6 space-y-4">
        <JobSearchBar />

        {/* Chips de filtros activos */}
        <ActiveFilterChips />

        {/* Banner de completitud de perfil — sólo para candidatos con perfil incompleto */}
        {showBanner && (
          <ProfileCompletionBanner
            missingCv={missingCv}
            missingSkills={missingSkills}
            missingExperience={missingExperience}
          />
        )}

        <header className="space-y-1 pt-2">
          <h1 className="text-3xl font-bold">Vacantes disponibles</h1>
          <p className="text-sm text-zinc-600">
            Selecciona una vacante de la lista para ver los detalles.
          </p>
        </header>

        <ClientSplitView filters={filters} />
      </main>
      <Footer />
    </>
  );
}
