// app/api/applications/[id]/interest/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { applicationWhereForActor } from "@/lib/server/candidate-access";
import {
  APPLICATION_WITHOUT_REJECTION_FOOTPRINT_WHERE,
  hasApplicationRejectionFootprint,
} from "@/lib/hiring-process/rejection-footprint";
import {
  APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE,
  hasCanonicalApplicationOffer,
} from "@/lib/hiring-process/offer-footprint";
import {
  APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE,
  hasApplicationHiredFootprint,
} from "@/lib/hiring-process/hired-footprint";

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
      select: {
        id: true,
        stage: true,
        disposition: true,
        status: true,
        recruiterInterest: true,
      },
    });

    if (!app) {
      return jsonNoStore({ error: "Application not found" }, 404);
    }

    if (next === "REJECTED") {
      return jsonNoStore(
        { error: "REJECTED requiere el comando REJECT_CANDIDATE" },
        400,
      );
    }

    if (hasApplicationRejectionFootprint(app)) {
      return jsonNoStore(
        { error: "Reabrir una postulación rechazada está fuera de este slice" },
        409,
      );
    }

    if (hasCanonicalApplicationOffer(app)) {
      return jsonNoStore(
        { error: "La oferta canónica no admite retroceso por APIs legacy" },
        409,
      );
    }

    if (hasApplicationHiredFootprint(app)) {
      return jsonNoStore(
        { error: "HIRED es terminal y no admite cambios de interés" },
        409,
      );
    }

    const result = await prisma.application.updateMany({
      where: {
        AND: [
          scopedWhere,
          APPLICATION_WITHOUT_REJECTION_FOOTPRINT_WHERE,
          APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE,
          APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE,
        ],
      },
      data: { recruiterInterest: next },
    });
    if (result.count !== 1) {
      return jsonNoStore(
        { error: "La postulación terminal no admite cambios de interés" },
        409,
      );
    }

    const updated = await prisma.application.findFirstOrThrow({
      where: scopedWhere,
      select: { id: true, recruiterInterest: true },
    });

    return jsonNoStore(updated, 200);
  } catch (e: unknown) {
    console.error("[PATCH /api/applications/:id/interest]", e);
    return jsonNoStore({ error: "Server error" }, 500);
  }
}
