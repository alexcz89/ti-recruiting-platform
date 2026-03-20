// app/api/cron/rejections/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { sendRejectionEmail } from "@/lib/server/mailer";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 5 * DAY_MS;

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function authOk(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const headerSecret = req.headers.get("x-cron-secret");
  return headerSecret === secret;
}

export async function GET(req: Request) {
  if (!authOk(req)) {
    return jsonNoStore({ error: "Unauthorized" }, 401);
  }

  const cutoff = new Date(Date.now() - LOOKBACK_MS);

  try {
    const pending = await prisma.application.findMany({
      where: {
        status: "REJECTED",
        rejectionEmailSent: false,
        rejectedAt: { lte: cutoff },
      },
      take: 100,
      select: {
        id: true,
        rejectedAt: true,
        job: { select: { title: true, company: { select: { name: true } } } },
        candidate: { select: { email: true, name: true } },
      },
    });

    const results: Array<{ id: string; ok?: true; skipped?: true; error?: string }> = [];

    for (const app of pending) {
      const to = app.candidate?.email;
      const candidateName = app.candidate?.name || "";
      const jobTitle = app.job?.title || "la vacante";
      const companyName = app.job?.company?.name || undefined;

      if (!to) {
        results.push({ id: app.id, error: "Sin email del candidato" });
        continue;
      }

      try {
        const claim = await prisma.application.updateMany({
          where: {
            id: app.id,
            rejectionEmailSent: false,
          },
          data: {},
        });

        if (claim.count === 0) {
          results.push({ id: app.id, skipped: true });
          continue;
        }

        const r = await sendRejectionEmail({
          to,
          candidateName,
          jobTitle,
          companyName,
        });

        if ("ok" in r && r.ok) {
          await prisma.application.update({
            where: { id: app.id },
            data: { rejectionEmailSent: true },
          });
          results.push({ id: app.id, ok: true });
        } else if ("skipped" in r && r.skipped) {
          results.push({ id: app.id, skipped: true });
        } else {
          const error =
            typeof r === "object" &&
            r !== null &&
            "error" in r &&
            typeof r.error === "string"
              ? r.error
              : "send failed";

          results.push({ id: app.id, error });
        }
      } catch (e: unknown) {
        results.push({
          id: app.id,
          error: e instanceof Error ? e.message : "send failed",
        });
      }
    }

    return jsonNoStore({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (e: unknown) {
    console.error("[/api/cron/rejections] error", e);
    return jsonNoStore(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Internal error",
      },
      500
    );
  }
}