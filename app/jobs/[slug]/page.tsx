// app/jobs/[slug]/page.tsx
// ✅ Rename dynamic import to avoid conflict with export const dynamic
import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { prisma } from "@/lib/server/prisma";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";
import JobDetailPanel from "@/components/jobs/JobDetailPanel";
import {
  buildCandidateSkillInputs,
  buildJobSkillInputs,
  computeMatchScore,
  hasMatchSignals,
  type JobSkillInput,
  type SeniorityLevel,
} from "@/lib/ai/matchScore";
import type { Metadata } from "next";
import {
  generateJobKeywords,
  generateJobMetaDescription,
  generateJobTitle,
  getCanonicalUrl,
} from "@/lib/seo/keywords";
import { generateJobPostingSchema, generateBreadcrumbSchema } from "@/lib/seo/schema";

// ✅ Lazy load components below-fold for better FCP/LCP
const CandidateMatchCard = dynamicImport(
  () => import("@/components/jobs/CandidateMatchCard"),
  {
    loading: () => (
      <div className="h-32 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 animate-pulse rounded-lg" />
    ),
    ssr: true, // Keep SSR for candidate-specific data
  }
);

const Footer = dynamicImport(() => import("@/components/Footer"), {
  loading: () => null, // Footer doesn't need a skeleton
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ⚠️ El param se llama "slug" pero puede llegar un ID antiguo (cuid)
// → detectamos y hacemos redirect 301 al slug real
type Params = { params: { slug: string } };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";
const SITE_NAME = "TaskIO";

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
    case "FULL_TIME": return "Tiempo completo";
    case "PART_TIME": return "Medio tiempo";
    case "CONTRACT": return "Por periodo";
    case "INTERNSHIP": return "Prácticas profesionales";
    default: return null;
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

  return header && desc ? `${header} — ${desc}` : header || desc || `Vacante: ${job.title}`;
}

/**
 * Busca el job por slug primero, luego por ID (para backward compat).
 * Si encuentra por ID y tiene slug → redirect 301 al slug.
 */
async function findJob(slugOrId: string) {
  // 1. Buscar por slug
  const bySlug = await prisma.job.findUnique({
    where: { slug: slugOrId },
    select: { id: true, slug: true },
  });
  if (bySlug) return { job: bySlug, shouldRedirect: false };

  // 2. Buscar por ID (URLs antiguas)
  const byId = await prisma.job.findUnique({
    where: { id: slugOrId },
    select: { id: true, slug: true },
  });
  if (!byId) return { job: null, shouldRedirect: false };

  // Si tiene slug → redirect 301
  if (byId.slug) return { job: byId, shouldRedirect: true };

  // Si no tiene slug aún → servir por ID sin redirect
  return { job: byId, shouldRedirect: false };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { job: found } = await findJob(params.slug);
  if (!found) return {};

  const job = await prisma.job.findUnique({
    where: { id: found.id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      descriptionHtml: true,
      city: true,
      admin1: true,
      employmentType: true,
      salaryMin: true,
      salaryMax: true,
      showSalary: true,
      currency: true,
      updatedAt: true,
      createdAt: true,
      remote: true,
      skills: true,
      seniority: true,
      company: { select: { name: true } },
    },
  });

  if (!job) return {};

  // ✅ Use SEO-optimized functions
  const title = generateJobTitle(job);
  const description = generateJobMetaDescription(job);
  const keywords = generateJobKeywords(job);

  // ✅ Canonical apunta siempre al slug (o al ID si no tiene slug aún)
  const canonicalPath = job.slug ?? job.id;
  const url = getCanonicalUrl(`/jobs/${canonicalPath}`);
  const ogImage = `${APP_URL}/api/og/job?jobId=${job.id}&v=${job.updatedAt.getTime()}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "es_MX",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: job.title,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      creator: "@taskio_mx",
      site: "@taskio_mx",
    },
  };
}

function toSeniorityLevel(s: string | null | undefined): SeniorityLevel | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "junior" || lower === "mid" || lower === "senior") return lower;
  return null;
}

export default async function JobDetail({ params }: Params) {
  // ✅ Redirect 301 de IDs viejos → slug nuevo
  const { job: found, shouldRedirect } = await findJob(params.slug);

  if (!found) notFound();
  if (shouldRedirect && found!.slug) {
    redirect(`/jobs/${found!.slug}`); // Next.js redirect es 307 por default en RSC; usar permanentRedirect para 308
  }

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
    where: { id: found!.id },
    select: {
      id: true,
      slug: true,
      title: true,
      location: true,
      city: true,
      employmentType: true,
      remote: true,
      description: true,
      descriptionHtml: true,
      skills: true,
      seniority: true,
      minYearsExperience: true,
      requiredSkills: {
        select: {
          must: true,
          weight: true,
          term: { select: { id: true, label: true, aliases: true } },
        },
      },
      salaryMin: true,
      salaryMax: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
      status: true,
    },
  });

  if (!job) notFound();

  let canEdit = false;
  if (isRecruiterOrAdmin) {
    const myCompanyId = await getSessionCompanyId().catch(() => null);
    canEdit = !!myCompanyId && job.companyId === myCompanyId;
  }

  const jobSkillsForEngine: JobSkillInput[] = buildJobSkillInputs(
    job.requiredSkills,
    job.skills
  );

  const jobSeniorityForEngine = toSeniorityLevel(job.seniority);

  const hasJobMatchSignals = hasMatchSignals({
    jobSkills: jobSkillsForEngine,
    jobSeniority: jobSeniorityForEngine,
    jobMinYearsExperience: job.minYearsExperience ?? null,
  });

  let candidateMatchResult = null;

  if (isCandidate && user?.id) {
    const candidateRaw = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        seniority: true,
        yearsExperience: true,
        candidateSkills: {
          select: {
            level: true,
            term: { select: { id: true, label: true, aliases: true } },
          },
        },
      },
    });

    if (candidateRaw && hasJobMatchSignals) {
      const candidateSkillsForEngine = buildCandidateSkillInputs(
        candidateRaw.candidateSkills
      );

      candidateMatchResult = computeMatchScore({
        jobSkills: jobSkillsForEngine,
        candidateSkills: candidateSkillsForEngine,
        jobSeniority: jobSeniorityForEngine,
        candidateSeniority: toSeniorityLevel(candidateRaw.seniority as string | null),
        jobMinYearsExperience: job.minYearsExperience ?? null,
        candidateYearsExperience: candidateRaw.yearsExperience ?? null,
      });
    }
  }

  let alreadyApplied = false;
  let applicationHref: string | undefined = undefined;

  if (isCandidate && user?.id) {
    const existingApplication = await prisma.application.findFirst({
      where: { candidateId: user.id, jobId: job.id },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (existingApplication) {
      alreadyApplied = true;
      applicationHref = "/jobs?applied=1";
    }
  }

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

  // ✅ Schema.org JobPosting optimizado para Google for Jobs
  const canonicalPath = job.slug ?? job.id;
  const jobUrl = `${APP_URL}/jobs/${canonicalPath}`;

  // Calcular fecha de expiración (30 días desde creación)
  const datePosted = job.createdAt ?? new Date();
  const validThrough = new Date(datePosted);
  validThrough.setDate(validThrough.getDate() + 30);

  // Construir jobLocation array
  const jobLocationArray = [];
  if (job.remote) {
    // Remote jobs también pueden tener una ubicación base
    if (job.city) {
      jobLocationArray.push({
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: job.city,
          addressCountry: "MX",
        },
      });
    }
  } else if (job.city) {
    jobLocationArray.push({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressCountry: "MX",
      },
    });
  }

  // ✅ Rich Snippets: Skills requeridos (Schema.org)
  const skillsArray = job.requiredSkills
    .filter((s) => s.term)
    .slice(0, 10) // Máximo 10 skills para no saturar
    .map((s) => s.term.label);

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: stripHtml(job.descriptionHtml || job.description || ""),
    url: jobUrl,
    datePosted: datePosted.toISOString(),
    validThrough: validThrough.toISOString(),
    employmentType: job.employmentType || "FULL_TIME",

    hiringOrganization: {
      "@type": "Organization",
      name: job.company?.name ?? "Empresa confidencial",
      sameAs: `${APP_URL}`,
      // ✅ Logo de la empresa (importante para Rich Snippets)
      ...(job.company?.logoUrl && {
        logo: job.company.logoUrl,
      }),
    },

    jobLocationType: job.remote ? "TELECOMMUTE" : "ONSITE",

    // ✅ Ubicaciones del trabajo
    ...(jobLocationArray.length > 0 && {
      jobLocation: jobLocationArray,
    }),

    // ✅ Salario (importante para Google for Jobs)
    ...(job.salaryMin || job.salaryMax) && {
      baseSalary: {
        "@type": "PriceSpecification",
        currency: job.currency || "MXN",
        ...(job.salaryMin && { minValue: job.salaryMin }),
        ...(job.salaryMax && { maxValue: job.salaryMax }),
      },
    },

    // ✅ Skills requeridos (Rich Snippets)
    ...(skillsArray.length > 0 && {
      skills: skillsArray,
    }),

    // ✅ Experience level (Junior, Mid, Senior)
    ...(job.seniority && {
      experienceRequirements: {
        "@type": "OccupationalExperienceRequirements",
        monthsOfExperience: (job.minYearsExperience ?? 0) * 12,
      },
    }),

    // ✅ ID único del job posting
    identifier: {
      "@type": "PropertyValue",
      name: "TaskIO Job ID",
      value: job.id,
    },
  };

  const canApply = !isRecruiterOrAdmin;
  const hasJobSignalsForAnon = hasJobMatchSignals;

  // ✅ Breadcrumb Schema para navegación estructurada
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: APP_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Vacantes",
        item: `${APP_URL}/jobs`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: job.title,
        item: jobUrl,
      },
    ],
  };

  return (
    <>
      <main className="mx-auto max-w-[1100px] space-y-6 px-6 py-8 lg:px-10 xl:max-w-[1200px]">
        {/* ✅ JobPosting Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* ✅ Breadcrumb Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />

        {/* ✅ Lazy load CandidateMatchCard only if needed */}
        {isCandidate && candidateMatchResult && (
          <Suspense
            fallback={
              <div className="h-32 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 animate-pulse rounded-lg" />
            }
          >
            <CandidateMatchCard matchResult={candidateMatchResult} jobId={job.id} />
          </Suspense>
        )}

        <JobDetailPanel
          job={panelJob as any}
          canApply={canApply}
          isAuthed={Boolean(session)}
          role={role}
          editHref={canEdit ? `/dashboard/jobs/${job.id}/edit` : undefined}
          alreadyApplied={alreadyApplied}
          applicationHref={applicationHref}
        />
      </main>
      {/* ✅ Lazy load Footer (below-fold) */}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
