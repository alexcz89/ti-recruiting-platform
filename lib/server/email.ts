// lib/server/email.ts
import 'server-only';
import { sendVerificationEmail as sendVerificationEmailBase } from './mailer';

function resolveBaseUrl() {
  const env =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL;

  if (env) {
    const withProto = env.startsWith("http") ? env : `https://${env}`;
    return withProto.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export async function sendVerificationEmail(params: {
  email: string;
  name: string;
  token: string;
}) {
  const BASE_URL = resolveBaseUrl(); // 👈 se evalúa en runtime, no al importar
  const verifyUrl = `${BASE_URL}/api/auth/verify?token=${encodeURIComponent(params.token)}`;
  return sendVerificationEmailBase(params.email, verifyUrl);
}

export {
  sendApplicationEmail,
  sendNewMessageEmail,
  sendRejectionEmail,
  sendPasswordResetEmail,
  sendAssessmentInviteEmail,
} from './mailer';