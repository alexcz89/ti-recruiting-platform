// app/api/applications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/server/session";
import { ApplicationStatus } from "@prisma/client";

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

    let companyId: string | null = null;
    try {
      companyId = await getSessionCompanyId();
      if (!companyId) return jsonNoStore({ error: "Unauthorized" }, 401);
    } catch {
      return jsonNoStore({ error: "Unauthorized" }, 401);
    }

    const app = await prisma.application.findUnique({
      where: { id: params.id },
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

    if (!app || app.job.companyId !== companyId) {
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

    const companyId = await getSessionCompanyId();
    if (!companyId) return jsonNoStore({ error: "Unauthorized" }, 401);

    const id = params.id;

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

    const found = await prisma.application.findUnique({
      where: { id },
      include: { job: true },
    });

    if (!found || found.job.companyId !== companyId) {
      return jsonNoStore({ error: "Not found" }, 404);
    }

    if (typeof body.status !== "undefined") {
      const allowed = new Set(Object.values(ApplicationStatus));
      if (!allowed.has(body.status)) {
        return jsonNoStore({ error: "Status inválido" }, 400);
      }
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        resumeUrl:
          typeof body.resumeUrl !== "undefined" ? body.resumeUrl : undefined,
        coverLetter:
          typeof body.coverLetter !== "undefined"
            ? body.coverLetter
            : undefined,
      },
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

    const companyId = await getSessionCompanyId();
    if (!companyId) return jsonNoStore({ error: "Unauthorized" }, 401);

    const app = await prisma.application.findFirst({
      where: { id: params.id, job: { companyId } },
      select: { id: true },
    });

    if (!app) {
      return jsonNoStore({ error: "Application not found" }, 404);
    }

    await prisma.application.delete({ where: { id: params.id } });

    return jsonNoStore({ ok: true }, 200);
  } catch (err) {
    console.error("[DELETE /api/applications/:id] ", err);
    return jsonNoStore({ error: "Internal Server Error" }, 500);
  }
}