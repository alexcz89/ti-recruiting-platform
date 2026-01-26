// lib/notifications/channels/email.ts
// Email delivery channel for notifications

import type { Notification } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { sendEmail } from '@/lib/server/mailer';
import { NOTIFICATION_TEMPLATES } from '../templates';

/**
 * Send email notification
 */
export async function sendEmailNotification(
  notification: Notification,
  deliveryId: string
): Promise<void> {
  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: notification.userId },
    select: { email: true, name: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get template
  const template = NOTIFICATION_TEMPLATES[notification.type];
  if (!template) {
    throw new Error(`No template found for ${notification.type}`);
  }

  const metadata = notification.metadata as any;
  const subject = template.emailSubject(metadata);

  // Update delivery record
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      emailTo: user.email,
      emailSubject: subject,
    },
  });

  // Build email HTML
  const actionButton = notification.actionUrl
    ? `<a href="${process.env.NEXT_PUBLIC_APP_URL}${notification.actionUrl}" 
         style="display: inline-block; padding: 12px 24px; background-color: #0070f3; 
                color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
         ${notification.actionText || 'Ver detalles'}
       </a>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0; color: #0070f3;">🔔 ${notification.title}</h2>
          </div>
          <div class="content">
            <p>${notification.message}</p>
            ${actionButton}
          </div>
          <div class="footer">
            <p>Este es un email automático de notificaciones. Puedes configurar tus preferencias en tu perfil.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
${notification.title}

${notification.message}

${notification.actionUrl ? `Ver más: ${process.env.NEXT_PUBLIC_APP_URL}${notification.actionUrl}` : ''}
  `.trim();

  // Send email - without 'template' field
  try {
    await sendEmail({
      to: user.email,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error('[Email] Failed to send notification:', error);
    throw error;
  }
}