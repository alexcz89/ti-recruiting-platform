// lib/mailer.ts
import { Resend } from "resend";

/**
 * Requisitos de entorno (.env):
 * - RESEND_API_KEY="re_xxx"                        // solo cuando quieras enviar correos reales
 * - RESEND_FROM="Bolsa TI <noreply@tu-dominio.com>"// en prod usa dominio verificado
 * - EMAIL_ENABLED="false"                          // "true" para enviar; "false"/vacío = dry-run
 * - NEXT_PUBLIC_BASE_URL="http://localhost:3000"
 * - NEXT_PUBLIC_APP_NAME="Bolsa TI"                // opcional
 *
 * Comportamiento:
 * - EMAIL_ENABLED !== "true"  -> DRY RUN (no envía, solo loguea)
 * - EMAIL_ENABLED === "true"  -> intenta enviar con Resend (requiere RESEND_API_KEY y RESEND_FROM)
 */

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Bolsa TI";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED || "").toLowerCase() === "true";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM =
  process.env.RESEND_FROM || process.env.EMAIL_FROM || "Bolsa TI <noreply@example.com>";

const resend = new Resend(RESEND_API_KEY);

type SendResult = { ok: true; id?: string } | { skipped: true } | { error: string };

/** Envío base con soporte de DRY-RUN si EMAIL_ENABLED !== "true". */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<SendResult> {
  // DRY RUN si no está habilitado
  if (!EMAIL_ENABLED) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[MAIL:DRYRUN]", {
        from: opts.from || RESEND_FROM,
        to: opts.to,
        subject: opts.subject,
      });
    }
    return { skipped: true };
  }

  // Validaciones mínimas para envío real
  if (!RESEND_API_KEY) return { error: "Missing RESEND_API_KEY" };
  if (!RESEND_FROM && !opts.from) return { error: "Missing RESEND_FROM" };

  try {
    const { data, error } = await resend.emails.send({
      from: opts.from || RESEND_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    if (error) return { error: error.message || "send failed" };
    return { ok: true, id: (data as any)?.id };
  } catch (e: any) {
    return { error: e?.message || "send failed" };
  }
}

/* ----------------------------------------------------------
 * 1) Postulación enviada (notifica al CANDIDATE)
 * -------------------------------------------------------- */
export async function sendApplicationSubmittedEmail(params: {
  to: string;              // email del candidato
  candidateName?: string;  // opcional
  jobTitle: string;
  companyName?: string;
  applicationId?: string;
}) {
  const subject = `Tu postulación a ${params.jobTitle}${
    params.companyName ? " — " + params.companyName : ""
  }`;

  // Llevamos al candidato a sus postulaciones (o resumen)
  const url = params.applicationId
    ? `${BASE_URL}/profile/applications`
    : `${BASE_URL}/profile/summary`;

  const html = htmlLayout({
    title: subject,
    body: `
      <p>¡Hola ${escapeHtml(params.candidateName || "candidato/a")}!</p>
      <p>Recibimos tu postulación a <strong>${escapeHtml(params.jobTitle)}</strong>${
        params.companyName ? ` en <strong>${escapeHtml(params.companyName)}</strong>` : ""
      }.</p>
      <p>Puedes dar seguimiento desde tu panel:</p>
      <p><a href="${url}" target="_blank" rel="noreferrer">Ver mis postulaciones</a></p>
      <hr />
      <p>Gracias por usar ${escapeHtml(APP_NAME)}.</p>
    `,
  });

  const text =
    `Hola ${params.candidateName || "candidato/a"},\n\n` +
    `Recibimos tu postulación a ${params.jobTitle}${
      params.companyName ? ` en ${params.companyName}` : ""
    }.\n` +
    `Sigue el estado en: ${url}\n\n` +
    `Gracias por usar ${APP_NAME}.`;

  return sendEmail({ to: params.to, subject, html, text });
}

/* ----------------------------------------------------------
 * 2) Nuevo mensaje en el hilo (notifica al destinatario)
 * -------------------------------------------------------- */
export async function sendNewMessageEmail(params: {
  to: string;               // email del destinatario
  recipientName?: string;
  fromName?: string;        // nombre del remitente
  jobTitle: string;
  applicationId: string;
  preview?: string;         // primeras ~200 chars del mensaje
  isRecruiterRecipient?: boolean; // para CTA adecuado
}) {
  const subject = `Nuevo mensaje sobre: ${params.jobTitle}`;
  const url = params.isRecruiterRecipient
    ? `${BASE_URL}/dashboard/messages?applicationId=${params.applicationId}`
    : `${BASE_URL}/profile/messages?applicationId=${params.applicationId}`;

  const safePreview = params.preview ? escapeHtml(truncate(params.preview, 200)) : "";
  const html = htmlLayout({
    title: subject,
    body: `
      <p>Hola ${escapeHtml(params.recipientName || "")}</p>
      <p>Tienes un nuevo mensaje de <strong>${escapeHtml(
        params.fromName || "contacto"
      )}</strong> sobre la vacante <strong>${escapeHtml(params.jobTitle)}</strong>.</p>
      ${
        safePreview
          ? `<blockquote style="margin:12px 0;padding-left:12px;border-left:3px solid #e5e7eb;color:#374151;">${safePreview}</blockquote>`
          : ""
      }
      <p>Abre el hilo para responder:</p>
      <p><a href="${url}" target="_blank" rel="noreferrer">Ir al chat</a></p>
      <hr />
      <p>Equipo ${escapeHtml(APP_NAME)}</p>
    `,
  });

  const text =
    `Tienes un nuevo mensaje de ${params.fromName || "contacto"} ` +
    `sobre la vacante ${params.jobTitle}.\n\n` +
    (params.preview ? `“${truncate(params.preview, 200)}”\n\n` : "") +
    `Responder: ${url}\n\n` +
    `Equipo ${APP_NAME}`;

  return sendEmail({ to: params.to, subject, html, text });
}

/* ----------------------------------------------------------
 * 3) Rechazo de candidatura (genérico)
 *    Úsalo cuando la app se mantuvo REJECTED por 5 días.
 * -------------------------------------------------------- */
export async function sendRejectionEmail(params: {
  to: string;              // email del candidato
  candidateName?: string;  // opcional
  jobTitle: string;
  companyName?: string;
}) {
  const subject = `Resultado de tu candidatura — ${params.jobTitle}${
    params.companyName ? " · " + params.companyName : ""
  }`;

  const bodyHtml = `
    <p>Hola ${escapeHtml(params.candidateName || "candidato/a")},</p>
    <p>Muchas gracias por tu tiempo y por tu interés en la vacante de <strong>${escapeHtml(
      params.jobTitle
    )}</strong>${params.companyName ? ` en <strong>${escapeHtml(params.companyName)}</strong>` : ""}.</p>
    <p>Hemos recibido un gran número de solicitudes y, tras una cuidadosa revisión, hemos decidido no seguir adelante con tu candidatura en este momento.</p>
    <p>Te deseamos mucho éxito en tu búsqueda de empleo y esperamos que puedas considerar nuestras futuras ofertas.</p>
    <hr />
    <p>Equipo ${escapeHtml(APP_NAME)}</p>
  `;

  const bodyText =
    `Hola ${params.candidateName || "candidato/a"},\n\n` +
    `Muchas gracias por tu tiempo y por tu interés en la vacante de ${params.jobTitle}${
      params.companyName ? ` en ${params.companyName}` : ""
    }.\n` +
    `Hemos recibido un gran número de solicitudes y, tras una cuidadosa revisión, ` +
    `hemos decidido no seguir adelante con tu candidatura en este momento.\n\n` +
    `Te deseamos mucho éxito en tu búsqueda de empleo y esperamos que puedas considerar ` +
    `nuestras futuras ofertas.\n\n` +
    `Equipo ${APP_NAME}`;

  const html = htmlLayout({ title: subject, body: bodyHtml });
  return sendEmail({ to: params.to, subject, html, text: bodyText });
}

/* ====================== helpers ======================= */

function htmlLayout({ title, body }: { title: string; body: string }) {
  return `<!doctype html>
<html>
  <head>
    <meta charSet="utf-8" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="background:#f8fafc;margin:0;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica Neue,Arial;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:white;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;">
          <h1 style="font-size:18px;margin:0 0 8px 0;">${escapeHtml(APP_NAME)}</h1>
          <div style="color:#111827;font-size:14px;line-height:1.6;">
            ${body}
          </div>
          <p style="margin-top:28px;color:#6b7280;font-size:12px;">© ${new Date().getFullYear()} ${escapeHtml(
            APP_NAME
          )} — Este correo fue enviado automáticamente.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
