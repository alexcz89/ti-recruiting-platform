// app/api/assessments/attempts/[attemptId]/flags/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "TAB_SWITCH",
  "VISIBILITY_HIDDEN",
  "COPY",
  "PASTE",
  "RIGHT_CLICK",
]);

function noStoreJson(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function PATCH(
  request: Request,
  { params }: { params: { attemptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return noStoreJson({ error: "No autorizado" }, 401);

    const user = session.user as any;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: "Body inválido" }, 400);
    }

    const event = String(body?.event || "");
    const meta = body?.meta;

    if (!ALLOWED_EVENTS.has(event)) {
      return noStoreJson({ error: "Evento inválido" }, 400);
    }

    // meta opcional: limita tamaño para no meter basura
    let safeMeta: any = undefined;
    if (meta && typeof meta === "object") {
      // copia superficial + recorta
      const s = JSON.stringify(meta);
      if (s.length <= 1000) safeMeta = meta;
    }

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: params.attemptId },
      select: {
        id: true,
        candidateId: true,
        status: true,
        expiresAt: true,
        flagsJson: true,
      },
    });

    if (!attempt) return noStoreJson({ error: "Intento no encontrado" }, 404);
    if (attempt.candidateId !== user.id)
      return noStoreJson({ error: "No autorizado" }, 403);

    // Solo permitir mientras está en progreso y no expiró
    if (attempt.status !== "IN_PROGRESS") {
      return noStoreJson({ error: "El intento no está en progreso" }, 400);
    }
    if (attempt.expiresAt && new Date() > attempt.expiresAt) {
      return noStoreJson({ error: "El tiempo ha expirado" }, 400);
    }

    const prev = (attempt.flagsJson as any) || {};
    const counts = { ...(prev.counts || {}) };

    // incrementos controlados
    if (event === "TAB_SWITCH") counts.tabSwitches = (counts.tabSwitches || 0) + 1;
    if (event === "VISIBILITY_HIDDEN") counts.visibilityHidden = (counts.visibilityHidden || 0) + 1;
    if (event === "COPY") counts.copyAttempts = (counts.copyAttempts || 0) + 1;
    if (event === "PASTE") counts.pasteAttempts = (counts.pasteAttempts || 0) + 1;
    if (event === "RIGHT_CLICK") counts.rightClicks = (counts.rightClicks || 0) + 1;

    // eventos (ring buffer)
    const events: any[] = Array.isArray(prev.events) ? prev.events : [];
    const nextEvents = [
      ...events,
      { type: event, ts: new Date().toISOString(), ...(safeMeta ? { meta: safeMeta } : {}) },
    ];

    // tope para no crecer infinito
    const MAX_EVENTS = 200;
    const trimmedEvents =
      nextEvents.length > MAX_EVENTS ? nextEvents.slice(nextEvents.length - MAX_EVENTS) : nextEvents;

    // opcional: severidad simple
    const severityScore =
      (counts.tabSwitches || 0) * 2 +
      (counts.copyAttempts || 0) * 3 +
      (counts.pasteAttempts || 0) * 3 +
      (counts.rightClicks || 0);

    const severity =
      severityScore >= 20 ? "CRITICAL" : severityScore >= 10 ? "SUSPICIOUS" : "NORMAL";

    const merged = {
      ...prev,
      counts,
      events: trimmedEvents,
      severity,
      severityScore: clampInt(severityScore, 0, 9999),
      updatedAt: new Date().toISOString(),
    };

    await prisma.assessmentAttempt.update({
      where: { id: params.attemptId },
      data: { flagsJson: merged },
    });

    return noStoreJson({ success: true, flags: { counts, severity } });
  } catch (error) {
    console.error("Error updating flags:", error);
    return noStoreJson({ error: "Error al actualizar flags" }, 500);
  }
}
