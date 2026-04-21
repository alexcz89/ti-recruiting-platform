// app/api/cron/refund-uncompleted/route.ts
import { NextRequest, NextResponse } from "next/server";
import { refundUncompletedInvites } from "@/lib/server/cron/refund-uncompleted";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Cron job endpoint para reembolsar créditos de evaluaciones no completadas
 *
 * Vercel cron:
 * - Incluye header `x-vercel-cron: true`
 *
 * Alternativa manual:
 * - Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = request.headers.get("x-vercel-cron") === "true";
  const isAuthorizedBySecret =
    !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isAuthorizedBySecret) {
    return jsonNoStore({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const result = await refundUncompletedInvites();

    return jsonNoStore({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Refund job failed:", error);

    return jsonNoStore(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}

// Solo para testing manual fuera de producción
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return jsonNoStore(
      { success: false, error: "Manual execution not allowed in production" },
      403
    );
  }

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return jsonNoStore({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const result = await refundUncompletedInvites();

    return jsonNoStore({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON][MANUAL] Refund job failed:", error);

    return jsonNoStore(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
}