// app/api/applications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/session";
import { ApplicationStatus } from "@prisma/client";

// GET /api/applications/:id
// Reclutador: obtiene una application si pertenece a su empresa
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    let companyId: string | null = null;
    try {
      companyId = await getSessionCompanyId();
      if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } catch {
      // Si falló la lectura de sesión, respondemos 401 (no 500)
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
            frontend: true,
            backend: true,
            mobile: true,
            cloud: true,
            database: true,
            certifications: true,
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
// Reclutador: puede cambiar status (SUBMITTED/REVIEWING/INTERVIEW/OFFER/HIRED/REJECTED)
// body: { status?: ApplicationStatus, resumeUrl?: string | null, coverLetter?: string | null }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1) Exigir sesión y rol RECRUITER/ADMIN
    const session = await getSessionOrThrow();
    // @ts-ignore
    if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = params.id;

    // 2) Parse de JSON con manejo de error de formato
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

    // 3) Verificar ownership por empresa
    const found = await prisma.application.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!found || found.job.companyId !== companyId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 4) Validar status (si viene)
    if (typeof body.status !== "undefined") {
      const allowed = new Set(Object.values(ApplicationStatus));
      if (!allowed.has(body.status)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 });
      }
    }

    // 5) Actualizar
    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        resumeUrl: typeof body.resumeUrl !== "undefined" ? body.resumeUrl : undefined,
        coverLetter: typeof body.coverLetter !== "undefined" ? body.coverLetter : undefined,
      },
    });

    // (Opcional) Auditoría
    // await prisma.auditLog.create({
    //   data: {
    //     actorId: session.user.id as string,
    //     action: "APPLICATION_STATUS_UPDATED",
    //     target: `Application:${id}`,
    //     meta: { from: found.status, to: updated.status },
    //   }
    // })

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/applications/:id] ", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/applications/:id
// Elimina una postulación si pertenece a la empresa del reclutador
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Requiere sesión y rol RECRUITER/ADMIN
    const session = await getSessionOrThrow();
    // @ts-ignore
    if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verificar pertenencia de la aplicación a una vacante de la empresa
    const app = await prisma.application.findFirst({
      where: { id: params.id, job: { companyId } },
      select: { id: true },
    });
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    await prisma.application.delete({ where: { id: params.id } });

    // (Opcional) Auditoría
    // await prisma.auditLog.create({
    //   data: {
    //     actorId: session.user.id as string,
    //     action: "APPLICATION_DELETED",
    //     target: `Application:${params.id}`,
    //   },
    // });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/applications/:id] ", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
