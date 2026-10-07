// app/api/applications/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ApplicationStatus } from "@prisma/client";

import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
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
      recruiterInterest: true,
      stage: true,
      disposition: true,
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

  if (newStatus === "REJECTED") {
    return jsonNoStore(
      { error: "REJECTED requiere el comando REJECT_CANDIDATE" },
      400,
    );
  }

  if (newStatus === "OFFER") {
    return jsonNoStore(
      { error: "OFFER requiere el comando MOVE_TO_OFFER" },
      400,
    );
  }

  if (newStatus === "HIRED") {
    return jsonNoStore(
      { error: "HIRED requiere el comando HIRE_CANDIDATE" },
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
      { error: "HIRED es terminal y no admite reapertura" },
      409,
    );
  }

  const authorizedWhere = role === "ADMIN"
    ? { id }
    : { id, job: { companyId: companyId as string } };

  const result = await prisma.application.updateMany({
    where: {
      AND: [
        authorizedWhere,
        APPLICATION_WITHOUT_REJECTION_FOOTPRINT_WHERE,
        APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE,
        APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE,
      ],
    },
    data: {
      status: newStatus,
      rejectedAt: null,
      rejectionEmailSent: false,
    },
  });
  if (result.count !== 1) {
    return jsonNoStore(
      { error: "La postulación terminal no admite reapertura" },
      409,
    );
  }

  const updated = await prisma.application.findFirstOrThrow({
    where: authorizedWhere,
    select: {
      id: true,
      status: true,
      rejectedAt: true,
      rejectionEmailSent: true,
      updatedAt: true,
    },
  });

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
