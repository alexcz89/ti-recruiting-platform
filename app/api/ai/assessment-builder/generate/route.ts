import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";
import { isAssessmentTemplateAccessRole } from "@/lib/assessments/access";
import { checkActionRateLimit } from "@/lib/server/rate-limit";
import {
  GenerationInputSchema,
  MAX_GENERATION_BODY_BYTES,
} from "@/lib/ai/assessment-builder-contract";
import { AssessmentGenerationError, generateAssessmentQuestions } from "@/lib/ai/assessment-generation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...headers, "Cache-Control": "no-store" } });
}

async function readBoundedJson(req: Request) {
  if (Number(req.headers.get("content-length")) > MAX_GENERATION_BODY_BYTES) return { oversized: true as const };
  const reader = req.body?.getReader();
  if (!reader) return { value: null };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_GENERATION_BODY_BYTES) {
        await reader.cancel();
        return { oversized: true as const };
      }
      chunks.push(value);
    }
    return { value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
  } finally { reader.releaseLock(); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return json({ error: "No autorizado" }, 401);
    const role = session.user.role;
    if (!isAssessmentTemplateAccessRole(role)) return json({ error: "Sin permisos" }, 403);
    const companyId = role === "RECRUITER" ? await getSessionCompanyId() : null;
    if (role === "RECRUITER" && !companyId) return json({ error: "Requiere una empresa aprobada" }, 403);

    let body;
    try { body = await readBoundedJson(req); } catch { return json({ error: "JSON inválido" }, 400); }
    if (body.oversized) return json({ error: "La solicitud excede el tamaño permitido" }, 413);
    const input = GenerationInputSchema.safeParse(body.value);
    if (!input.success) return json({ error: "Parámetros de generación inválidos" }, 400);

    // Best-effort local throttling only; persistent tenant budgets belong to Phase 4.
    const limit = checkActionRateLimit("assessment-generation", companyId ? `company:${companyId}` : `admin:${session.user.id}`, {
      maxAttempts: 10,
      windowMs: 60_000,
    });
    if (!limit.allowed) return json({ error: "Demasiadas solicitudes. Intenta más tarde." }, 429, {
      "Retry-After": String(limit.retryAfter ?? 60),
    });

    const questions = await generateAssessmentQuestions(input.data);
    return json({ ok: true, questions });
  } catch (error) {
    if (error instanceof AssessmentGenerationError) {
      if (error.kind === "unavailable") return json({ error: "Servicio de IA no configurado" }, 503);
      if (error.kind === "invalid_output") return json({ error: "La IA no generó preguntas válidas. Intenta de nuevo." }, 502);
      return json({ error: "El proveedor de IA no está disponible. Intenta más tarde." }, 502);
    }
    // Do not log provider errors, prompts or generated solutions.
    console.error("[AI Builder] Generation failed");
    return json({ error: "Error al generar preguntas con IA" }, 500);
  }
}
