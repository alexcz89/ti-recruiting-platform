// app/jobs/[id]/page.tsx
import { prisma } from "@/lib/server/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";
import JobDetailPanel from "@/components/jobs/JobDetailPanel";
import AssessmentRequirement from "./AssessmentRequirement";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: { id: string } };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";
const SITE_NAME = "TaskIO";

/* ─── Helpers ─── */
function excerpt(text: string | null | undefined, max = 160) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function stripHtml(html: string | null | undefined) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function labelEmploymentType(type: string | null | undefined) {
  switch (type) {
    case "FULL_TIME":
      return "Tiempo completo";
    case "PART_TIME":
      return "Medio tiempo";
    case "CONTRACT":
      return "Por periodo";
    case "INTERNSHIP":
      return "Prácticas profesionales";
    default:
      return null;
  }
}

function buildDescription(job: {
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  city?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  company?: { name?: string | null } | null;
}): string {
  const parts: string[] = [];
  if (job.company?.name) parts.push(job.company.name);
  if (job.city) parts.push(job.city);
  const empLabel = labelEmploymentType(job.employmentType);
  if (empLabel) parts.push(empLabel);
  if (job.salaryMin || job.salaryMax) {
    const currency = job.currency ?? "MXN";
    const fmt = (n: number) =>
      new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
    if (job.salaryMin && job.salaryMax) {
      parts.push(`${currency} ${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`);
    } else if (job.salaryMin) {
      parts.push(`Desde ${currency} ${fmt(job.salaryMin)}`);
    } else if (job.salaryMax) {
      parts.push(`Hasta ${currency} ${fmt(job.salaryMax)}`);
    }
  }
  const header = parts.join(" · ");
  const rawDesc = job.description || stripHtml(job.descriptionHtml || "");
  const desc = excerpt(rawDesc, 120);
  return header && desc
    ? `${header} — ${desc}`
    : header || desc || `Vacante: ${job.title}`;
}

/* ─── Metadata ─── */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      descriptionHtml: true,
      city: true,
      employmentType: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      updatedAt: true,
      company: { select: { name: true } },
    },
  });

  if (!job) return {};

  const companyName = job.company?.name ?? null;
  const title = companyName ? `${job.title} — ${companyName}` : job.title;

  const description = buildDescription(job);
  const url = `${APP_URL}/jobs/${job.id}`;
  const ogImage = `${APP_URL}/api/og/job?jobId=${job.id}&v=${job.updatedAt.getTime()}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "es_MX",
      type: "website",
      images: [{ url: ogImage, width: 630, height: 630, alt: title }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [ogImage],
    },
  };
}

/* ─── Page ─── */
export default async function JobDetail({ params }: Params) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // scraper o error de sesión → continúa como usuario anónimo
  }

  const user = (session?.user as any) || null;
  const role =
    (user?.role as "CANDIDATE" | "RECRUITER" | "ADMIN" | undefined) ?? undefined;

  const isCandidate = role === "CANDIDATE";
  const isRecruiterOrAdmin = role === "RECRUITER" || role === "ADMIN";

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      location: true,
      city: true,
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
      assessments: {
        where: { isRequired: true },
        orderBy: { createdAt: "asc" },
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

  let canEdit = false;
  if (isRecruiterOrAdmin) {
    const myCompanyId = await getSessionCompanyId().catch(() => null);
    canEdit = !!myCompanyId && job.companyId === myCompanyId;
  }

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
          select: { id: true, status: true, totalScore: true, passed: true },
        })
      : null;

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
    description:
      job.descriptionHtml || (job.description || "").replace(/\n/g, "<br/>"),
    datePosted: job.createdAt?.toISOString?.() ?? new Date().toISOString(),
    employmentType: job.employmentType,
    identifier: {
      "@type": "PropertyValue",
      name: job.company?.name ?? "Confidencial",
      value: job.id,
    },
  };

  // ✅ CLAVE:
  // - Candidato: puede postular
  // - Anónimo: puede ver botón (al click lo mandará a login por 401)
  // - Recruiter/Admin: NO (verán Editar si aplica)
  const canApply = !isRecruiterOrAdmin;

  return (
    <main className="max-w-[1100px] xl:max-w-[1200px] mx-auto px-6 lg:px-10 py-8 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {requiredAssessment && (
        <AssessmentRequirement
          assessment={requiredAssessment as any}
          userAttempt={userAttempt as any}
        />
      )}

      <JobDetailPanel
        job={panelJob as any}
        canApply={canApply}
        editHref={canEdit ? `/dashboard/jobs/${job.id}/edit` : undefined}
      />
    </main>
  );
}