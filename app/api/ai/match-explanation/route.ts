// app/api/ai/match-explanation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import {
  computeMatchScore,
  type CandidateSkillInput,
  type JobSkillInput,
  type SeniorityLevel,
} from "@/lib/ai/matchScore";
import {
  generateMatchExplanation,
  buildMatchExplanationFingerprint,
  MATCH_EXPLANATION_VERSION,
  type MatchExplanationInput,
} from "@/lib/ai/matchExplanation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
  LEAD: "Lead",
};

const LEVEL_LABEL: Record<string, string> = {
  NATIVE: "Nativo",
  PROFESSIONAL: "Profesional",
  CONVERSATIONAL: "Conversacional",
  BASIC: "Básico",
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function buildCacheKey(candidateId: string, jobId: string) {
  return `${candidateId}:${jobId}`;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toSeniorityLevel(s: string | null | undefined): SeniorityLevel | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "junior" || lower === "mid" || lower === "senior") return lower;
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
    )
  );
}

function formatMonthYear(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
}

async function buildMatchExplanationInput(
  candidateId: string,
  jobId: string,
  companyId: string | null
): Promise<MatchExplanationInput | null> {
  if (!companyId) return null;

  const application = await prisma.application.findFirst({
    where: {
      candidateId,
      jobId,
      job: { companyId },
    },
    select: { id: true },
  });

  if (!application) return null;

  const [candidate, job] = await Promise.all([
    prisma.user.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        name: true,
        location: true,
        seniority: true,
        yearsExperience: true,
        certifications: true,
        aiProfile: {
          select: {
            profileJson: true,
            profileVersion: true,
            sourceFingerprint: true,
            summaryText: true,
            strengthsJson: true,
            risksJson: true,
            tags: true,
            generatedAt: true,
            updatedAt: true,
          }
        },
        candidateSkills: {
          select: {
            level: true,
            term: { select: { id: true, label: true } },
          },
        },
        candidateLanguages: {
          select: {
            level: true,
            term: { select: { label: true } },
          },
        },
        experiences: {
          orderBy: [{ endDate: "desc" }, { startDate: "desc" }],
          take: 6,
          select: {
            role: true,
            company: true,
            startDate: true,
            endDate: true,
            isCurrent: true,
          },
        },
      },
    }),
    prisma.job.findFirst({
      where: {
        id: jobId,
        companyId,
      },
      select: {
        id: true,
        title: true,
        seniority: true,
        minYearsExperience: true,
        requiredSkills: {
          select: {
            must: true,
            weight: true,
            term: { select: { id: true, label: true } },
          },
        },
      },
    }),
  ]);

  if (!candidate || !job) return null;

  const jobSkills: JobSkillInput[] = job.requiredSkills.map((rs) => ({
    termId: rs.term.id,
    label: rs.term.label,
    must: rs.must,
    weight: rs.weight,
  }));

  const candidateSkillsInput: CandidateSkillInput[] = candidate.candidateSkills.map((cs) => ({
    termId: cs.term.id,
    label: cs.term.label,
    level: cs.level,
  }));

  const parsed = candidate.aiProfile?.profileJson;
  const parsedObj =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;

  // Se conservan por si luego quieres reutilizarlos,
  // pero no se envían a MatchExplanationInput porque hoy no forman parte del tipo.
  const _candidateDomains = toStringArray(parsedObj?.domains);
  const _candidateMethods = toStringArray(parsedObj?.methods);
  const _candidateTools = toStringArray(parsedObj?.tools);
  const _candidateImpactEvidence = toStringArray(parsedObj?.impactEvidence);
  const _candidateExperienceHighlights = toStringArray(parsedObj?.experienceHighlights);

  const matchResult = computeMatchScore({
    jobSkills,
    candidateSkills: candidateSkillsInput,
    jobSeniority: toSeniorityLevel(job.seniority),
    candidateSeniority: toSeniorityLevel(candidate.seniority),
    jobMinYearsExperience: job.minYearsExperience ?? null,
    candidateYearsExperience: candidate.yearsExperience ?? null,
  });

  const matchedSkills = (matchResult.details ?? [])
    .filter((d) => d.matched)
    .map((d) => d.label);

  const missingRequired = (matchResult.details ?? [])
    .filter((d) => !d.matched && d.must)
    .map((d) => d.label);

  const missingNice = (matchResult.details ?? [])
    .filter((d) => !d.matched && !d.must)
    .map((d) => d.label);

  const languages = candidate.candidateLanguages.map((l) => {
    const levelLabel =
      l.level != null
        ? LEVEL_LABEL[String(l.level)] ?? String(l.level)
        : null;

    return levelLabel ? `${l.term.label} (${levelLabel})` : l.term.label;
  });

  const experienceTitles = (candidate.experiences ?? []).map((e) => {
    const start = formatMonthYear(e.startDate);
    const end = e.isCurrent ? "actualidad" : formatMonthYear(e.endDate);
    const period = start && end ? ` (${start}–${end})` : "";
    const companyLabel = e.company ? ` @ ${e.company}` : "";
    return `${e.role ?? ""}${companyLabel}${period}`.trim();
  });

  return {
    candidate: {
      name: candidate.name ?? "Candidato",
      seniority: candidate.seniority
        ? SENIORITY_LABEL[candidate.seniority as string] ?? String(candidate.seniority)
        : null,
      yearsExperience: candidate.yearsExperience ?? null,
      location: candidate.location ?? null,
      skills: candidateSkillsInput.map((s) => s.label),
      languages,
      experienceTitles,
      certifications: Array.isArray(candidate.certifications)
        ? (candidate.certifications as string[])
        : [],
    },
    job: {
      title: job.title,
      seniority: job.seniority
        ? SENIORITY_LABEL[job.seniority as string] ?? String(job.seniority)
        : null,
      minYearsExperience: job.minYearsExperience ?? null,
      requiredSkills: job.requiredSkills.map((rs) => rs.term.label),
    },
    match: {
      score: matchResult.score,
      label: matchResult.label,
      skillScore: matchResult.skillScore,
      mustScore: matchResult.mustScore,
      niceScore: matchResult.niceScore,
      matchedCount: matchResult.matchedCount,
      totalRequired: matchResult.totalRequired,
      totalNice: matchResult.totalNice,
      matchedSkills,
      missingRequired,
      missingNice,
      seniorityFit: matchResult.seniorityFit,
      experienceFit: matchResult.experienceFit,
    },
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) return noStoreJson({ error: "Forbidden" }, 403);

  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get("candidateId");
  const jobId = searchParams.get("jobId");
  const force = searchParams.get("force") === "1";

  if (!candidateId || !jobId) {
    return noStoreJson({ error: "candidateId y jobId son requeridos" }, 400);
  }

  const cacheKey = buildCacheKey(candidateId, jobId);

  if (!force) {
    const cached = await prisma.matchExplanationCache.findFirst({
      where: { cacheKey },
    });

    if (cached) {
      const input = await buildMatchExplanationInput(candidateId, jobId, companyId);

      if (input) {
        const currentFingerprint = buildMatchExplanationFingerprint(input);

        if (
          cached.fingerprint === currentFingerprint &&
          cached.version === MATCH_EXPLANATION_VERSION
        ) {
          return noStoreJson({
            explanation: cached.explanationJson,
            fromCache: true,
            generatedAt: cached.generatedAt,
          });
        }

        const explanation = await generateMatchExplanation(input);
        const explanationJson = toPrismaJson(explanation);

        await prisma.matchExplanationCache.update({
          where: { id: cached.id },
          data: {
            explanationJson,
            fingerprint: currentFingerprint,
            version: MATCH_EXPLANATION_VERSION,
            generatedAt: new Date(),
          },
        });

        return noStoreJson({
          explanation,
          fromCache: false,
          generatedAt: explanation.generatedAt,
        });
      }
    }
  }

  const input = await buildMatchExplanationInput(candidateId, jobId, companyId);
  if (!input) {
    return noStoreJson({ error: "Candidato o vacante no encontrado" }, 404);
  }

  const explanation = await generateMatchExplanation(input);
  const explanationJson = toPrismaJson(explanation);
  const fingerprint = buildMatchExplanationFingerprint(input);

  const existingCache = await prisma.matchExplanationCache.findFirst({
    where: { cacheKey },
    select: { id: true },
  });

  if (existingCache) {
    await prisma.matchExplanationCache.update({
      where: { id: existingCache.id },
      data: {
        explanationJson,
        fingerprint,
        version: MATCH_EXPLANATION_VERSION,
        generatedAt: new Date(),
      },
    });
  } else {
    await prisma.matchExplanationCache.create({
      data: {
        cacheKey,
        candidateId,
        jobId,
        fingerprint,
        version: MATCH_EXPLANATION_VERSION,
        explanationJson,
      },
    });
  }

  return noStoreJson({
    explanation,
    fromCache: false,
    generatedAt: explanation.generatedAt,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) return noStoreJson({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => null);
  const candidateId = body?.candidateId as string | undefined;
  const jobId = body?.jobId as string | undefined;

  if (!candidateId || !jobId) {
    return noStoreJson({ error: "candidateId y jobId son requeridos" }, 400);
  }

  const input = await buildMatchExplanationInput(candidateId, jobId, companyId);
  if (!input) {
    return noStoreJson({ error: "Candidato o vacante no encontrado" }, 404);
  }

  const explanation = await generateMatchExplanation(input);
  const explanationJson = toPrismaJson(explanation);
  const fingerprint = buildMatchExplanationFingerprint(input);
  const cacheKey = buildCacheKey(candidateId, jobId);

  const existingCache = await prisma.matchExplanationCache.findFirst({
    where: { cacheKey },
    select: { id: true },
  });

  if (existingCache) {
    await prisma.matchExplanationCache.update({
      where: { id: existingCache.id },
      data: {
        explanationJson,
        fingerprint,
        version: MATCH_EXPLANATION_VERSION,
        generatedAt: new Date(),
      },
    });
  } else {
    await prisma.matchExplanationCache.create({
      data: {
        cacheKey,
        candidateId,
        jobId,
        fingerprint,
        version: MATCH_EXPLANATION_VERSION,
        explanationJson,
      },
    });
  }

  return noStoreJson({
    explanation,
    fromCache: false,
    generatedAt: explanation.generatedAt,
  });
}