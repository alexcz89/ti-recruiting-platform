// lib/server/email.ts
import 'server-only';
import { sendVerificationEmail as sendVerificationEmailBase } from './mailer';

/**
 * Wrapper para compatibilidad con el signup multi-step
 * 
 * Convierte la firma nueva:
 *   sendVerificationEmail({ email, name, token })
 * 
 * A la firma existente en mailer.ts:
 *   sendVerificationEmail(to, verifyUrl)
 */

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

/**
 * Envía email de verificación al usuario
 * 
 * @param params.email - Email del destinatario
 * @param params.name - Nombre del usuario (no usado actualmente, reservado para personalización)
 * @param params.token - Token JWT de verificación generado
 */
export async function sendVerificationEmail(params: {
  email: string;
  name: string;
  token: string;
}) {
  // ✅ Construir URL de verificación con el token JWT
  const verifyUrl = `${BASE_URL}/api/auth/verify?token=${encodeURIComponent(params.token)}`;

  // ✅ Usar la función existente de mailer.ts
  return sendVerificationEmailBase(params.email, verifyUrl);
}

/**
 * Re-exportar otras funciones útiles de mailer.ts
 */
export {
  sendApplicationEmail,
  sendNewMessageEmail,
  sendRejectionEmail,
  sendPasswordResetEmail,
  sendAssessmentInviteEmail,
} from './mailer';