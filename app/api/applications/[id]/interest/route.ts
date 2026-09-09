// app/api/applications/[id]/interest/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { applicationWhereForActor } from "@/lib/server/candidate-access";

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
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "Unauthorized" }, 401);
    const role = String(session.user.role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }
    const companyId = role === "RECRUITER"
      ? await getSessionCompanyId().catch(() => null)
      : null;
    const scopedWhere = applicationWhereForActor(
      { role, companyId },
      { applicationId: params.id }
    );
    if (!scopedWhere) return jsonNoStore({ error: "Forbidden" }, 403);

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
      where: scopedWhere,
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
