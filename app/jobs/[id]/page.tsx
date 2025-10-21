// app/jobs/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionCompanyId } from "@/lib/session";
import JobDetailPanel from "@/components/jobs/JobDetailPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: { id: string } };

// ——— Helper para recortar texto seguro
function excerpt(text: string | null | undefined, max = 160) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// ——— Metadata para SEO/Social
export async function generateMetadata({ params }: Params) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      company: { select: { name: true } },
      location: true,
    },
  });

  if (!job) return {};

  const title = `${job.title} ${job.company?.name ? "— " + job.company.name : ""}`;
  const description = excerpt(job.description, 160);

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/jobs/${job.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function JobDetail({ params }: Params) {
  // 1) Cargar la vacante
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      location: true,
      employmentType: true,
      remote: true,
      description: true,
      skills: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      companyId: true,
      company: { select: { name: true } },
      status: true,
    },
  });
  if (!job) notFound();
  // Si quieres ocultar no abiertas:
  // if (job.status !== "OPEN") notFound();

  // 2) Sesión y permisos
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as
    | "CANDIDATE"
    | "RECRUITER"
    | "ADMIN"
    | undefined;

  const isCandidate = role === "CANDIDATE";

  // Recruiter/Admin: solo pueden ver si es SU empresa
  let canEdit = false;
  if (role === "RECRUITER" || role === "ADMIN") {
    const myCompanyId = await getSessionCompanyId().catch(() => null);
    if (!myCompanyId || job.companyId !== myCompanyId) {
      notFound();
    }
    canEdit = true;
  }

  // 3) Adaptar shape que consume el panel
  const panelJob = {
    id: job.id,
    title: job.title,
    company: job.company?.name ?? null,
    location: job.location,
    remote: job.remote,
    employmentType: job.employmentType,
    description: job.description,
    skills: job.skills ?? [],
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    currency: job.currency ?? "MXN",
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  // 4) JSON-LD (JobPosting) básico para SEO
  //    Nota: si manejas visibilidad de sueldo vía meta, aquí podrías omitirlo.
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
    description: (job.description || "").replace(/\n/g, "<br/>"),
    datePosted: job.createdAt?.toISOString?.() ?? new Date().toISOString(),
    validThrough: undefined,
    employmentType: job.employmentType,
    identifier: {
      "@type": "PropertyValue",
      name: job.company?.name ?? "Confidencial",
      value: job.id,
    },
    baseSalary:
      job.salaryMin != null || job.salaryMax != null
        ? {
            "@type": "MonetaryAmount",
            currency: job.currency || "MXN",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salaryMin ?? undefined,
              maxValue: job.salaryMax ?? undefined,
              unitText: "MONTH", // ajusta si tu sueldo es mensual, anual, etc.
            },
          }
        : undefined,
  };

  return (
    <main className="max-w-[1100px] xl:max-w-[1200px] mx-auto px-6 lg:px-10 py-8">
      {/* JSON-LD para SEO */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <JobDetailPanel
        job={panelJob as any}
        canApply={isCandidate} // candidatos ven “Postularme”
        editHref={canEdit ? `/dashboard/jobs/${job.id}/edit` : undefined} // recruiters ven “Editar vacante”
      />
    </main>
  );
}
