// lib/notifications/channels/email.ts
// Email delivery channel for notifications

import type { Notification } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import {
  sendEmail,
  sendNewApplicationToRecruiterEmail,
} from '@/lib/server/mailer';
import { NOTIFICATION_TEMPLATES } from '../templates';

// ✅ BUG FIX: misma lógica que mailer.ts para resolver BASE_URL
// NEXT_PUBLIC_APP_URL puede ser undefined en el servidor → "undefined/dashboard/..."
function resolveBaseUrl(): string {
  const env =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL;

  if (env) {
    const withProto = env.startsWith("http") ? env : `https://${env}`;
    return withProto.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

const BASE_URL = resolveBaseUrl();

/**
 * Send email notification.
 * Para NEW_APPLICATION usa el template pro con logo y diseño de TaskIO.
 * Para el resto usa el htmlLayout genérico (también con logo).
 */
export async function sendEmailNotification(
  notification: Notification,
  deliveryId: string
): Promise<void> {
  // 1. Obtener email del usuario
  const user = await prisma.user.findUnique({
    where: { id: notification.userId },
    select: { email: true, name: true },
  });

  if (!user?.email) {
    throw new Error('User not found or no email');
  }

  // 2. Obtener template
  const template = NOTIFICATION_TEMPLATES[notification.type];
  if (!template) {
    throw new Error(`No template found for ${notification.type}`);
  }

  const metadata = notification.metadata as any;
  const subject = template.emailSubject(metadata);

  // 3. Actualizar delivery record
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      emailTo: user.email,
      emailSubject: subject,
    },
  });

  // 4. ✅ Despachar al template correcto según el tipo
  switch (notification.type) {

    // ── Template pro para nueva aplicación al reclutador ──
    case 'NEW_APPLICATION': {
      await sendNewApplicationToRecruiterEmail({
        to: user.email,
        recruiterName: user.name ?? undefined,
        candidateName: metadata.candidateName || 'Candidato',
        candidateEmail: metadata.candidateEmail ?? undefined,
        jobTitle: metadata.jobTitle || '',
        jobId: metadata.jobId || '',
        applicationId: metadata.applicationId || '',
        coverLetterPreview: metadata.coverLetterPreview ?? undefined,
      });
      return;
    }

    // ── Fallback: todos los demás tipos usan el layout genérico ──
    default: {
      // ✅ BUG FIX: usa BASE_URL en lugar de process.env.NEXT_PUBLIC_APP_URL
      const absoluteUrl = notification.actionUrl
        ? `${BASE_URL}${notification.actionUrl}`
        : null;

      const actionButton = absoluteUrl
        ? `<a href="${escapeHtml(absoluteUrl)}"
             style="display:inline-block;padding:12px 24px;background:#10b981;
                    color:#ffffff;text-decoration:none;border-radius:8px;
                    font-size:14px;font-weight:600;margin:20px 0;">
             ${escapeHtml(notification.actionText || 'Ver detalles')}
           </a>`
        : '';

      const html = buildGenericEmailHtml({
        title: notification.title,
        message: notification.message,
        actionButton,
      });

      const text = [
        notification.title,
        '',
        notification.message,
        absoluteUrl ? `\nVer más: ${absoluteUrl}` : '',
        '',
        'Este es un correo automático de TaskIO.',
      ].join('\n').trim();

      await sendEmail({ to: user.email, subject, html, text });
      return;
    }
  }
}

/* ─── HTML genérico con logo TaskIO (para todos los tipos excepto NEW_APPLICATION) ─── */

function buildGenericEmailHtml({
  title,
  message,
  actionButton,
}: {
  title: string;
  message: string;
  actionButton: string;
}): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="background-color:#10b981;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                  <span style="display:block;font-size:20px;font-weight:700;color:#ffffff;line-height:36px;">+</span>
                </td>
                <td style="padding-left:10px;vertical-align:middle;white-space:nowrap;">
                  <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;">TASK</span><span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#7c3aed;">IO</span>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:14px;border:1px solid #e4e4e7;padding:32px 36px;">

              <!-- Title -->
              <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(title)}</h2>

              <!-- Message -->
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.7;">${escapeHtml(message)}</p>

              <!-- CTA -->
              ${actionButton}

              <!-- Footer note -->
              <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #f4f4f5;font-size:12px;color:#9ca3af;line-height:1.6;">
                Correo automático de TaskIO. Ajusta tus preferencias en
                <a href="${escapeHtml(BASE_URL)}/dashboard/notifications/preferences" style="color:#7c3aed;text-decoration:none;">tu perfil</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 0 8px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                © ${new Date().getFullYear()} TaskIO —
                <a href="${escapeHtml(BASE_URL)}" style="color:#a1a1aa;text-decoration:underline;">taskio.com.mx</a>
              </p>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}