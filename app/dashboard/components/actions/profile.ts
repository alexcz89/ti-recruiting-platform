// app/dashboard/components/actions/profile.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createEmailVerifyToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mailer";
import { revalidatePath } from "next/cache";

/**
 * Reenvía el correo de verificación al usuario logueado.
 * Soporta DRY-RUN si EMAIL_ENABLED !== "true".
 */
export async function resendVerificationEmailAction() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return { ok: false, message: "No hay sesión o email." };
  }

  // Token válido por 60 minutos (ajústalo si quieres)
  const token = await createEmailVerifyToken({ email }, 60);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const res = await sendVerificationEmail(email, verifyUrl);

  // refresca overview para que el checklist se rehidrate si fuera necesario
  revalidatePath("/dashboard/overview");

  if ("error" in res) return { ok: false, message: res.error || "No se pudo enviar el correo." };

  // En DRY-RUN (EMAIL_ENABLED=false) devuelve { skipped:true } y loguea en consola
  return { ok: true, message: "Correo de verificación reenviado (revisa tu bandeja o consola en modo dev)." };
}
