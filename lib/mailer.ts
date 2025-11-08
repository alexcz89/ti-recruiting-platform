// lib/mailer.ts
import type { Resend } from "resend";

/**
 * Requisitos de entorno (.env):
 * - RESEND_API_KEY="re_xxx"                  // Solo si EMAIL_ENABLED=true
 * - RESEND_FROM="Bolsa TI <noreply@tu-dominio.com>"
 * - EMAIL_ENABLED="false" | "true"           // false => dry-run (no usa Resend)
 * - NEXT_PUBLIC_BASE_URL="http://localhost:3000"
 * - NEXT_PUBLIC_APP_NAME="Bolsa TI"
 */

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Bolsa TI";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED || "").toLowerCase() === "true";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM =
  process.env.RESEND_FROM || process.env.EMAIL_FROM || "Bolsa TI <noreply@example.com>";

// ⚠️ No instancies Resend globalmente si no vas a enviar emails reales.
let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!EMAIL_ENABLED) return null; // dry-run: no uses Resend
  if (!RESEND_API_KEY) return null; // sin API key -> no instanciar
  if (!resend) {
    // import dinámico para evitar require fallido
    const { Resend } = require("resend");
    resend = new Resend(RESEND_API_KEY);
  }
  return resend;
}

type SendResult =
  | { ok: true; id?: string }
  | { skipped: true }
  | { error: string };

/** Envío base con soporte DRY-RUN si EMAIL_ENABLED !== "true". */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<SendResult> {
  // Modo dry-run: imprime y no usa Resend
  if (!EMAIL_ENABLED) {
    if (process.env.NODE_ENV !== "production") {
      console.log("📨 [MAIL:DRYRUN]", {
        from: opts.from || RESEND_FROM,
        to: opts.to,
        subject: opts.subject,
      });
    }
    return { skipped: true };
  }

  // Modo real: requiere API key y from
  if (!RESEND_API_KEY) return { error: "Missing RESEND_API_KEY" };
  if (!RESEND_FROM && !opts.from) return { error: "Missing RESEND_FROM" };

  const client = getResend();
  if (!client) return { error: "Email client not initialized" };

  try {
    const { data, error } = await client.emails.send({
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

/** Correo de verificación simple (wrapper) */
export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const subject = `Verifica tu correo — ${APP_NAME}`;
  const html = htmlLayout({
    title: subject,
    body: `
      <p>Hola,</p>
      <p>Para activar tu cuenta en <strong>${escapeHtml(APP_NAME)}</strong>, verifica tu correo:</p>
      <p><a href="${verifyUrl}" target="_blank" rel="noreferrer">Verificar mi correo</a></p>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">Si no solicitaste este registro, ignora este mensaje.</p>
    `,
  });
  const text =
    `Verifica tu correo en ${APP_NAME}:\n${verifyUrl}\n\n` +
    `Si no solicitaste este registro, puedes ignorar este mensaje.`;

  return sendEmail({ to, subject, html, text });
}

/* ====================== Otros templates ======================= */

export async function sendApplicationEmail(params: {
  to: string;
  candidateName?: string;
  jobTitle: string;
  companyName?: string;
  applicationId?: string;
}) {
  const subject = `Tu postulación a ${params.jobTitle}${
    params.companyName ? " — " + params.companyName : ""
  }`;

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

export async function sendNewMessageEmail(params: {
  to: string;
  recipientName?: string;
  fromName?: string;
  jobTitle: string;
  applicationId: string;
  preview?: string;
  isRecruiterRecipient?: boolean;
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
    `Tienes un nuevo mensaje de ${params.fromName || "contacto"} sobre la vacante ${
      params.jobTitle
    }.\n\n` +
    (params.preview ? `“${truncate(params.preview, 200)}”\n\n` : "") +
    `Responder: ${url}\n\n` +
    `Equipo ${APP_NAME}`;

  return sendEmail({ to: params.to, subject, html, text });
}

export async function sendRejectionEmail(params: {
  to: string;
  candidateName?: string;
  jobTitle: string;
  companyName?: string;
}) {
  const subject = `Resultado de tu candidatura — ${params.jobTitle}${
    params.companyName ? " · " + params.companyName : ""
  }`;

  const html = htmlLayout({
    title: subject,
    body: `
      <p>Hola ${escapeHtml(params.candidateName || "candidato/a")},</p>
      <p>Gracias por tu interés en <strong>${escapeHtml(params.jobTitle)}</strong>${
        params.companyName ? ` en <strong>${escapeHtml(params.companyName)}</strong>` : ""
      }.</p>
      <p>Tras una cuidadosa revisión, no avanzaremos con tu candidatura en este momento.</p>
      <p>¡Te deseamos éxito en tu búsqueda y esperamos verte en futuras vacantes!</p>
      <hr />
      <p>Equipo ${escapeHtml(APP_NAME)}</p>
    `,
  });

  const text =
    `Hola ${params.candidateName || "candidato/a"},\n\n` +
    `Gracias por tu interés en ${params.jobTitle}${
      params.companyName ? ` en ${params.companyName}` : ""
    }.\n` +
    `Tras una revisión, no avanzaremos con tu candidatura en este momento.\n\n` +
    `Éxito en tu búsqueda.\n\nEquipo ${APP_NAME}`;

  return sendEmail({ to: params.to, subject, html, text });
}

/* ====================== helpers ======================= */

function htmlLayout({ title, body }: { title: string; body: string }) {
  return `<!doctype html>
<html>
  <head><meta charSet="utf-8" /><title>${escapeHtml(title)}</title></head>
  <body style="background:#f8fafc;margin:0;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica Neue,Arial;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:white;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;">
          <h1 style="font-size:18px;margin:0 0 8px 0;">${escapeHtml(APP_NAME)}</h1>
          <div style="color:#111827;font-size:14px;line-height:1.6;">${body}</div>
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
