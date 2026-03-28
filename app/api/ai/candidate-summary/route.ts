// app/api/ai/candidate-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import {
  generateCandidateSummary,
  buildFingerprint,
  SUMMARY_VERSION,
  type CandidateSummaryInput,
} from "@/lib/ai/candidateSummary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function buildCacheKey(candidateId: string, jobId: string | null) {
  return `${candidateId}:${jobId ?? "general"}`;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.map((v) => String(v ?? "").trim()).filter(Boolean)
    )
  );
}

/**
 * 🔥 NORMALIZA AI PROFILE → MISMO SHAPE QUE EL SISTEMA ESPERA
 */
function mapAiProfileToSummary(aiProfile: any) {
  return {
    headline: "Resumen AI del candidato",
    summary: aiProfile.summaryText ?? "",
    strengths: toStringArray(aiProfile.strengthsJson),
    risks: toStringArray(aiProfile.risksJson),
    suggestedQuestions: [],
    jobFitNotes: undefined,
    missingSkillsNote: undefined,
    tags: Array.isArray(aiProfile.tags) ? aiProfile.tags : [],
    generatedAt: new Date(aiProfile.updatedAt).toISOString(),
    source: "aiProfile",
  };
}

function buildAiFingerprint(aiProfile: any, candidateId: string, jobId: string | null) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: SUMMARY_VERSION,
        candidateId,
        jobId,
        sourceFingerprint: aiProfile.sourceFingerprint,
        updatedAt: aiProfile.updatedAt,
      })
    )
    .digest("hex")
    .slice(0, 32);
}

async function saveCache(
  candidateId: string,
  jobId: string | null,
  summary: unknown,
  fingerprint: string
) {
  const cacheKey = buildCacheKey(candidateId, jobId);

  await prisma.candidateSummaryCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      candidateId,
      jobId,
      fingerprint,
      summaryVersion: SUMMARY_VERSION,
      summaryJson: toPrismaJson(summary),
    },
    update: {
      summaryJson: toPrismaJson(summary),
      fingerprint,
      summaryVersion: SUMMARY_VERSION,
      generatedAt: new Date(),
    },
  });
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
      return noStoreJson({
        summary: cached.summaryJson,
        fromCache: true,
        generatedAt: cached.generatedAt,
      });
    }
  }

  // 🔥 PRIORIDAD: AI PROFILE
  const candidate = await prisma.user.findUnique({
    where: { id: candidateId },
    select: {
      aiProfile: {
        select: {
          summaryText: true,
          strengthsJson: true,
          risksJson: true,
          tags: true,
          sourceFingerprint: true,
          updatedAt: true,
        },
      },
    },
  });

  if (candidate?.aiProfile?.summaryText) {
    const summary = mapAiProfileToSummary(candidate.aiProfile);
    const fingerprint = buildAiFingerprint(
      candidate.aiProfile,
      candidateId,
      jobId
    );

    await saveCache(candidateId, jobId, summary, fingerprint);

    return noStoreJson({
      summary,
      fromCache: false,
      generatedAt: summary.generatedAt,
    });
  }

  // 🧠 FALLBACK: GENERACIÓN TRADICIONAL
  const input = await generateFallbackInput(candidateId, jobId, companyId);

  if (!input) {
    return noStoreJson({ error: "Candidato no encontrado" }, 404);
  }

  const summary = await generateCandidateSummary(input);
  const fingerprint = buildFingerprint(input);

  await saveCache(candidateId, jobId, summary, fingerprint);

  return noStoreJson({
    summary,
    fromCache: false,
    generatedAt: summary.generatedAt,
  });
}

async function generateFallbackInput(
  candidateId: string,
  jobId: string | null,
  companyId: string | null
): Promise<CandidateSummaryInput | null> {
  const candidate = await prisma.user.findUnique({
    where: { id: candidateId },
    select: {
      name: true,
      location: true,
      seniority: true,
      yearsExperience: true,
      certifications: true,
      candidateSkills: {
        select: {
          term: { select: { label: true } },
        },
      },
    },
  });

  if (!candidate) return null;

  return {
    name: candidate.name ?? "Candidato",
    seniority: candidate.seniority ?? null,
    yearsExperience: candidate.yearsExperience ?? null,
    location: candidate.location ?? null,
    skills: candidate.candidateSkills.map((s) => s.term.label),
    languages: [],
    experienceTitles: [],
    certifications: Array.isArray(candidate.certifications)
      ? (candidate.certifications as string[])
      : [],
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const candidateId = body?.candidateId;

  if (!candidateId) {
    return noStoreJson({ error: "candidateId requerido" }, 400);
  }

  const url = new URL(req.url);
  url.searchParams.set("candidateId", candidateId);
  url.searchParams.set("force", "1");

  return GET(new NextRequest(url));
}