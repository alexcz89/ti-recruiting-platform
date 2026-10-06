import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";

import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";
import {
  applicationIntentSchema,
  executeApplicationIntent,
} from "@/lib/hiring-process/application-intents";
import {
  ApplicationNotFoundError,
  CanonicalStateUnavailableError,
  ConcurrentApplicationTransitionError,
  IdempotencyKeyConflictError,
  UnauthorizedApplicationTransitionError,
} from "@/lib/hiring-process/transition-application";
import { InvalidApplicationTransitionError } from "@/lib/hiring-process/rules";

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonNoStore({ error: "Unauthorized" }, 401);

  const role = String(session.user.role ?? "").toUpperCase();
  if (role !== "RECRUITER" && role !== "ADMIN") {
    return jsonNoStore({ error: "Forbidden" }, 403);
  }

  const actorId = session.user.id ? String(session.user.id) : null;
  if (!actorId) return jsonNoStore({ error: "Unauthorized" }, 401);

  try {
    const body = await request.json().catch(() => null);
    if (body === null) return jsonNoStore({ error: "Comando inválido" }, 400);
    const command = applicationIntentSchema.parse(body);
    const companyId = role === "RECRUITER"
      ? await getSessionCompanyId().catch(() => null)
      : null;
    if (role === "RECRUITER" && !companyId) {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }

    const result = await executeApplicationIntent({
      applicationId: params.id,
      command,
      actor: { type: role, id: actorId, companyId },
    });

    return jsonNoStore({
      application: {
        stage: result.state?.stage ?? null,
        disposition: result.state?.disposition ?? null,
        stateVersion: result.legacy.stateVersion,
        status: result.legacy.status,
        recruiterInterest: result.legacy.recruiterInterest,
        offerAt: result.timestamps.offerAt?.toISOString() ?? null,
      },
      replayed: result.replayed,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonNoStore({ error: "Comando inválido" }, 400);
    }
    if (error instanceof UnauthorizedApplicationTransitionError) {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }
    if (error instanceof ApplicationNotFoundError) {
      return jsonNoStore({ error: "Application not found" }, 404);
    }
    if (
      error instanceof ConcurrentApplicationTransitionError ||
      error instanceof IdempotencyKeyConflictError
    ) {
      return jsonNoStore({ error: error.code }, 409);
    }
    if (
      error instanceof CanonicalStateUnavailableError ||
      error instanceof InvalidApplicationTransitionError
    ) {
      return jsonNoStore({ error: error.code }, 422);
    }

    console.error("[POST /api/applications/:id/intent]", error);
    return jsonNoStore({ error: "Server error" }, 500);
  }
}
