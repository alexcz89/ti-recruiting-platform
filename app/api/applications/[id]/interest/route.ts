// app/api/applications/[id]/interest/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";

type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";
const ALLOWED: InterestKey[] = ["REVIEW", "MAYBE", "ACCEPTED", "REJECTED"];

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId) {
      return jsonNoStore({ error: "Unauthorized" }, 401);
    }

    let body: { recruiterInterest?: unknown } | null = null;
    try {
      body = await req.json();
    } catch {
      return jsonNoStore({ error: "Cuerpo inválido (JSON requerido)" }, 400);
    }

    const rawNext =
      typeof body?.recruiterInterest === "string"
        ? body.recruiterInterest.toUpperCase()
        : "";

    if (!ALLOWED.includes(rawNext as InterestKey)) {
      return jsonNoStore({ error: "Valor de estado inválido" }, 400);
    }

    const next = rawNext as InterestKey;

    const app = await prisma.application.findFirst({
      where: { id: params.id, job: { companyId } },
      select: { id: true },
    });

    if (!app) {
      return jsonNoStore({ error: "Application not found" }, 404);
    }

    const updated = await prisma.application.update({
      where: { id: params.id },
      data: { recruiterInterest: next },
      select: { id: true, recruiterInterest: true },
    });

    return jsonNoStore(updated, 200);
  } catch (e: unknown) {
    console.error("[PATCH /api/applications/:id/interest]", e);
    return jsonNoStore({ error: "Server error" }, 500);
  }
}