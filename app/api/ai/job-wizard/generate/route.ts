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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return noStoreJson({ error: "Unauthorized" }, 401);

  const companyId = await getSessionCompanyId().catch(() => null);
  if (!companyId) return noStoreJson({ error: "Forbidden" }, 403);

  const body = (await req.json().catch(() => null)) as JobWizardAIInput | null;

  if (!body?.title || String(body.title).trim().length < 3) {
    return noStoreJson(
      { error: "El título de la vacante es requerido para generar contenido con AI." },
      400
    );
  }

  const draft = await generateJobWizardDraft({
    title: String(body.title || "").trim(),
    companyMode: body.companyMode,
    locationType: body.locationType,
    city: body.city,
    country: body.country,
    currency: body.currency,
    salaryMin: body.salaryMin ?? null,
    salaryMax: body.salaryMax ?? null,
    employmentType: body.employmentType,
    schedule: body.schedule,
    benefits: Array.isArray(body.benefits) ? body.benefits : [],
    assessmentSelected: !!body.assessmentSelected,
    currentDescriptionPlain: body.currentDescriptionPlain,
    currentRequiredSkills: Array.isArray(body.currentRequiredSkills)
      ? body.currentRequiredSkills
      : [],
    currentNiceSkills: Array.isArray(body.currentNiceSkills)
      ? body.currentNiceSkills
      : [],
    currentEduRequired: Array.isArray(body.currentEduRequired)
      ? body.currentEduRequired
      : [],
    currentEduNice: Array.isArray(body.currentEduNice) ? body.currentEduNice : [],
    currentCerts: Array.isArray(body.currentCerts) ? body.currentCerts : [],
    currentLanguages: Array.isArray(body.currentLanguages) ? body.currentLanguages : [],
  });

  return noStoreJson({ draft });
}