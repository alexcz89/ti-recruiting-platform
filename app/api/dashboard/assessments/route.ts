// app/api/dashboard/assessments/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StateFilter = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "INACTIVE";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeState(s: string | null): StateFilter {
  const v = String(s ?? "").toUpperCase();
  if (v === "PENDING") return "PENDING";
  if (v === "IN_PROGRESS") return "IN_PROGRESS";
  if (v === "COMPLETED") return "COMPLETED";
  if (v === "INACTIVE") return "INACTIVE";
  return "ALL";
}

function pickUiState(inv: any, attempt: any, now: Date): Exclude<StateFilter, "ALL"> {
  const invStatus = String(inv?.status ?? "").toUpperCase();
  const atStatus = String(attempt?.status ?? "").toUpperCase();

  // ✅ attempt final manda
  if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(atStatus)) return "COMPLETED";

  // ✅ si hay attempt pero ya expiró, se vuelve INACTIVE (aunque diga IN_PROGRESS)
  if (attempt?.expiresAt && new Date(attempt.expiresAt) <= now) return "INACTIVE";

  // ✅ attempt activo
  if (["IN_PROGRESS", "NOT_STARTED"].includes(atStatus)) return "IN_PROGRESS";

  // Sin attempt: invite manda
  if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(invStatus)) return "COMPLETED";
  if (invStatus === "STARTED") return "IN_PROGRESS";
  if (["CANCELLED", "REVOKED"].includes(invStatus)) return "INACTIVE";
  if (inv?.expiresAt && new Date(inv.expiresAt) <= now) return "INACTIVE";

  return "PENDING";
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
    const q = (url.searchParams.get("q") ?? "").trim();
    const jobId = (url.searchParams.get("jobId") ?? "").trim();
    const state = normalizeState(url.searchParams.get("state"));
    const hasAttempt = (url.searchParams.get("hasAttempt") ?? "").trim(); // "1" | "0" | ""
    const page = clampInt(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1, 9999);

    const take = 50;
    const skip = (page - 1) * take;
    const now = new Date();

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: { companyId: companyId as any },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.assessmentInvite.count({
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
      }),
    ]);

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
        sentAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,

        templateId: true,
        template: { select: { id: true, title: true, difficulty: true, passingScore: true, timeLimit: true } },

        candidateId: true,
        candidate: { select: { id: true, name: true, email: true } },

        applicationId: true,
        application: {
          select: {
            id: true,
            job: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    });

    const inviteIds = invites.map((i) => i.id);
    const pairs = invites
      .map((inv) => ({
        applicationId: inv.applicationId,
        templateId: inv.templateId,
        candidateId: inv.candidateId,
      }))
      .filter((p) => p.applicationId && p.templateId && p.candidateId);

    // Trae attempts por:
    // A) inviteId IN (ideal)
    // B) fallback por pares exactos (applicationId+templateId+candidateId) para casos donde inviteId se nulificó por reset
    const attempts = inviteIds.length || pairs.length
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
          orderBy: { createdAt: "desc" },
          take: 1500,
        })
      : [];

    const attemptByInviteId = new Map<string, any>();
    const attemptByKey = new Map<string, any>();

    for (const a of attempts) {
      if (a.inviteId && !attemptByInviteId.has(String(a.inviteId))) {
        attemptByInviteId.set(String(a.inviteId), a);
      }
      const key = `${String(a.applicationId)}::${String(a.templateId)}::${String(a.candidateId)}`;
      if (!attemptByKey.has(key)) attemptByKey.set(key, a);
    }

    const rowsAll = invites.map((inv) => {
      const attempt =
        attemptByInviteId.get(String(inv.id)) ||
        attemptByKey.get(`${String(inv.applicationId)}::${String(inv.templateId)}::${String(inv.candidateId)}`) ||
        null;

      const uiState = pickUiState(inv, attempt, now);

      const attemptFinal =
        attempt && ["SUBMITTED", "EVALUATED", "COMPLETED"].includes(String(attempt.status ?? "").toUpperCase());

      const resultsUrl = attemptFinal ? `/assessments/attempts/${attempt.id}/results` : null;

      const templateIdStr = String(inv.template?.id ?? inv.templateId ?? "");
      const token = String(inv.token ?? "");
      const inviteLink =
        templateIdStr && token
          ? `/assessments/${encodeURIComponent(templateIdStr)}?token=${encodeURIComponent(token)}`
          : null;

      return { inv, attempt, uiState, resultsUrl, inviteLink };
    });

    const rows = rowsAll.filter((r) => {
      if (hasAttempt === "1" && !r.attempt) return false;
      if (hasAttempt === "0" && r.attempt) return false;
      if (state !== "ALL" && r.uiState !== state) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(total / take));

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
