export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import { parseAssessmentFilters, selectAssessmentPage } from "@/lib/assessments/dashboard-page-query";
import { getIntegrityPresentation } from "@/lib/assessments/integrity-presentation";

const EXPORT_LIMIT = 2000;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function csvEscape(value: string | null | undefined): string {
  const original = String(value ?? "");
  // CSV quoting alone does not prevent spreadsheet formula execution.
  // Prefix only the exported value, including formulas behind whitespace/control characters.
  const str = original !== "-" && /^[\s\u0000-\u001f]*[=+@-]/u.test(original) ? `'${original}` : original;
  return /[,"\r\n]/u.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function fmtDate(value: Date | null | undefined): string {
  return value && Number.isFinite(value.getTime()) ? value.toISOString() : "";
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonError("No autorizado", 401);
    const role = String(session.user.role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") return jsonError("Forbidden", 403);

    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId && role !== "ADMIN") return jsonError("Sin empresa asociada", 403);

    const filters = parseAssessmentFilters(new URL(request.url).searchParams);
    // Selection, limit check and hydration share a snapshot. A concurrent submit or
    // deletion cannot change the selected attempt or silently drop an exported row.
    const result = await prisma.$transaction(async tx => {
      const selection = await selectAssessmentPage({
        ...filters, companyId, isAdmin: role === "ADMIN",
        page: 1, take: EXPORT_LIMIT, now: new Date(),
      }, tx);
      if (selection.total > EXPORT_LIMIT) return { overflow: true as const, lines: [] };
      if (!selection.rows.length) return { overflow: false as const, lines: [] };

      const [invites, attempts] = await Promise.all([
        tx.assessmentInvite.findMany({
          where: {
            id: { in: selection.rows.map(row => row.inviteId) },
            application: { job: {
              ...(role === "ADMIN" ? {} : { companyId: companyId as string }),
              ...(filters.jobId ? { id: filters.jobId } : {}),
            } },
          },
          select: {
            id: true, updatedAt: true,
            candidate: { select: { name: true, email: true } },
            template: { select: { title: true } },
            application: { select: { job: { select: { title: true } } } },
          },
        }),
        tx.assessmentAttempt.findMany({
          where: { id: { in: selection.rows.flatMap(row => row.attemptId ? [row.attemptId] : []) } },
          select: {
            id: true, totalScore: true, passed: true, timeSpent: true,
            severity: true,
            severityScore: true,
            multiSession: true,
            submittedAt: true,
          },
        }),
      ]);
      const inviteById = new Map(invites.map(invite => [invite.id, invite]));
      const attemptById = new Map(attempts.map(attempt => [attempt.id, attempt]));
      const lines = selection.rows.map(({ inviteId, attemptId, uiState }) => {
        const inv = inviteById.get(inviteId);
        const attempt = attemptId ? attemptById.get(attemptId) : null;
        if (!inv || (attemptId && !attempt)) throw new Error("Incomplete export snapshot");
        const integrity = getIntegrityPresentation(attempt);
        return [
          inv.candidate.name,
          inv.candidate.email,
          inv.template.title,
          inv.application.job.title,
          uiState,
          typeof attempt?.totalScore === "number" ? String(Math.round(attempt.totalScore)) : "",
          attempt?.passed === true ? "Sí" : attempt?.passed === false ? "No" : "-",
          typeof attempt?.timeSpent === "number" ? String(Math.round(attempt.timeSpent)) : "",
          integrity.requiresReview
            ? `${integrity.label}: ${integrity.details}`
            : integrity.label,
          fmtDate(attempt?.submittedAt ?? inv.updatedAt),
        ].map(csvEscape).join(",");
      });
      return { overflow: false as const, lines };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15_000 });

    if (result.overflow) {
      return jsonError(`La búsqueda supera el límite de ${EXPORT_LIMIT} evaluaciones. Refina los filtros para exportar el conjunto completo.`, 422);
    }
    const headers = ["Candidato", "Email", "Assessment", "Vacante", "Estado", "Score (%)", "Aprobado", "Tiempo (seg)", "Anti-cheat", "Fecha"];
    // Excel for Windows needs a BOM when opening UTF-8 CSV files directly.
    return new Response("\uFEFF" + [headers.join(","), ...result.lines].join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="evaluaciones.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Do not expose raw database errors or candidate data in the download response.
    return jsonError("No pudimos exportar las evaluaciones. Intenta nuevamente.", 500);
  }
}
