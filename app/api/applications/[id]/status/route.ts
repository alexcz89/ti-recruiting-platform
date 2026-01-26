// app/api/applications/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import { NotificationService } from '@/lib/notifications/service'; // 🔔 NUEVO

const ALLOWED = new Set([
  "SUBMITTED",
  "REVIEWING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
]);

async function updateStatus(id: string, status: string, req: NextRequest) {
  // Validación de estado
  const newStatus = String(status || "").toUpperCase();
  if (!ALLOWED.has(newStatus)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  // Auth básica
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (role !== "RECRUITER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Autorización por compañía (el recruiter debe pertenecer a la misma company del job)
  const companyId = await getSessionCompanyId();
  if (!companyId && role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const app = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      job: { select: { id: true, title: true, companyId: true } },
      candidate: { select: { id: true, email: true, name: true } },
    },
  });
  if (!app) {
    return NextResponse.json({ error: "Application no encontrada" }, { status: 404 });
  }
  if (role !== "ADMIN" && app.job?.companyId !== companyId) {
    return NextResponse.json({ error: "No autorizado para esta aplicación" }, { status: 403 });
  }

  // 🔔 GUARDAR EL STATUS ANTERIOR PARA LA NOTIFICACIÓN
  const oldStatus = app.status;

  const isRejected = newStatus === "REJECTED";

  const updated = await prisma.application.update({
    where: { id },
    data: isRejected
      ? {
          status: "REJECTED",
          rejectedAt: new Date(),
          rejectionEmailSent: false,
        }
      : {
          status: newStatus as any,
          rejectedAt: null,
          rejectionEmailSent: false,
        },
    include: { job: true, candidate: true },
  });

  // 🔔 NUEVO: Notificar al candidato si el status cambió
  if (oldStatus !== newStatus) {
    (async () => {
      try {
        await NotificationService.create({
          userId: app.candidate.id,
          type: 'APPLICATION_STATUS_CHANGE',
          metadata: {
            jobTitle: app.job.title,
            jobId: app.job.id,
            applicationId: app.id,
            oldStatus: oldStatus,
            newStatus: newStatus,
          },
        });
      } catch (notifErr) {
        console.warn("[PATCH /api/applications/status] Notification failed:", notifErr);
      }
    })();
  }

  return NextResponse.json({ ok: true, application: updated });
}

// PATCH con JSON {status}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  return updateStatus(params.id, body?.status, req);
}

// POST desde formulario <form method="post">
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctype = req.headers.get("content-type") || "";
  let status = "";
  if (ctype.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    status = body?.status || "";
  } else {
    const form = await req.formData();
    status = String(form.get("status") || "");
  }
  return updateStatus(params.id, status, req);
}