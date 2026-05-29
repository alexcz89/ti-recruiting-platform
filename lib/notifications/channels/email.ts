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

    // ── Template rico para evaluación completada (notificación al reclutador) ──
    case 'ASSESSMENT_COMPLETED': {
      const absoluteUrl = notification.actionUrl
        ? `${BASE_URL}${notification.actionUrl}`
        : `${BASE_URL}/dashboard/assessments`;

      const html = buildAssessmentCompletedEmailHtml({
        recruiterName: user.name ?? undefined,
        candidateName: metadata.candidateName || 'Candidato',
        jobTitle: metadata.jobTitle || '',
        score: typeof metadata.score === 'number' ? metadata.score : null,
        passed: typeof metadata.passed === 'boolean' ? metadata.passed : null,
        resultsUrl: absoluteUrl,
      });

      const text = [
        `${metadata.candidateName || 'Un candidato'} completó su evaluación`,
        `Vacante: ${metadata.jobTitle || ''}`,
        typeof metadata.score === 'number' ? `Puntuación: ${Math.round(metadata.score)}%` : '',
        `Ver resultados: ${absoluteUrl}`,
        '',
        'Correo automático de TaskIO.',
      ].filter(Boolean).join('\n');

      await sendEmail({ to: user.email, subject, html, text });
      return;
    }

    // ── Template de rechazo de postulación ──
    case 'APPLICATION_STATUS_CHANGE': {
      const absoluteUrl = `${BASE_URL}/profile/applications`;
      const html = buildRejectionEmailHtml({
        candidateName: metadata.candidateName || undefined,
        jobTitle: metadata.jobTitle || '',
        applicationsUrl: absoluteUrl,
      });

      const text = [
        `Hola${metadata.candidateName ? ` ${metadata.candidateName}` : ''},`,
        '',
        `Gracias por tu interés en la posición de ${metadata.jobTitle || 'la vacante'} y por el tiempo que dedicaste a tu postulación.`,
        '',
        'Después de revisar cuidadosamente todos los perfiles, hemos decidido continuar el proceso con otros candidatos cuyo perfil se ajusta mejor a los requerimientos actuales.',
        '',
        'Te agradecemos sinceramente tu participación y te animamos a estar atento a futuras oportunidades.',
        '',
        '¡Mucho éxito en tu búsqueda!',
        '',
        'El equipo de TaskIO',
      ].join('\n');

      await sendEmail({ to: user.email, subject, html, text });
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

/* ─── HTML genérico con logo TaskIO (para todos los tipos excepto los que tienen template propio) ─── */

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
              <img src="https://taskio.com.mx/TASKIO.png" alt="TaskIO" width="130" height="auto" style="display:block;border:0;max-width:130px;" />
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

/* ─── Template rico para ASSESSMENT_COMPLETED ─── */

function buildAssessmentCompletedEmailHtml(params: {
  recruiterName?: string;
  candidateName: string;
  jobTitle: string;
  score?: number | null;
  passed?: boolean | null;
  resultsUrl: string;
}): string {
  const safeRecruiter = params.recruiterName ? escapeHtml(params.recruiterName) : '';
  const safeCandidate = escapeHtml(params.candidateName);
  const safeJob = escapeHtml(params.jobTitle);
  const safeUrl = escapeHtml(params.resultsUrl);

  const initials = params.candidateName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  // Score badge (solo si existe)
  const scoreBadge =
    typeof params.score === 'number' && Number.isFinite(params.score)
      ? (() => {
          const pct = Math.round(params.score);
          const color =
            params.passed === true
              ? '#10b981'
              : params.passed === false
              ? '#ef4444'
              : '#f59e0b';
          const label = params.passed === true ? 'Aprobado' : params.passed === false ? 'No aprobado' : 'Completado';
          return `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td style="padding-right:16px;vertical-align:middle;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="width:64px;height:64px;border-radius:50%;background:${color}1a;border:2px solid ${color};text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;font-weight:800;color:${color};line-height:60px;">${pct}%</span>
                  </td>
                </tr></table>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-size:13px;font-weight:600;color:${color};">${label}</p>
                <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Puntuación obtenida</p>
              </td>
            </tr>
          </table>`;
        })()
      : '';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Evaluación completada</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="https://taskio.com.mx/TASKIO.png" alt="TaskIO" width="130" height="auto" style="display:block;border:0;max-width:130px;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;">

              <!-- Header violeta -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:22px 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="vertical-align:middle;padding-right:10px;font-size:24px;line-height:1;">📊</td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;">Evaluación completada</p>
                        <p style="margin:2px 0 0;font-size:12px;color:#ddd6fe;">${safeJob}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:28px 28px 0;">

                  ${safeRecruiter ? `<p style="margin:0 0 20px;font-size:14px;color:#374151;">Hola <strong>${safeRecruiter}</strong>,</p>` : ''}

                  <!-- Candidato card -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:20px;">
                    <tr><td style="padding:16px 18px;">
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td style="vertical-align:middle;padding-right:14px;">
                          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                            <td style="width:44px;height:44px;border-radius:50%;background:#7c3aed;text-align:center;vertical-align:middle;font-size:15px;font-weight:700;color:#ffffff;line-height:44px;">${initials}</td>
                          </tr></table>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">${safeCandidate}</p>
                          <p style="margin:3px 0 0;font-size:12px;color:#6b7280;">completó su evaluación técnica</p>
                        </td>
                      </tr></table>
                    </td></tr>
                  </table>

                  <!-- Score badge (si aplica) -->
                  ${scoreBadge}

                  <!-- Vacante -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0;">
                    <tr>
                      <td style="padding:12px 16px;background:#f5f3ff;border-left:3px solid #7c3aed;border-radius:0 6px 6px 0;">
                        <p style="margin:0;font-size:11px;font-weight:600;color:#7c3aed;letter-spacing:.5px;text-transform:uppercase;">Vacante evaluada</p>
                        <p style="margin:3px 0 0;font-size:14px;font-weight:600;color:#4c1d95;">${safeJob}</p>
                      </td>
                    </tr>
                  </table>

                </td></tr>

                <!-- CTA -->
                <tr><td style="padding:24px 28px 28px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}" style="height:46px;v-text-anchor:middle;width:200px;" arcsize="22%" stroke="f" fillcolor="#7c3aed">
                    <w:anchorlock/><center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:700;">Ver resultados →</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${safeUrl}" target="_blank" rel="noreferrer"
                    style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 28px;border-radius:9px;">
                    Ver resultados →
                  </a>
                  <!--<![endif]-->
                </td></tr>

                <!-- Nota footer -->
                <tr><td style="padding:0 28px 24px;border-top:1px solid #f4f4f5;">
                  <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
                    Correo automático de TaskIO. Ajusta tus preferencias en
                    <a href="${escapeHtml(BASE_URL)}/dashboard/notifications/preferences" style="color:#7c3aed;text-decoration:none;">tu perfil</a>.
                  </p>
                </td></tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr><td align="center" style="padding:24px 0 8px;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">
              © ${new Date().getFullYear()} TaskIO —
              <a href="${escapeHtml(BASE_URL)}" style="color:#a1a1aa;text-decoration:underline;">taskio.com.mx</a>
            </p>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/* ─── Template de rechazo de postulación ─── */

function buildRejectionEmailHtml(params: {
  candidateName?: string;
  jobTitle: string;
  applicationsUrl: string;
}): string {
  const safeName    = params.candidateName ? escapeHtml(params.candidateName) : '';
  const safeJob     = escapeHtml(params.jobTitle);
  const safeUrl     = escapeHtml(params.applicationsUrl);
  const greeting    = safeName ? `Hola <strong>${safeName}</strong>,` : 'Hola,';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Actualización sobre tu postulación</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img src="https://taskio.com.mx/TASKIO.png" alt="TaskIO" width="130" height="auto" style="display:block;border:0;max-width:130px;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:14px;border:1px solid #e4e4e7;padding:32px 36px;">

              <!-- Vacante -->
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:#9ca3af;">Postulación</p>
              <h2 style="margin:0 0 24px;font-size:18px;font-weight:700;color:#0f172a;">${safeJob}</h2>

              <!-- Saludo -->
              <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">${greeting}</p>

              <!-- Cuerpo -->
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.8;">
                Gracias por tu interés en esta posición y por el tiempo que dedicaste a tu postulación.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.8;">
                Después de revisar cuidadosamente todos los perfiles, hemos decidido continuar el proceso con otros candidatos cuyo perfil se ajusta mejor a los requerimientos actuales.
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#4b5563;line-height:1.8;">
                Te agradecemos sinceramente tu participación y te animamos a estar atento a futuras oportunidades en nuestra plataforma. ¡Mucho éxito en tu búsqueda!
              </p>

              <!-- CTA -->
              <a href="${safeUrl}"
                 style="display:inline-block;padding:12px 24px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                Ver mis postulaciones
              </a>

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