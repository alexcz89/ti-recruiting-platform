// app/api/applications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId, getSessionOrThrow } from '@/lib/server/session';
import { ApplicationStatus } from "@prisma/client";

// GET /api/applications/:id
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    let companyId: string | null = null;
    try {
      companyId = await getSessionCompanyId();
      if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const app = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        job: true,
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            location: true,
            resumeUrl: true,
          },
        },
        messages: true,
      },
    });

    if (!app || app.job.companyId !== companyId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(app);
  } catch (err) {
    console.error("[GET /api/applications/:id] ", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH /api/applications/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionOrThrow();
    // @ts-ignore
    if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = params.id;

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo inválido (JSON requerido)" }, { status: 400 });
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (typeof body.status !== "undefined") {
      const allowed = new Set(Object.values(ApplicationStatus));
      if (!allowed.has(body.status)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 });
      }
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        resumeUrl: typeof body.resumeUrl !== "undefined" ? body.resumeUrl : undefined,
        coverLetter: typeof body.coverLetter !== "undefined" ? body.coverLetter : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/applications/:id] ", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/applications/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionOrThrow();
    // @ts-ignore
    if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const app = await prisma.application.findFirst({
      where: { id: params.id, job: { companyId } },
      select: { id: true },
    });
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    await prisma.application.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/applications/:id] ", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
