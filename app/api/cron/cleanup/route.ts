// app/api/cron/cleanup/route.ts
// Limpia entradas viejas de CvParseCache y CandidateSummaryCache
// Llamado por Vercel Cron (vercel.json) — protegido con CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CV_CACHE_MAX_DAYS        = 45; // días de vida de CvParseCache
const SUMMARY_CACHE_MAX_DAYS   = 60; // días de vida de CandidateSummaryCache
const CV_PARSER_CURRENT_VERSION = "cv-v4"; // debe coincidir con CACHE_VERSION en analyzeCv.ts

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
    ?? new URL(req.url).searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const cvCutoff = new Date(now);
  cvCutoff.setDate(cvCutoff.getDate() - CV_CACHE_MAX_DAYS);

  const summaryCutoff = new Date(now);
  summaryCutoff.setDate(summaryCutoff.getDate() - SUMMARY_CACHE_MAX_DAYS);

  // 1. CvParseCache: viejas O versión obsoleta
  const cvDeleted = await prisma.cvParseCache.deleteMany({
    where: {
      OR: [
        { updatedAt: { lt: cvCutoff } },
        { parserVersion: { not: CV_PARSER_CURRENT_VERSION } },
      ],
    },
  });

  // 2. CandidateSummaryCache: solo por antigüedad
  const summaryDeleted = await prisma.candidateSummaryCache.deleteMany({
    where: {
      generatedAt: { lt: summaryCutoff },
    },
  });

  // Log estructurado — legible en Vercel logs
  console.log("[cron] cleanup executed", {
    cvDeleted:      cvDeleted.count,
    summaryDeleted: summaryDeleted.count,
    cvCutoff,
    summaryCutoff,
  });

  return NextResponse.json({
    ok: true,
    cvCacheDeleted:      cvDeleted.count,
    summaryCacheDeleted: summaryDeleted.count,
    cvCutoff:            cvCutoff.toISOString(),
    summaryCutoff:       summaryCutoff.toISOString(),
  });
}