
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { sendRejectionEmail } from "@/lib/server/mailer";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 3 * DAY_MS;
const LEASE_MS = 10 * 60 * 1000;

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

  // Exactamente 72 horas desde la última entrada a Rechazado.
  const cutoff = new Date(Date.now() - LOOKBACK_MS);

  try {
    const pending = await prisma.application.findMany({
      where: {
        status: "REJECTED",
        rejectionEmailSent: false,
        rejectionEmailAttemptStartedAt: null,
        rejectedAt: { lte: cutoff },
        OR: [
          { stage: null, disposition: null },
          { stage: "CLOSED", disposition: "REJECTED" },
        ],
      },
      take: 100,
      select: {
        id: true,
        rejectedAt: true,
        stateVersion: true,
        job: {
          select: {
            title: true,
            company: {
              select: { name: true },
            },
          },
        },
        candidate: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    const results: Array<{
      id: string;
      ok?: true;
      skipped?: true;
      error?: string;
    }> = [];

    for (const app of pending) {
      const to = app.candidate?.email;
      const candidateName = app.candidate?.name || "";
      const jobTitle = app.job?.title || "la vacante";
      const companyName = app.job?.company?.name || undefined;

      if (!to) {
        results.push({
          id: app.id,
          error: "Sin email del candidato",
        });
        continue;
      }

      // El periodo de rechazo debe estar identificado.
      if (!app.rejectedAt) {
        results.push({
          id: app.id,
          error: "Sin fecha de rechazo",
        });
        continue;
      }

      try {
        // 1. Crear una reserva exclusiva y temporal.
        const leaseToken = randomUUID();
        const now = new Date();
        const leaseUntil = new Date(now.getTime() + LEASE_MS);

        const claim = await prisma.application.updateMany({
          where: {
            id: app.id,
            stateVersion: app.stateVersion,
            status: "REJECTED",
            rejectedAt: app.rejectedAt,
            rejectionEmailSent: false,
            rejectionEmailAttemptStartedAt: null,

            // Permitir registros legacy válidos y canónicos.
            OR: [
              { stage: null, disposition: null },
              { stage: "CLOSED", disposition: "REJECTED" },
            ],

            // Solo se puede reclamar una reserva libre o vencida.
            AND: [
              {
                OR: [
                  { rejectionEmailLeaseUntil: null },
                  {
                    rejectionEmailLeaseUntil: {
                      lte: now,
                    },
                  },
                ],
              },
            ],
          },
          data: {
            rejectionEmailLeaseUntil: leaseUntil,
            rejectionEmailLeaseToken: leaseToken,
            rejectionEmailAttemptStartedAt: now,
          },
        });

        // Otra ejecución obtuvo la reserva, o cambió el estado.
        if (claim.count !== 1) {
          results.push({
            id: app.id,
            skipped: true,
          });
          continue;
        }

        let leaseFinalized = false;
        let safeToRetry = false;

        try {
          // 2. Enviar usando una clave propia del periodo de rechazo.
          const r = await sendRejectionEmail({
            applicationId: app.id,
            rejectedAt: app.rejectedAt,
            to,
            candidateName,
            jobTitle,
            companyName,
          });

          if ("ok" in r && r.ok) {
            // 3. Confirmar el envío únicamente si:
            // - sigue siendo el mismo periodo de rechazo;
            // - el estado y versión no cambiaron;
            // - esta ejecución conserva el token.
            const finalized = await prisma.application.updateMany({
              where: {
                id: app.id,
                stateVersion: app.stateVersion,
                status: "REJECTED",
                rejectionEmailSent: false,
                rejectedAt: app.rejectedAt,
                rejectionEmailLeaseToken: leaseToken,
                OR: [
                  { stage: null, disposition: null },
                  { stage: "CLOSED", disposition: "REJECTED" },
                ],
              },
              data: {
                rejectionEmailSent: true,
                rejectionEmailLeaseUntil: null,
                rejectionEmailLeaseToken: null,
              },
            });

            if (finalized.count !== 1) {
              results.push({
                id: app.id,
                error:
                  "Correo aceptado, pero no se pudo confirmar el estado de la candidatura",
              });
              continue;
            }

            leaseFinalized = true;

            results.push({
              id: app.id,
              ok: true,
            });
          } else if ("skipped" in r && r.skipped) {
            safeToRetry = true;

            results.push({
              id: app.id,
              skipped: true,
            });
          } else {
            const error =
              typeof r === "object" &&
              r !== null &&
              "error" in r &&
              typeof r.error === "string"
                ? r.error
                : "send failed";

              // Un error del proveedor no garantiza que el correo no fue aceptado.
              // Conservar el intento para evitar duplicados.
              safeToRetry = false;

            results.push({
              id: app.id,
              error,
            });
          }
        } finally {
          // 4. Si no hubo confirmación, liberar la reserva.
          // El token impide liberar una reserva de otra ejecución.
          if (!leaseFinalized) {
            try {
              await prisma.application.updateMany({
                where: {
                  id: app.id,
                  rejectionEmailLeaseToken: leaseToken,
                },
                data: {
                  rejectionEmailLeaseUntil: null,
                  rejectionEmailLeaseToken: null,
                  ...(safeToRetry
                    ? { rejectionEmailAttemptStartedAt: null }
                    : {}),
                },
              });
            } catch (releaseError) {
              // Si falla la liberación, la reserva podrá
              // recuperarse después de su vencimiento.
              console.error(
                "[cron/rejections] No se pudo liberar la reserva",
                app.id,
                releaseError,
              );
            }
          }
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
      500,
    );
  }
}
