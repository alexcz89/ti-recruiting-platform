import 'server-only';

// lib/server/mailer.ts
import type { Resend } from "resend";
import crypto from "crypto";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "TaskIO";

function resolveBaseUrl() {
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

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED || "").toLowerCase() === "true";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM =
  process.env.RESEND_FROM ||
  process.env.EMAIL_FROM ||
  "Taskio <noreply@taskio.com.mx>";

let resend: Resend | null = null;

async function getResend(): Promise<Resend | null> {
  if (!EMAIL_ENABLED) return null;
  if (!RESEND_API_KEY) return null;
  if (resend) return resend;

  const mod = await import("resend");
  const ResendCtor = (mod as any).Resend as new (key: string) => Resend;
  resend = new ResendCtor(RESEND_API_KEY);
  return resend;
}

export type SendResult =
  | { ok: true; id?: string }
  | { skipped: true }
  | { error: string };

function normalizeIdempotencyKey(key?: string) {
  if (!key) return undefined;
  const k = String(key).trim();
  if (!k) return undefined;
  if (k.length <= 256) return k;
  const hashed = `hash:${crypto.createHash("sha256").update(k).digest("hex")}`;
  return hashed.slice(0, 256);
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  dedupeKey?: string;
}): Promise<SendResult> {
  if (!EMAIL_ENABLED) {
    if (process.env.NODE_ENV !== "production") {
      console.log("📨 [MAIL:DRYRUN]", {
        from: opts.from || RESEND_FROM,
        to: opts.to,
        subject: opts.subject,
        dedupeKey: opts.dedupeKey ? normalizeIdempotencyKey(opts.dedupeKey) : undefined,
      });
    }
    return { skipped: true };
  }

  if (!RESEND_API_KEY) return { error: "Missing RESEND_API_KEY" };
  if (!RESEND_FROM && !opts.from) return { error: "Missing RESEND_FROM" };

  const client = await getResend();
  if (!client) return { error: "Email client not initialized" };

  const idempotencyKey = normalizeIdempotencyKey(opts.dedupeKey);

  const payload: any = {
    from: opts.from || RESEND_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  };

  try {
    const { data, error } = await (client.emails.send as any)(
      payload,
      idempotencyKey ? { idempotencyKey } : undefined
    );
    if (error) return { error: error.message || "send failed" };
    return { ok: true, id: (data as any)?.id };
  } catch (e1: any) {
    try {
      const { data, error } = await (client.emails.send as any)({
        ...payload,
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
      if (error) return { error: error.message || "send failed" };
      return { ok: true, id: (data as any)?.id };
    } catch (e2: any) {
      return { error: e2?.message || e1?.message || "send failed" };
    }
  }
}

// ✅ CORREGIDO: asunto y copy menos spam-trigger
export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const subject = `Tu acceso a ${APP_NAME} está listo`;
  const safeUrl = escapeHtml(verifyUrl);

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

            <tr>
              <td align="center" style="padding-bottom:24px;">
                <span style="font-size:26px;font-weight:800;color:#7c3aed;letter-spacing:-0.5px;">${escapeHtml(APP_NAME)}</span>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff;border-radius:16px;padding:40px 40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <div style="display:inline-block;background:#f3f0ff;border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;font-size:28px;">✉️</div>
                    </td>
                  </tr>
                </table>

                <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                  Un paso más para entrar
                </h1>
                <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                  Haz clic en el botón para completar tu registro en
                  <strong style="color:#111827;">${escapeHtml(APP_NAME)}</strong>.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:8px 0 28px;">
                      <a href="${safeUrl}" target="_blank" rel="noreferrer"
                        style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                        Completar registro
                      </a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;">
                      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                        ⏱️ Este enlace es válido por <strong style="color:#374151;">60 minutos</strong>.
                        Si el botón no funciona, copia y pega este link en tu navegador:
                      </p>
                      <p style="margin:6px 0 0;font-size:11px;word-break:break-all;color:#7c3aed;">${safeUrl}</p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 0 8px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                  Si no creaste esta cuenta, puedes ignorar este correo.<br/>
                  © ${new Date().getFullYear()} ${escapeHtml(APP_NAME)} — Todos los derechos reservados.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text =
    `Tu acceso a ${APP_NAME} está listo\n\n` +
    `Haz clic en el siguiente enlace para completar tu registro:\n${verifyUrl}\n\n` +
    `Este enlace es válido por 60 minutos.\n\n` +
    `Si no creaste esta cuenta, puedes ignorar este correo.`;

  return sendEmail({
    to,
    subject,
    html,
    text,
    dedupeKey: `verify:${to}:${Date.now()}`,
  });
}

/* ====================== Assessments ======================= */

function formatDateTime(d?: Date | string | null) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildAssessmentInviteEmailHtml(params: {
  candidateName?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  templateTitle: string;
  timeLimit?: number | null;
  expiresAt?: Date | string | null;
  inviteUrl: string;
}) {
  const candidateName = (params.candidateName || "").trim();
  const greeting = candidateName ? `Hola ${escapeHtml(candidateName)},` : "Hola,";

  const jobLineParts = [
    params.jobTitle ? escapeHtml(params.jobTitle) : null,
    params.companyName ? escapeHtml(params.companyName) : null,
  ].filter(Boolean);

  const metaParts: string[] = [];
  if (
    typeof params.timeLimit === "number" &&
    Number.isFinite(params.timeLimit) &&
    params.timeLimit > 0
  ) {
    metaParts.push(`Tiempo: ${Math.round(params.timeLimit)} min`);
  }
  const exp = formatDateTime(params.expiresAt);
  if (exp) metaParts.push(`Expira: ${exp}`);

  const meta = metaParts.join(" · ");
  const safeUrl = escapeHtml(params.inviteUrl);

  return htmlLayout({
    title: `Nueva evaluación técnica — ${params.templateTitle}`,
    body: `
      <p style="margin-top:0;">${greeting}</p>
      <p>
        Te asignaron la evaluación: <strong>${escapeHtml(params.templateTitle)}</strong>
        ${
          jobLineParts.length
            ? `<br/><span style="color:#6b7280;">${jobLineParts.join(" · ")}</span>`
            : ""
        }
      </p>
      ${meta ? `<p style="color:#6b7280;font-size:12px;margin-top:8px;">${escapeHtml(meta)}</p>` : ""}
      <p style="margin-top:18px;">
        <a href="${safeUrl}" target="_blank" rel="noreferrer">Abrir evaluación</a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">
        Si el botón no funciona, copia y pega este link en tu navegador:<br/>
        <span style="word-break:break-all;color:#111827;">${safeUrl}</span>
      </p>
    `,
  });
}

export async function sendAssessmentInviteEmail(params: {
  to: string;
  candidateName?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  templateTitle: string;
  timeLimit?: number | null;
  expiresAt?: Date | string | null;
  inviteUrl: string;
  dedupeKey?: string;
}) {
  const subject = `Evaluación técnica: ${params.templateTitle} — ${APP_NAME}`;
  const html = buildAssessmentInviteEmailHtml(params);

  const nameLine = params.candidateName ? `Hola ${params.candidateName}` : "Hola";

  const text =
    `${nameLine}\n\n` +
    `Te asignaron la evaluación: ${params.templateTitle}\n` +
    (params.jobTitle ? `Vacante: ${params.jobTitle}\n` : "") +
    (params.companyName ? `Empresa: ${params.companyName}\n` : "") +
    (params.timeLimit ? `Tiempo: ${Math.round(params.timeLimit)} min\n` : "") +
    (params.expiresAt ? `Expira: ${formatDateTime(params.expiresAt)}\n` : "") +
    `\nAbrir evaluación:\n${params.inviteUrl}\n`;

  const dedupeKey = params.dedupeKey ? `assessment-invite:${params.dedupeKey}` : undefined;

  return sendEmail({ to: params.to, subject, html, text, dedupeKey });
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
      <p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Ver mis postulaciones</a></p>
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

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
    dedupeKey: params.applicationId ? `application:${params.applicationId}` : undefined,
  });
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
    ? `${BASE_URL}/dashboard/messages?applicationId=${encodeURIComponent(params.applicationId)}`
    : `${BASE_URL}/profile/messages?applicationId=${encodeURIComponent(params.applicationId)}`;

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
      <p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Ir al chat</a></p>
      <hr />
      <p>Equipo ${escapeHtml(APP_NAME)}</p>
    `,
  });

  const text =
    `Tienes un nuevo mensaje de ${params.fromName || "contacto"} sobre la vacante ${
      params.jobTitle
    }.\n\n` +
    (params.preview ? `"${truncate(params.preview, 200)}"\n\n` : "") +
    `Responder: ${url}\n\n` +
    `Equipo ${APP_NAME}`;

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
    dedupeKey: `message:${params.applicationId}`,
  });
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

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
    dedupeKey: `rejection:${params.jobTitle}:${params.to}`,
  });
}

/* ====================== PASSWORD RESET ======================= */

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const subject = `Restablece tu contraseña - ${APP_NAME}`;
  const safeUrl = escapeHtml(params.resetUrl);
  const safeName = escapeHtml(params.name);

  const html = htmlLayout({
    title: subject,
    body: `
      <p>Hola <strong>${safeName}</strong>,</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${escapeHtml(APP_NAME)}</strong>.</p>
      <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
      <p style="margin: 24px 0;">
        <a href="${safeUrl}" target="_blank" rel="noreferrer"
          style="display:inline-block;background:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">
          Restablecer contraseña
        </a>
      </p>
      <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px;margin:20px 0;font-size:13px;">
        ⚠️ Este enlace expirará en <strong>1 hora</strong> por seguridad.
      </div>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">
        Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:<br/>
        <span style="word-break:break-all;color:#111827;">${safeUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:12px;">
        Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.
        Tu contraseña actual no será modificada.
      </p>
    `,
  });

  const text =
    `Hola ${params.name},\n\n` +
    `Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${APP_NAME}.\n\n` +
    `Haz clic en el siguiente enlace para crear una nueva contraseña:\n` +
    `${params.resetUrl}\n\n` +
    `⚠️ Este enlace expirará en 1 hora por seguridad.\n\n` +
    `Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.\n\n` +
    `Equipo ${APP_NAME}`;

  return sendEmail({
    to: params.to,
    subject,
    html,
    text,
    dedupeKey: `password-reset:${params.to}`,
  });
}

/* ====================== helpers ======================= */

function htmlLayout({ title, body }: { title: string; body: string }) {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
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
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}