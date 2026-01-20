// app/jobs/[id]/page.tsx
import { prisma } from '@/lib/server/prisma';
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { getSessionCompanyId } from '@/lib/server/session';
import JobDetailPanel from "@/components/jobs/JobDetailPanel";
import AssessmentRequirement from "./AssessmentRequirement";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: { id: string } };

// ——— Helper para recortar texto seguro
function excerpt(text: string | null | undefined, max = 160) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// ——— Helper para quitar etiquetas HTML (para SEO)
function stripHtml(html: string | null | undefined) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ——— Metadata para SEO/Social
export async function generateMetadata({ params }: Params) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      descriptionHtml: true,
      company: { select: { name: true } },
      location: true,
    },
  });

  if (!job) return {};

  const title = `${job.title} ${job.company?.name ? "— " + job.company.name : ""}`;

  const baseDescription = job.description || stripHtml(job.descriptionHtml || "");
  const description = excerpt(baseDescription, 160);

  const url = `${
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  }/jobs/${job.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function JobDetail({ params }: Params) {
  // 1) Sesión y rol
  const session = await getServerSession(authOptions);
  const user = (session?.user as any) || null;

  const role =
    (user?.role as "CANDIDATE" | "RECRUITER" | "ADMIN" | undefined) ?? undefined;
  const isCandidate = role === "CANDIDATE";

  // 2) Cargar vacante + assessment requerido (si existe)
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      location: true,
      employmentType: true,
      remote: true,
      description: true,
      descriptionHtml: true,
      skills: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      companyId: true,
      company: { select: { name: true } },
      status: true,

      // 👇 assessment requerido (solo 1 por ahora)
      assessments: {
        where: { isRequired: true },
        orderBy: { createdAt: "asc" }, // ✅ determinístico
        take: 1,
        select: {
          id: true,
          isRequired: true,
          minScore: true,
          templateId: true,
          template: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              totalQuestions: true,
              timeLimit: true,
              passingScore: true,
            },
          },
        },
      },
    },
  });

  if (!job) notFound();
  // if (job.status !== "OPEN") notFound();

  // ✅ Log temporal para detectar si trae assessment requerido
  console.log("[PUBLIC JOB]", {
    jobId: job?.id,
    requiredAssessmentsCount: job?.assessments?.length ?? 0,
    requiredAssessmentTemplateId: job?.assessments?.[0]?.templateId ?? null,
    requiredAssessmentTitle: job?.assessments?.[0]?.template?.title ?? null,
  });

  // 3) Permisos recruiter/admin: solo su empresa
  let canEdit = false;
  if (role === "RECRUITER" || role === "ADMIN") {
    const myCompanyId = await getSessionCompanyId().catch(() => null);
    if (!myCompanyId || job.companyId !== myCompanyId) {
      notFound();
    }
    canEdit = true;
  }

  // 4) Intento del candidato (solo si está logueado como candidato y hay assessment)
  const requiredAssessment = job.assessments?.[0] ?? null;

  const userAttempt =
    isCandidate && user?.id && requiredAssessment?.templateId
      ? await prisma.assessmentAttempt.findFirst({
          where: {
            candidateId: user.id,
            templateId: requiredAssessment.templateId,
            status: { in: ["SUBMITTED", "EVALUATED"] },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            totalScore: true,
            passed: true,
          },
        })
      : null;

  // 5) Shape para JobDetailPanel
  const panelJob = {
    id: job.id,
    title: job.title,
    company: job.company?.name ?? null,
    location: job.location,
    remote: job.remote,
    employmentType: job.employmentType,
    description: job.description,
    descriptionHtml: job.descriptionHtml,
    skills: job.skills ?? [],
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    currency: job.currency ?? "MXN",
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  // 6) JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company?.name ?? "Empresa confidencial",
    },
    jobLocationType: job.remote ? "TELECOMMUTE" : "ONSITE",
    jobLocation: job.remote
      ? undefined
      : [
          {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location || "México",
              addressCountry: "MX",
            },
          },
        ],
    description: job.descriptionHtml || (job.description || "").replace(/\n/g, "<br/>"),
    datePosted: job.createdAt?.toISOString?.() ?? new Date().toISOString(),
    employmentType: job.employmentType,
    identifier: {
      "@type": "PropertyValue",
      name: job.company?.name ?? "Confidencial",
      value: job.id,
    },
  };

  return (
    <main className="max-w-[1100px] xl:max-w-[1200px] mx-auto px-6 lg:px-10 py-8 space-y-6">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ✅ Badge / bloque de evaluación requerida */}
      {requiredAssessment && (
        <AssessmentRequirement
          assessment={requiredAssessment as any}
          userAttempt={userAttempt as any}
        />
      )}

      <JobDetailPanel
        job={panelJob as any}
        canApply={isCandidate}
        editHref={canEdit ? `/dashboard/jobs/${job.id}/edit` : undefined}
      />
    </main>
  );
}
