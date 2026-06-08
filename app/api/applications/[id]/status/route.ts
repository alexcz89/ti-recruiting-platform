// app/api/applications/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ApplicationStatus } from "@prisma/client";

import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";

const ALLOWED = new Set<ApplicationStatus>([
  "SUBMITTED",
  "REVIEWING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
]);

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function updateStatus(id: string, status: string) {
  const normalized = String(status || "").toUpperCase();
  if (!ALLOWED.has(normalized as ApplicationStatus)) {
    return jsonNoStore({ error: "Status inválido" }, 400);
  }

  const newStatus = normalized as ApplicationStatus;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return jsonNoStore({ error: "No autenticado" }, 401);
  }

  const role = session.user?.role;
  if (role !== "RECRUITER" && role !== "ADMIN") {
    return jsonNoStore({ error: "Sin permisos" }, 403);
  }

  const companyId = await getSessionCompanyId();
  if (!companyId && role !== "ADMIN") {
    return jsonNoStore({ error: "Sin permisos" }, 403);
  }

  const app = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
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
        },
      },
    },
  });

  if (!app) {
    return jsonNoStore({ error: "Application no encontrada" }, 404);
  }

  if (role !== "ADMIN" && app.job.companyId !== companyId) {
    return jsonNoStore(
      { error: "No autorizado para esta aplicación" },
      403
    );
  }

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
          status: newStatus,
          rejectedAt: null,
          rejectionEmailSent: false,
        },
    select: {
      id: true,
      status: true,
      rejectedAt: true,
      rejectionEmailSent: true,
      updatedAt: true,
    },
  });

  // El email de rechazo se envía con 3 días de delay por el cron /api/cron/rejections
  // (rejectedAt + rejectionEmailSent=false ya quedaron guardados arriba)

  return jsonNoStore({ ok: true, application: updated });
}

// PATCH con JSON {status}
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { status?: unknown } | null = null;

  try {
    body = await req.json();
  } catch {
    return jsonNoStore({ error: "Cuerpo inválido (JSON requerido)" }, 400);
  }

  return updateStatus(
    params.id,
    typeof body?.status === "string" ? body.status : ""
  );
}

// POST desde formulario <form method="post">
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctype = req.headers.get("content-type") || "";
  let status = "";

  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as
      | { status?: unknown }
      | null;

    status = typeof body?.status === "string" ? body.status : "";
  } else {
    const form = await req.formData();
    status = String(form.get("status") || "");
  }

  return updateStatus(params.id, status);
}