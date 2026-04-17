// app/api/billing/credits/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyIdOrThrow } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    const companyId = await getSessionCompanyIdOrThrow();

    // snapshot actual (rápido)
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        assessmentCredits: true,
      },
    });

    if (!company) {
      return json({ error: "Company not found" }, 404);
    }

    // invites activos (no completados)
    const activeInvites = await prisma.assessmentInvite.count({
      where: {
        job: { companyId },
        status: { in: ["SENT", "STARTED"] },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    // attempts completados (consumo real)
    const completedAttempts = await prisma.assessmentAttempt.count({
      where: {
        invite: {
          job: {
            companyId,
          },
        },
        status: "COMPLETED",
      },
    });

    return json({
      snapshot: {
        available: company.assessmentCredits ?? 0,
      },
      derived: {
        activeInvites,
        completedAttempts,
      },
    });
  } catch (err) {
    console.error("[GET /api/billing/credits]", err);
    return json({ error: "Internal error" }, 500);
  }
}