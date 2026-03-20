// app/api/candidate/assessment-invites/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type UiState = "COMPLETED" | "IN_PROGRESS" | "EXPIRED" | "CANCELLED" | "PENDING";

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

type InviteRow = {
  id: string;
  status: string | null;
  expiresAt: Date | null;
  templateId: string | null;
  applicationId: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AttemptRow = {
  id: string;
  status: string | null;
  applicationId: string | null;
  templateId: string | null;
  inviteId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
};

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function pickUiState(inv: InviteRow, attempt: AttemptRow | null, now: Date): UiState {
  const invStatus = String(inv.status ?? "").toUpperCase();
  const atStatus = String(attempt?.status ?? "").toUpperCase();

  if (attempt?.expiresAt && new Date(attempt.expiresAt) <= now) return "EXPIRED";

  if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(atStatus)) return "COMPLETED";
  if (["IN_PROGRESS"].includes(atStatus)) return "IN_PROGRESS";
  if (["NOT_STARTED"].includes(atStatus)) {
    if (invStatus === "STARTED") return "IN_PROGRESS";
    return "PENDING";
  }

  if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(invStatus)) return "COMPLETED";
  if (inv.expiresAt && new Date(inv.expiresAt) <= now) return "EXPIRED";
  if (invStatus === "CANCELLED") return "CANCELLED";
  if (invStatus === "STARTED") return "IN_PROGRESS";

  return "PENDING";
}

// GET /api/candidate/assessment-invites
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as SessionUser;
    const userId = String(user.id || "");
    const role = String(user.role ?? "").toUpperCase();

    if (!userId) return jsonNoStore({ error: "No autorizado" }, 401);
    if (role !== "CANDIDATE") return jsonNoStore({ error: "Forbidden" }, 403);

    const now = new Date();
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    const invitesRaw = await prisma.assessmentInvite.findMany({
      where: { candidateId: userId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        templateId: true,
        applicationId: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    if (!invitesRaw.length) {
      const empty = {
        counts: { pending: 0, inProgress: 0, completed: 0, inactive: 0 },
        total: 0,
        badge: 0,
      };
      return mode === "count" ? jsonNoStore({ badge: 0 }) : jsonNoStore(empty);
    }

    const inviteByKey = new Map<string, InviteRow>();
    for (const inv of invitesRaw) {
      const appId = String(inv.applicationId || "");
      const tplId = String(inv.templateId || "");
      if (!appId || !tplId) continue;

      const key = `${appId}::${tplId}`;
      if (!inviteByKey.has(key)) {
        inviteByKey.set(key, inv);
      }
    }

    const invites = Array.from(inviteByKey.values());
    const inviteIds = invites.map((i) => i.id);

    const pairOr: Prisma.AssessmentAttemptWhereInput[] = invites
      .filter(
        (i): i is InviteRow & { applicationId: string; templateId: string } =>
          typeof i.applicationId === "string" &&
          i.applicationId.length > 0 &&
          typeof i.templateId === "string" &&
          i.templateId.length > 0
      )
      .map((i) => ({
        applicationId: i.applicationId,
        templateId: i.templateId,
        candidateId: userId,
      }));

    const orClauses: Prisma.AssessmentAttemptWhereInput[] = [
      ...(inviteIds.length ? [{ inviteId: { in: inviteIds } }] : []),
      ...pairOr,
    ];

    const attempts =
      orClauses.length > 0
        ? await prisma.assessmentAttempt.findMany({
            where: {
              candidateId: userId,
              OR: orClauses,
            },
            select: {
              id: true,
              status: true,
              applicationId: true,
              templateId: true,
              inviteId: true,
              expiresAt: true,
              createdAt: true,
            },
            orderBy: { updatedAt: "desc" },
            take: 1500,
          })
        : [];

    const attemptByInviteId = new Map<string, AttemptRow>();
    const attemptByKey = new Map<string, AttemptRow>();

    for (const a of attempts) {
      if (a.inviteId && !attemptByInviteId.has(String(a.inviteId))) {
        attemptByInviteId.set(String(a.inviteId), a);
      }

      if (a.applicationId && a.templateId) {
        const key = `${String(a.applicationId)}::${String(a.templateId)}`;
        if (!attemptByKey.has(key)) {
          attemptByKey.set(key, a);
        }
      }
    }

    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let inactive = 0;

    for (const inv of invites) {
      const key = `${String(inv.applicationId)}::${String(inv.templateId)}`;
      const attempt =
        attemptByInviteId.get(String(inv.id)) || attemptByKey.get(key) || null;

      if (process.env.NODE_ENV !== "production") {
        const attemptExpires = attempt?.expiresAt ? new Date(attempt.expiresAt) : null;
        const attemptExpired = Boolean(attemptExpires && attemptExpires <= now);

        console.log("[INVITE_STATE]", {
          key,
          inviteId: inv.id,
          invStatus: String(inv.status ?? "").toUpperCase(),
          invExpiresAt: inv.expiresAt,
          attemptId: attempt?.id ?? null,
          atStatus: String(attempt?.status ?? "").toUpperCase(),
          atExpiresAt: attempt?.expiresAt ?? null,
          attemptExpired,
          pickedState: pickUiState(inv, attempt, now),
        });
      }

      const state = pickUiState(inv, attempt, now);

      if (state === "PENDING") pending += 1;
      else if (state === "IN_PROGRESS") inProgress += 1;
      else if (state === "COMPLETED") completed += 1;
      else inactive += 1;
    }

    const badge = pending + inProgress;

    if (mode === "count") {
      return jsonNoStore({ badge });
    }

    return jsonNoStore({
      counts: { pending, inProgress, completed, inactive },
      total: invites.length,
      badge,
    });
  } catch (e) {
    console.error("[GET /api/candidate/assessment-invites] ERROR", e);
    return jsonNoStore({ error: "Error interno" }, 500);
  }
}