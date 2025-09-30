// app/api/cron/rejections/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRejectionEmail } from "@/lib/mailer";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 5 * DAY_MS;

function authOk(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  // En dev, si no hay secret, permitimos ejecutar para pruebas locales
  if (!secret && process.env.NODE_ENV !== "production") return true;

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  const h = req.headers.get("x-cron-secret");
  return !!secret && (q === secret || h === secret);
}

export async function GET(req: Request) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - LOOKBACK_MS);

  // Búsqueda de apps rechazadas hace ≥ 5 días y sin email enviado
  const pending = await prisma.application.findMany({
    where: {
      status: "REJECTED",
      rejectionEmailSent: false,
      rejectedAt: { lte: cutoff },
    },
    take: 100, // ajusta si necesitas
    select: {
      id: true,
      rejectedAt: true,
      job: { select: { title: true, company: { select: { name: true } } } },
      candidate: { select: { email: true, name: true } },
    },
  });

  const results: Array<
    { id: string; ok?: true; skipped?: true; error?: string }
  > = [];

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
      const r = await sendRejectionEmail({ to, candidateName, jobTitle, companyName });

      if ("ok" in r && r.ok) {
        // Solo marcamos como enviado si realmente se envió
        await prisma.application.update({
          where: { id: app.id },
          data: { rejectionEmailSent: true },
        });
        results.push({ id: app.id, ok: true });
      } else if ("skipped" in r && r.skipped) {
        // Dry-run: no marcamos como enviado
        results.push({ id: app.id, skipped: true });
      } else {
        // Error retornado por el mailer
        results.push({ id: app.id, error: (r as any).error || "send failed" });
      }
    } catch (e: any) {
      results.push({ id: app.id, error: e?.message || "send failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
