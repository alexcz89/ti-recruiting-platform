// app/api/assessments/attempts/[attemptId]/flags/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set([
  "TAB_SWITCH",
  "VISIBILITY_HIDDEN",
  "COPY",
  "PASTE",
  "RIGHT_CLICK",
  "PAGEHIDE",
  "BLUR",
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

function getClientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  const xr = req.headers.get("x-real-ip");
  return xr?.trim() || "unknown";
}

function ipPrefix(ip: string) {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : ip;
  }
  return ip.slice(0, 16);
}

function stableHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16)}`;
}

async function readBody(request: Request) {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await request.json();
  const txt = await request.text();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

type IncomingEvent = {
  event: string;
  meta?: any;
  ts?: string;
  eventId?: string;
};

function sanitizeMeta(meta: any) {
  if (!meta || typeof meta !== "object") return undefined;
  try {
    const s = JSON.stringify(meta);
    if (s.length <= 1000) return meta;
  } catch {}
  return undefined;
}

function normalizeEvents(body: any): IncomingEvent[] {
  if (!body) return [];
  if (Array.isArray(body.events)) return body.events;
  if (body.event) return [{ event: body.event, meta: body.meta, ts: body.ts, eventId: body.eventId }];
  return [];
}

/**
 * ✅ Severidad calibrada para assessments de coding:
 *
 * - tabSwitches * 3     → cambiar de pestaña es intencional y sospechoso
 * - copyAttempts * 5    → copiar es muy sospechoso
 * - pasteAttempts * 5   → pegar es muy sospechoso
 * - rightClicks * 0     → ignorado — normal en coding (click derecho en editor)
 * - pageHides * 2       → moderado
 * - focusLoss           → ignorar primeros 20 (normal en editor), luego pesa poco
 * - multiSession * 30   → múltiples dispositivos = definitivamente sospechoso
 *
 * Thresholds:
 * - NORMAL    → score < 40
 * - SUSPICIOUS → score 40-79
 * - CRITICAL  → score >= 80
 *
 * Ejemplos con uso normal de coding:
 *   15 tabs + 70 focusLoss = 45 + 25 = 70 → SUSPICIOUS (no CRITICAL)
 *   5 tabs + 20 focusLoss = 15 + 0 = 15 → NORMAL
 *   50 tabs + 3 copias = 150 + 15 = 165 → CRITICAL (fraude real)
 */
function computeSeverityScore(counters: {
  tabSwitches: number;
  copyAttempts: number;
  pasteAttempts: number;
  rightClicks: number;
  pageHides: number;
  focusLoss: number;
  multiSession: boolean;
}): number {
  const focusLossExtra = Math.max(0, counters.focusLoss - 20);

  return Math.round(
    counters.tabSwitches * 3 +
    counters.copyAttempts * 5 +
    counters.pasteAttempts * 5 +
    counters.rightClicks * 0 +       // ignorado
    counters.pageHides * 2 +
    focusLossExtra * 0.5 +           // solo el exceso, con peso bajo
    (counters.multiSession ? 30 : 0)
  );
}

function computeSeverity(score: number): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 40) return "SUSPICIOUS";
  return "NORMAL";
}

export async function PATCH(
  request: Request,
  { params }: { params: { attemptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return noStoreJson({ error: "No autorizado" }, 401);

    const user = session.user as any;

    const body = await readBody(request);
    const incoming = normalizeEvents(body);
    if (!incoming.length) return noStoreJson({ error: "Body inválido" }, 400);

    const ua = request.headers.get("user-agent") || "unknown";
    const ip = getClientIp(request);
    const ipPfx = ipPrefix(ip);
    const clientSig = stableHash(`${ua}::${ipPfx}`);

    const now = new Date();

    const events = incoming
      .map((e) => ({
        type: String(e.event || ""),
        meta: sanitizeMeta(e.meta),
        clientTs: typeof e.ts === "string" ? e.ts : undefined,
        eventId: typeof e.eventId === "string" ? e.eventId : undefined,
      }))
      .filter((e) => ALLOWED_EVENTS.has(e.type));

    if (!events.length) return noStoreJson({ error: "Evento inválido" }, 400);

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: params.attemptId },
      select: {
        id: true,
        candidateId: true,
        status: true,
        expiresAt: true,
        firstClientSig: true,
        tabSwitches: true,
        visibilityHidden: true,
        copyAttempts: true,
        pasteAttempts: true,
        rightClicks: true,
        focusLoss: true,
        pageHides: true,
        multiSession: true,
        severityScore: true,
        severity: true,
      },
    });

    if (!attempt) return noStoreJson({ error: "Intento no encontrado" }, 404);
    if (attempt.candidateId !== user.id) return noStoreJson({ error: "No autorizado" }, 403);
    if (attempt.status !== "IN_PROGRESS") return noStoreJson({ error: "El intento no está en progreso" }, 400);
    if (attempt.expiresAt && new Date() > attempt.expiresAt) return noStoreJson({ error: "El tiempo ha expirado" }, 400);

    const inc = {
      tabSwitches: 0,
      visibilityHidden: 0,
      copyAttempts: 0,
      pasteAttempts: 0,
      rightClicks: 0,
      focusLoss: 0,
      pageHides: 0,
    };

    for (const e of events) {
      if (e.type === "TAB_SWITCH") inc.tabSwitches++;
      if (e.type === "VISIBILITY_HIDDEN") inc.visibilityHidden++;
      if (e.type === "COPY") inc.copyAttempts++;
      if (e.type === "PASTE") inc.pasteAttempts++;
      if (e.type === "RIGHT_CLICK") inc.rightClicks++;
      if (e.type === "BLUR") inc.focusLoss++;
      if (e.type === "PAGEHIDE") inc.pageHides++;
    }

    const firstSig = attempt.firstClientSig || clientSig;
    const multiSession = firstSig !== clientSig;

    const toInsert = events.map((e) => ({
      attemptId: attempt.id,
      candidateId: attempt.candidateId,
      type: e.type,
      meta: e.meta
        ? { ...e.meta, ...(e.clientTs ? { clientTs: e.clientTs } : {}) }
        : e.clientTs
        ? { clientTs: e.clientTs }
        : undefined,
      eventId: e.eventId,
      clientSig,
      ipPrefix: ipPfx,
      userAgent: ua,
      createdAt: now,
    }));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.assessmentAttemptEvent.createMany({
        data: toInsert,
        skipDuplicates: true,
      });

      const afterCounters = await tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          tabSwitches: inc.tabSwitches ? { increment: inc.tabSwitches } : undefined,
          visibilityHidden: inc.visibilityHidden ? { increment: inc.visibilityHidden } : undefined,
          copyAttempts: inc.copyAttempts ? { increment: inc.copyAttempts } : undefined,
          pasteAttempts: inc.pasteAttempts ? { increment: inc.pasteAttempts } : undefined,
          rightClicks: inc.rightClicks ? { increment: inc.rightClicks } : undefined,
          focusLoss: inc.focusLoss ? { increment: inc.focusLoss } : undefined,
          pageHides: inc.pageHides ? { increment: inc.pageHides } : undefined,
          firstClientSig: attempt.firstClientSig ? undefined : firstSig,
          lastClientSig: clientSig,
          multiSession: multiSession ? true : undefined,
        },
        select: {
          tabSwitches: true,
          visibilityHidden: true,
          copyAttempts: true,
          pasteAttempts: true,
          rightClicks: true,
          focusLoss: true,
          pageHides: true,
          multiSession: true,
        },
      });

      // ✅ Nueva fórmula de severidad
      const severityScore = computeSeverityScore({
        tabSwitches: afterCounters.tabSwitches,
        copyAttempts: afterCounters.copyAttempts,
        pasteAttempts: afterCounters.pasteAttempts,
        rightClicks: afterCounters.rightClicks,
        pageHides: afterCounters.pageHides,
        focusLoss: afterCounters.focusLoss,
        multiSession: afterCounters.multiSession,
      });

      const severity = computeSeverity(severityScore);

      const final = await tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          severityScore: clampInt(severityScore, 0, 9999),
          severity,
        },
        select: {
          tabSwitches: true,
          visibilityHidden: true,
          copyAttempts: true,
          pasteAttempts: true,
          rightClicks: true,
          focusLoss: true,
          pageHides: true,
          multiSession: true,
          severityScore: true,
          severity: true,
        },
      });

      return final;
    });

    return noStoreJson({
      success: true,
      flags: {
        counts: {
          tabSwitches: updated.tabSwitches,
          visibilityHidden: updated.visibilityHidden,
          copyAttempts: updated.copyAttempts,
          pasteAttempts: updated.pasteAttempts,
          rightClicks: updated.rightClicks,
          focusLoss: updated.focusLoss,
          pageHides: updated.pageHides,
        },
        severity: updated.severity,
        severityScore: updated.severityScore,
        multiSession: updated.multiSession,
      },
      received: events.length,
    });
  } catch (error) {
    console.error("Error updating flags:", error);
    return noStoreJson({ error: "Error al actualizar flags" }, 500);
  }
}