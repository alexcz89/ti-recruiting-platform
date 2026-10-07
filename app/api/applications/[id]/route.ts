// app/api/applications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/server/session";
import { ApplicationStatus, Prisma } from "@prisma/client";
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

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// GET /api/applications/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionOrThrow();
    const role = session.user?.role;

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
    if (!scopedWhere) return jsonNoStore({ error: "Unauthorized" }, 401);

    const app = await prisma.application.findFirst({
      where: scopedWhere,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            companyId: true,
          },
        },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            location: true,
            resumeUrl: true,
          },
        },
        messages: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });

    if (!app) {
      return jsonNoStore({ error: "Not found" }, 404);
    }

    return jsonNoStore(app);
  } catch (err) {
    console.error("[GET /api/applications/:id] ", err);
    return jsonNoStore({ error: "Internal Server Error" }, 500);
  }
}

// PATCH /api/applications/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionOrThrow();
    const role = session.user?.role;

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
    if (!scopedWhere) return jsonNoStore({ error: "Unauthorized" }, 401);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      return jsonNoStore({ error: "Cuerpo inválido (JSON requerido)" }, 400);
    }

    const body = bodyRaw as Partial<{
      status: ApplicationStatus;
      resumeUrl: string | null;
      coverLetter: string | null;
    }>;

    const found = await prisma.application.findFirst({
      where: scopedWhere,
      select: {
        id: true,
        stage: true,
        disposition: true,
        status: true,
        recruiterInterest: true,
      },
    });

    if (!found) {
      return jsonNoStore({ error: "Not found" }, 404);
    }

    if (typeof body.status !== "undefined") {
      const allowed = new Set(Object.values(ApplicationStatus));
      if (!allowed.has(body.status)) {
        return jsonNoStore({ error: "Status inválido" }, 400);
      }
      if (body.status === "REJECTED") {
        return jsonNoStore(
          { error: "REJECTED requiere el comando REJECT_CANDIDATE" },
          400,
        );
      }
      if (body.status === "OFFER") {
        return jsonNoStore(
          { error: "OFFER requiere el comando MOVE_TO_OFFER" },
          400,
        );
      }
      if (body.status === "HIRED") {
        return jsonNoStore(
          { error: "HIRED requiere el comando HIRE_CANDIDATE" },
          400,
        );
      }
      if (hasApplicationRejectionFootprint(found)) {
        return jsonNoStore(
          { error: "Reabrir una postulación rechazada está fuera de este slice" },
          409,
        );
      }
      if (hasCanonicalApplicationOffer(found)) {
        return jsonNoStore(
          { error: "La oferta canónica no admite retroceso por APIs legacy" },
          409,
        );
      }
      if (hasApplicationHiredFootprint(found)) {
        return jsonNoStore(
          { error: "HIRED es terminal y no admite reapertura" },
          409,
        );
      }
    }

    const data = {
      status: body.status ?? undefined,
      resumeUrl:
        typeof body.resumeUrl !== "undefined" ? body.resumeUrl : undefined,
      coverLetter:
        typeof body.coverLetter !== "undefined"
          ? body.coverLetter
          : undefined,
    };

    if (typeof body.status !== "undefined") {
      const result = await prisma.application.updateMany({
        where: {
          AND: [
            scopedWhere,
            APPLICATION_WITHOUT_REJECTION_FOOTPRINT_WHERE,
            APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE,
            APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE,
          ],
        },
        data,
      });
      if (result.count !== 1) {
        return jsonNoStore(
          { error: "La postulación terminal no admite reapertura" },
          409,
        );
      }
    } else {
      const result = await prisma.application.updateMany({
        where: scopedWhere,
        data,
      });
      if (result.count !== 1) {
        return jsonNoStore({ error: "Not found" }, 404);
      }
    }

    const updated = await prisma.application.findFirstOrThrow({
      where: scopedWhere,
    });

    return jsonNoStore(updated);
  } catch (err) {
    console.error("[PATCH /api/applications/:id] ", err);
    return jsonNoStore({ error: "Internal Server Error" }, 500);
  }
}

// DELETE /api/applications/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionOrThrow();
    const role = session.user?.role;

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
    if (!scopedWhere) return jsonNoStore({ error: "Unauthorized" }, 401);

    const outcome = await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: scopedWhere,
        select: { id: true, stage: true, disposition: true, status: true },
      });
      if (!app) return "NOT_FOUND" as const;
      if (hasApplicationHiredFootprint(app)) return "HIRED" as const;

      await tx.application.delete({ where: { id: app.id } });
      return "DELETED" as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (outcome === "NOT_FOUND") {
      return jsonNoStore({ error: "Application not found" }, 404);
    }
    if (outcome === "HIRED") {
      return jsonNoStore(
        { error: "No se puede eliminar una postulación contratada" },
        409,
      );
    }

    return jsonNoStore({ ok: true }, 200);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: unknown }).code === "P2034"
    ) {
      return jsonNoStore({ error: "La postulación cambió durante el borrado" }, 409);
    }
    console.error("[DELETE /api/applications/:id] ", err);
    return jsonNoStore({ error: "Internal Server Error" }, 500);
  }
}
