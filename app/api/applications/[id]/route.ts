// app/api/applications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/server/session";
import { ApplicationStatus } from "@prisma/client";
import { applicationWhereForActor } from "@/lib/server/candidate-access";
import {
  APPLICATION_WITHOUT_REJECTION_FOOTPRINT_WHERE,
  hasApplicationRejectionFootprint,
} from "@/lib/hiring-process/rejection-footprint";

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
      if (hasApplicationRejectionFootprint(found)) {
        return jsonNoStore(
          { error: "Reabrir una postulación rechazada está fuera de este slice" },
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
          ],
        },
        data,
      });
      if (result.count !== 1) {
        return jsonNoStore(
          { error: "Reabrir una postulación rechazada está fuera de este slice" },
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

    const app = await prisma.application.findFirst({
      where: scopedWhere,
      select: { id: true },
    });

    if (!app) {
      return jsonNoStore({ error: "Application not found" }, 404);
    }

    await prisma.application.delete({ where: { id: app.id } });

    return jsonNoStore({ ok: true }, 200);
  } catch (err) {
    console.error("[DELETE /api/applications/:id] ", err);
    return jsonNoStore({ error: "Internal Server Error" }, 500);
  }
}
