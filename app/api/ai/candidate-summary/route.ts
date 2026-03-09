// app/api/ai/candidate-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import {
  generateCandidateSummary,
  type CandidateSummaryInput,
} from "@/lib/ai/candidateSummary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional",
  CONVERSATIONAL: "Conversacional",
  BASIC: "Básico",
};

const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "Básico",
  2: "Junior",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
  LEAD: "Lead",
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function buildCacheKey(candidateId: string, jobId: string | null) {
  return `candidate:${candidateId}:job:${jobId ?? "general"}`;
}

async function buildSummaryInput(
  candidateId: string,
  jobId: string | null,
  companyId: string | null
): Promise<CandidateSummaryInput | null> {
  const candidate = await prisma.user.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      name: true,
      location: true,
      seniority: true,
      yearsExperience: true,
      certifications: true,
      candidateSkills: {
        select: {
          level: true,
          term: { select: { label: true } },
        },
        orderBy: [{ level: "desc" }, { term: { label: "asc" } }],
      },
      candidateLanguages: {
        select: {
          level: true,
          term: { select: { label: true } },
        },
      },
      experiences: {
        orderBy: { startDate: "desc" },
        take: 5,
        select: {
          role: true,
          company: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
        },
      },
    },
  });

  if (!candidate) return null;

  const skills = candidate.candidateSkills
    .filter((s) => s.term?.label)
    .map((s) => {
      const levelLabel = s.level != null ? SKILL_LEVEL_LABEL[s.level] : null;
      return levelLabel ? `${s.term.label} (${levelLabel})` : s.term.label;
    });

  const languages = candidate.candidateLanguages
    .filter((l) => l.term?.label)
    .map((l) => {
      const levelLabel = LEVEL_LABEL[l.level ?? ""] ?? l.level ?? "";
      return levelLabel ? `${l.term.label} · ${levelLabel}` : l.term.label;
    });

  const experienceTitles = (candidate.experiences ?? []).map((e) => {
    const start = e.startDate
      ? new Date(e.startDate).toLocaleDateString("es-MX", {
          month: "short",
          year: "numeric",
        })
      : "";
    const end = e.isCurrent
      ? "actualidad"
      : e.endDate
      ? new Date(e.endDate).toLocaleDateString("es-MX", {
          month: "short",
          year: "numeric",
        })
      : "";
    const period = start && end ? ` (${start}–${end})` : "";
    const company = e.company ? ` @ ${e.company}` : "";
    return `${e.role ?? ""}${company}${period}`.trim();
  });

  const input: CandidateSummaryInput = {
    name: candidate.name ?? "Candidato",
    seniority: candidate.seniority
      ? (SENIORITY_LABEL[candidate.seniority as string] ??
          (candidate.seniority as string))
      : null,
    yearsExperience: candidate.yearsExperience,
    location: candidate.location,
    skills,
    languages,
    experienceTitles,
    certifications: (candidate.certifications as string[] | null) ?? [],
  };

  if (jobId && companyId) {
    const jobRaw = await prisma.job.findFirst({
      where: { id: jobId, companyId },
      select: {
        title: true,
        seniority: true,
        minYearsExperience: true,
        requiredSkills: {
          select: {
            must: true,
            term: { select: { label: true } },
          },
        },
      },
    });

    if (jobRaw) {
      const jobSkillLabels = jobRaw.requiredSkills.map((rs) => rs.term.label);
      const candidateSkillLabels = new Set(
        candidate.candidateSkills.map((cs) => cs.term.label.toLowerCase())
      );

      const missingRequired = jobRaw.requiredSkills
        .filter(
          (rs) =>
            rs.must && !candidateSkillLabels.has(rs.term.label.toLowerCase())
        )
        .map((rs) => rs.term.label);

      const missingNice = jobRaw.requiredSkills
        .filter(
          (rs) =>
            !rs.must && !candidateSkillLabels.has(rs.term.label.toLowerCase())
        )
        .map((rs) => rs.term.label);

      input.job = {
        title: jobRaw.title,
        seniority: jobRaw.seniority
          ? (SENIORITY_LABEL[jobRaw.seniority as string] ??
              (jobRaw.seniority as string))
          : null,
        minYearsExperience: jobRaw.minYearsExperience,
        requiredSkills: jobSkillLabels,
        missingRequired,
        missingNice,
      };
    }
  }

  return input;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) return noStoreJson({ error: "Forbidden" }, 403);

  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get("candidateId");
  const jobId = searchParams.get("jobId") || null;
  const force = searchParams.get("force") === "1";

  if (!candidateId) {
    return noStoreJson({ error: "candidateId requerido" }, 400);
  }

  const cacheKey = buildCacheKey(candidateId, jobId);

  if (!force) {
    const cached = await prisma.candidateSummaryCache.findUnique({
      where: { cacheKey },
    });

    if (cached) {
      try {
        const summary = JSON.parse(cached.summaryJson);
        return noStoreJson({
          summary,
          fromCache: true,
          generatedAt: cached.generatedAt,
        });
      } catch {
        // regenerar
      }
    }
  }

  const input = await buildSummaryInput(candidateId, jobId, companyId);
  if (!input) return noStoreJson({ error: "Candidato no encontrado" }, 404);

  const summary = await generateCandidateSummary(input);

  await prisma.candidateSummaryCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      candidateId,
      jobId,
      summaryJson: JSON.stringify(summary),
    },
    update: {
      summaryJson: JSON.stringify(summary),
      generatedAt: new Date(),
    },
  });

  return noStoreJson({
    summary,
    fromCache: false,
    generatedAt: summary.generatedAt,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) return noStoreJson({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => null);
  const candidateId = body?.candidateId as string | undefined;
  const jobId = (body?.jobId as string | undefined) ?? null;

  if (!candidateId) {
    return noStoreJson({ error: "candidateId requerido" }, 400);
  }

  const input = await buildSummaryInput(candidateId, jobId, companyId);
  if (!input) return noStoreJson({ error: "Candidato no encontrado" }, 404);

  const summary = await generateCandidateSummary(input);
  const cacheKey = buildCacheKey(candidateId, jobId);

  await prisma.candidateSummaryCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      candidateId,
      jobId,
      summaryJson: JSON.stringify(summary),
    },
    update: {
      summaryJson: JSON.stringify(summary),
      generatedAt: new Date(),
    },
  });

  return noStoreJson({
    summary,
    fromCache: false,
    generatedAt: summary.generatedAt,
  });
}