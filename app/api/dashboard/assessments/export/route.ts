// app/api/dashboard/assessments/export/route.ts
// Exporta todas las evaluaciones filtradas como CSV (sin paginación, máx 2000).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";

type UiState = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "INACTIVE";

function pickUiState(inv: any, attempt: any, now: Date): UiState {
  const invStatus = String(inv?.status ?? "").toUpperCase();
  const atStatus = String(attempt?.status ?? "").toUpperCase();
  if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(atStatus)) return "COMPLETED";
  if (attempt?.expiresAt && new Date(attempt.expiresAt) <= now) return "INACTIVE";
  if (["IN_PROGRESS", "NOT_STARTED"].includes(atStatus)) return "IN_PROGRESS";
  if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(invStatus)) return "COMPLETED";
  if (invStatus === "STARTED") return "IN_PROGRESS";
  if (["CANCELLED", "REVOKED"].includes(invStatus)) return "INACTIVE";
  if (inv?.expiresAt && new Date(inv.expiresAt) <= now) return "INACTIVE";
  return "PENDING";
}

function csvEscape(value: string | null | undefined): string {
  const str = String(value ?? "");
  // wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toISOString();
  } catch {
    return "";
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
    }

    const user = session.user as any;
    const role = String(user?.role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId && role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Sin empresa asociada" }), { status: 403 });
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const jobId = (url.searchParams.get("jobId") ?? "").trim();
    const stateFilter = (url.searchParams.get("state") ?? "").toUpperCase();
    const hasAttempt = (url.searchParams.get("hasAttempt") ?? "").trim();
    const sort = (url.searchParams.get("sort") ?? "recent").trim();

    const now = new Date();

    const invites = await prisma.assessmentInvite.findMany({
      where: {
        application: { job: { companyId: companyId as any, ...(jobId ? { id: jobId } : {}) } },
        ...(q
          ? {
              OR: [
                { candidate: { name: { contains: q, mode: "insensitive" } } },
                { candidate: { email: { contains: q, mode: "insensitive" } } },
                { template: { title: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      } as any,
      select: {
        id: true,
        status: true,
        token: true,
        expiresAt: true,
        updatedAt: true,
        templateId: true,
        template: { select: { id: true, title: true, difficulty: true, passingScore: true, timeLimit: true } },
        candidateId: true,
        candidate: { select: { id: true, name: true, email: true } },
        applicationId: true,
        application: { select: { id: true, job: { select: { id: true, title: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 2000,
    });

    const inviteIds = invites.map((i) => i.id);
    const pairs = invites
      .map((inv) => ({
        applicationId: inv.applicationId,
        templateId: inv.templateId,
        candidateId: inv.candidateId,
      }))
      .filter((p) => p.applicationId && p.templateId && p.candidateId);

    const attempts =
      inviteIds.length || pairs.length
        ? await prisma.assessmentAttempt.findMany({
            where: {
              OR: [
                ...(inviteIds.length ? [{ inviteId: { in: inviteIds as any } }] : []),
                ...(pairs.length ? (pairs as any) : []),
              ] as any,
            },
            select: {
              id: true,
              status: true,
              totalScore: true,
              passed: true,
              submittedAt: true,
              createdAt: true,
              expiresAt: true,
              inviteId: true,
              applicationId: true,
              templateId: true,
              candidateId: true,
              severity: true,
              severityScore: true,
              timeSpent: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5000,
          })
        : [];

    const attemptByInviteId = new Map<string, any>();
    const attemptByKey = new Map<string, any>();
    for (const a of attempts) {
      if (a.inviteId && !attemptByInviteId.has(String(a.inviteId))) {
        attemptByInviteId.set(String(a.inviteId), a);
      }
      const key = `${a.applicationId}::${a.templateId}::${a.candidateId}`;
      if (!attemptByKey.has(key)) attemptByKey.set(key, a);
    }

    let rows = invites.map((inv) => {
      const attempt =
        attemptByInviteId.get(String(inv.id)) ||
        attemptByKey.get(`${inv.applicationId}::${inv.templateId}::${inv.candidateId}`) ||
        null;
      return { inv, attempt, uiState: pickUiState(inv, attempt, now) };
    });

    // Filters
    rows = rows.filter((r) => {
      if (hasAttempt === "1" && !r.attempt) return false;
      if (hasAttempt === "0" && r.attempt) return false;
      if (stateFilter && stateFilter !== "ALL" && r.uiState !== stateFilter) return false;
      return true;
    });

    // Sort
    if (sort === "score_desc") {
      rows.sort((a, b) => {
        const sa = typeof a.attempt?.totalScore === "number" ? a.attempt.totalScore : -1;
        const sb = typeof b.attempt?.totalScore === "number" ? b.attempt.totalScore : -1;
        return sb - sa;
      });
    } else if (sort === "score_asc") {
      rows.sort((a, b) => {
        const sa = typeof a.attempt?.totalScore === "number" ? a.attempt.totalScore : 101;
        const sb = typeof b.attempt?.totalScore === "number" ? b.attempt.totalScore : 101;
        return sa - sb;
      });
    }

    // Build CSV
    const headers = [
      "Candidato",
      "Email",
      "Assessment",
      "Vacante",
      "Estado",
      "Score (%)",
      "Aprobado",
      "Tiempo (seg)",
      "Anti-cheat",
      "Fecha",
    ];

    const csvRows = rows.map(({ inv, attempt, uiState }) => {
      const score =
        typeof attempt?.totalScore === "number"
          ? String(Math.round(attempt.totalScore))
          : "";
      const aprobado =
        attempt?.passed === true ? "Sí" : attempt?.passed === false ? "No" : "-";
      const tiempo =
        typeof attempt?.timeSpent === "number" ? String(Math.round(attempt.timeSpent)) : "";
      const anticheat = attempt?.severity
        ? String(attempt.severity).toUpperCase()
        : attempt
        ? "Normal"
        : "-";
      const fecha = fmtDate(attempt?.submittedAt ?? inv.updatedAt);

      return [
        inv.candidate?.name,
        inv.candidate?.email,
        inv.template?.title,
        inv.application?.job?.title,
        uiState,
        score,
        aprobado,
        tiempo,
        anticheat,
        fecha,
      ]
        .map(csvEscape)
        .join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="evaluaciones.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[GET /api/dashboard/assessments/export] ERROR", e);
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
  }
}
