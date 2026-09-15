import { NextRequest, NextResponse } from "next/server";

import { DemoRequestSchema } from "@/lib/contact/demo-request";
import { sendDemoRequestEmail } from "@/lib/server/mailer";
import { checkActionRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 12_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function json(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: "Solicitud no válida." }, 403);
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Formato de solicitud no válido." }, 415);
  }

  const announcedLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(announcedLength) && announcedLength > MAX_BODY_BYTES) {
    return json({ error: "La solicitud es demasiado grande." }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "No pudimos leer la solicitud." }, 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "La solicitud es demasiado grande." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "La solicitud no contiene JSON válido." }, 400);
  }

  const parsed = DemoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Revisa los campos marcados e intenta de nuevo.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  if (parsed.data.website?.trim()) {
    return json({ error: "No pudimos procesar tu solicitud." }, 400);
  }

  const ip = getClientIp(request.headers);
  const limits = [
    checkActionRateLimit("demo-request-email", parsed.data.email, {
      maxAttempts: 3,
      windowMs: RATE_LIMIT_WINDOW_MS,
    }),
    ...(ip
      ? [
          checkActionRateLimit("demo-request-ip", ip, {
            maxAttempts: 10,
            windowMs: RATE_LIMIT_WINDOW_MS,
          }),
        ]
      : []),
  ];
  const blocked = limits.find((result) => !result.allowed);

  if (blocked) {
    const retryAfter = Math.max(1, Math.ceil((blocked.resetAt - Date.now()) / 1000));
    return json(
      { error: "Recibimos demasiadas solicitudes. Intenta más tarde." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  try {
    const delivery = await sendDemoRequestEmail(parsed.data);
    if (!("ok" in delivery)) {
      console.error("[POST /api/contact] Demo request delivery was unavailable");
      return json(
        { error: "No pudimos enviar tu solicitud. Intenta de nuevo más tarde." },
        503,
      );
    }
  } catch {
    console.error("[POST /api/contact] Demo request delivery failed");
    return json(
      { error: "No pudimos enviar tu solicitud. Intenta de nuevo más tarde." },
      503,
    );
  }

  return json({ ok: true });
}
