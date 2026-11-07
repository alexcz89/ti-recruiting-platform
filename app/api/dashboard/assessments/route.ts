// app/api/dashboard/assessments/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import { isFinalAttemptStatus } from "@/lib/assessments/expiration";
import { parseAssessmentFilters, selectAssessmentPage } from "@/lib/assessments/dashboard-page-query";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// GET /api/dashboard/assessments?q=&jobId=&state=&hasAttempt=&page=
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as any;
    const role = String(user?.role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") return jsonNoStore({ error: "Forbidden" }, 403);

    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId && role !== "ADMIN") return jsonNoStore({ error: "Sin empresa asociada" }, 403);

    const url = new URL(request.url);
    const { q, jobId, state, hasAttempt, sort } = parseAssessmentFilters(url.searchParams);
    const page = clampInt(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1, 9999);

    const take = 50;
    const now = new Date();

    const jobWhere = role === "ADMIN"
      ? {}
      : { companyId: companyId as string };

    const applicationJobWhere = {
      ...jobWhere,
      ...(jobId ? { id: jobId } : {}),
    };

    // Filter, sort and paginate globally before loading page details.
    const [jobs, selection] = await Promise.all([
      prisma.job.findMany({
        where: jobWhere,
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      selectAssessmentPage({
        companyId,
        isAdmin: role === "ADMIN",
        q,
        jobId,
        state,
        hasAttempt,
        sort,
        page,
        take,
        now,
      }),
    ]);

    const total = selection.total;
    const totalPages = Math.max(1, Math.ceil(total / take));

    const inviteIds = selection.rows.map((row) => row.inviteId);

    const attemptIds = selection.rows.flatMap((row) =>
      row.attemptId ? [row.attemptId] : []
    );

    const [invites, attempts] = await Promise.all([
      prisma.assessmentInvite.findMany({
        where: {
          id: { in: inviteIds },
          application: { job: applicationJobWhere },
        },
        select: {
          id: true,
          status: true,
          token: true,
          sentAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,

          templateId: true,
          template: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              passingScore: true,
              timeLimit: true,
            },
          },

          candidateId: true,
          candidate: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          applicationId: true,
          application: {
            select: {
              id: true,
              job: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),

      prisma.assessmentAttempt.findMany({
        where: {
          id: { in: attemptIds },
        },
        select: {
          id: true,
          status: true,
          totalScore: true,
          passed: true,
          submittedAt: true,
          createdAt: true,
          startedAt: true,
          expiresAt: true,

          inviteId: true,
          applicationId: true,
          templateId: true,
          candidateId: true,

          severity: true,
          severityScore: true,
          multiSession: true,
        },
      }),
    ]);

    const inviteById = new Map(
      invites.map((inv) => [inv.id, inv])
    );

    const attemptById = new Map(
      attempts.map((attempt) => [attempt.id, attempt])
    );

    // Preserve the exact ordering and attempt selected by PostgreSQL.
    const rows = selection.rows.flatMap(
      ({ inviteId, attemptId, uiState }) => {
        const inv = inviteById.get(inviteId);

        if (!inv) return [];

        const attempt = attemptId
          ? attemptById.get(attemptId) ?? null
          : null;

        const resultsUrl =
          attempt && isFinalAttemptStatus(attempt.status)
            ? `/dashboard/assessments/attempts/${attempt.id}/results`
            : null;

        const templateIdStr = String(
          inv.template?.id ?? inv.templateId ?? ""
        );

        const token = String(inv.token ?? "");

        const inviteLink =
          templateIdStr && token
            ? `/assessments/${encodeURIComponent(templateIdStr)}?token=${encodeURIComponent(token)}`
            : null;

        return [{
          inv,
          attempt,
          uiState,
          resultsUrl,
          inviteLink,
        }];
      }
    );

    return jsonNoStore({
      ok: true,
      page,
      take,
      total,
      totalPages,
      jobs,
      rows,
    });
  } catch (e) {
    console.error("[GET /api/dashboard/assessments] ERROR", e);
    return jsonNoStore({ error: "Error interno" }, 500);
  }
}
