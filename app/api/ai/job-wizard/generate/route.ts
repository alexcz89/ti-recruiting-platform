// app/api/ai/job-wizard/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";
import { generateJobWizardDraft, type JobWizardAIInput } from "@/lib/ai/jobWizard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value: unknown) {
  const v = cleanString(value);
  return v || undefined;
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of value) {
    const clean = cleanString(item);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }

  return out;
}

function cleanNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function cleanLanguages(value: unknown): JobWizardAIInput["currentLanguages"] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: NonNullable<JobWizardAIInput["currentLanguages"]> = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const name = cleanString((item as { name?: unknown }).name);
    const level = (item as { level?: unknown }).level;

    if (!name) continue;
    if (
      level !== "NATIVE" &&
      level !== "PROFESSIONAL" &&
      level !== "CONVERSATIONAL" &&
      level !== "BASIC"
    ) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, level });
  }

  return out;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) return noStoreJson({ error: "Forbidden" }, 403);

  const body = (await req.json().catch(() => null)) as JobWizardAIInput | null;

  const title = cleanString(body?.title);
  if (!title || title.length < 3) {
    return noStoreJson(
      { error: "El título de la vacante es requerido para generar contenido con AI." },
      400
    );
  }

  const draft = await generateJobWizardDraft({
    mode:
      body?.mode === "generate-all" ||
      body?.mode === "improve-description" ||
      body?.mode === "extract-structure"
        ? body.mode
        : "generate-all",
    title,
    companyMode:
      body?.companyMode === "own" || body?.companyMode === "confidential"
        ? body.companyMode
        : undefined,
    locationType:
      body?.locationType === "REMOTE" ||
      body?.locationType === "HYBRID" ||
      body?.locationType === "ONSITE"
        ? body.locationType
        : undefined,
    city: cleanOptionalString(body?.city),
    country: cleanOptionalString(body?.country),
    currency: body?.currency === "USD" ? "USD" : "MXN",
    salaryMin: cleanNumberOrNull(body?.salaryMin),
    salaryMax: cleanNumberOrNull(body?.salaryMax),
    employmentType:
      body?.employmentType === "FULL_TIME" ||
      body?.employmentType === "PART_TIME" ||
      body?.employmentType === "CONTRACT" ||
      body?.employmentType === "INTERNSHIP"
        ? body.employmentType
        : undefined,
    schedule: cleanOptionalString(body?.schedule),
    benefits: cleanStringArray(body?.benefits),
    assessmentSelected: !!body?.assessmentSelected,
    currentDescriptionPlain: cleanOptionalString(body?.currentDescriptionPlain),
    currentRequiredSkills: cleanStringArray(body?.currentRequiredSkills),
    currentNiceSkills: cleanStringArray(body?.currentNiceSkills),
    currentEduRequired: cleanStringArray(body?.currentEduRequired),
    currentEduNice: cleanStringArray(body?.currentEduNice),
    currentCerts: cleanStringArray(body?.currentCerts),
    currentMinDegree:
      body?.currentMinDegree === "HIGHSCHOOL" ||
      body?.currentMinDegree === "TECH" ||
      body?.currentMinDegree === "BACHELOR" ||
      body?.currentMinDegree === "MASTER" ||
      body?.currentMinDegree === "PHD"
        ? body.currentMinDegree
        : null,
    currentLanguages: cleanLanguages(body?.currentLanguages),
  });

  return noStoreJson({ draft });
}