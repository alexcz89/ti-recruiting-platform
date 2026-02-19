// app/api/cron/refund-uncompleted/route.ts
import { NextRequest, NextResponse } from "next/server";
import { refundUncompletedInvites } from "@/lib/server/cron/refund-uncompleted";

/**
 * Cron job endpoint para reembolsar créditos de evaluaciones no completadas
 * 
 * Configuración en vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/refund-uncompleted",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 * 
 * Seguridad:
 * - Vercel Cron: Automáticamente incluye header `x-vercel-cron`
 * - Alternativa: Usar CRON_SECRET en env
 */
export async function GET(request: NextRequest) {
  // Verificar autenticación del cron job
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // Opción 1: Vercel Cron (header automático)
  const isVercelCron = request.headers.get("x-vercel-cron") === "true";
  
  // Opción 2: Secret manual
  const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
  
  if (!isVercelCron && !isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await refundUncompletedInvites();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Refund job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Para testing manual (eliminar en producción)
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Manual execution not allowed in production" },
      { status: 403 }
    );
  }

  const result = await refundUncompletedInvites();
  return NextResponse.json(result);
}