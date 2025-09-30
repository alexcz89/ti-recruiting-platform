// app/api/auth/signup/candidate/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

// Si ya tienes un schema centralizado, úsalo.
// Aquí dejo uno robusto por si quieres empezar ya.
const CandidateRegisterSchema = z.object({
  name: z.string().min(2, "Nombre requerido").max(120),
  email: z.string().email("Email inválido").max(190),
  password: z.string().min(8, "Mínimo 8 caracteres").max(100),
});

// Este endpoint usa Node.js (bcryptjs no funciona en Edge).
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const input = CandidateRegisterSchema.parse(json);

    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    // ¿Ya existe?
    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json(
        { error: "El correo ya está registrado." },
        { status: 409 }
      );
    }

    // Hash de contraseña
    const { hashSync, genSaltSync } = await import("bcryptjs");
    const salt = genSaltSync(10);
    const passwordHash = hashSync(input.password, salt);

    // Crear usuario CANDIDATE
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "CANDIDATE",
      },
      select: { id: true, email: true, name: true },
    });

    // Email de bienvenida (no bloquea la respuesta)
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "Bolsa TI";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const subject = `¡Bienvenido/a a ${appName}!`;
    const html = `
      <p>Hola ${escapeHtml(name)} 👋</p>
      <p>Tu registro como candidato en <strong>${escapeHtml(appName)}</strong> fue exitoso.</p>
      <p>Puedes completar tu perfil y empezar a postularte a vacantes:</p>
      <p><a href="${baseUrl}/profile" target="_blank" rel="noreferrer">Ir a mi perfil</a></p>
      <hr />
      <p>¡Éxitos en tu búsqueda!</p>
    `;
    const text =
      `Hola ${name}\n\n` +
      `Tu registro como candidato en ${appName} fue exitoso.\n` +
      `Completa tu perfil: ${baseUrl}/profile\n\n` +
      `¡Éxitos en tu búsqueda!\n`;

    // Enviar en segundo plano (ignorar errores)
    sendEmail({ to: email, subject, html, text }).catch(() => {});

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      // Estructura útil para el cliente: fieldErrors
      return NextResponse.json(
        { error: "VALIDATION", details: e.flatten() },
        { status: 400 }
      );
    }
    // Prisma: email único (por si corre condición de carrera)
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "El correo ya está registrado." },
        { status: 409 }
      );
    }
    console.error("[signup-candidate] error:", e);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

/** Sencillo escape para HTML del correo */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
