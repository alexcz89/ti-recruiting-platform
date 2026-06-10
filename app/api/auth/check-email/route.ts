// app/api/auth/check-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import {
  checkEmailRateLimit,
  getClientIp,
  formatRetryAfter,
  RATE_LIMITS,
} from "@/lib/server/rate-limit";

// ✅ Función compartida para la lógica de verificación
async function checkEmailExists(email: string, clientIp?: string) {
  if (!email) {
    return {
      error: "Email es requerido",
      status: 400,
    };
  }

  try {
    // Normalizar email
    const normalizedEmail = email.toLowerCase().trim();

    // ✅ Rate limiting para prevenir enumeration attacks
    const rateLimit = checkEmailRateLimit(
      normalizedEmail,
      RATE_LIMITS.GENERAL_EMAIL
    );

    if (!rateLimit.allowed) {
      const retryAfter = rateLimit.retryAfter || 600;
      return {
        error: `Demasiadas consultas. Intenta de nuevo en ${formatRetryAfter(retryAfter)}.`,
        status: 429,
      };
    }

    // Buscar en la base de datos
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    // ✅ IMPORTANTE: No revelamos si el email existe o no
    // Devolvemos el mismo resultado para existente y no-existente
    // para prevenir enumeration attacks
    return {
      data: {
        email: normalizedEmail,
        // Solo devolvemos 'available' cuando se intenta registrar
        // No devolvemos 'exists' para prevenir enumeration
        available: !existingUser, // false si existe, true si está disponible
      },
      status: 200,
    };
  } catch (error) {
    console.error("Error checking email:", error);
    return {
      error: "Error al verificar email",
      status: 500,
    };
  }
}

// ✅ GET: Para consultas desde URL query params
// Uso: /api/auth/check-email?email=test@example.com
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const clientIp = getClientIp(request.headers);

  const result = await checkEmailExists(email || "", clientIp);

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(result.data, { status: result.status });
}

// ✅ POST: Para consultas desde body (usado en el wizard)
// Uso: fetch('/api/auth/check-email', { method: 'POST', body: JSON.stringify({ email: '...' }) })
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    const clientIp = getClientIp(request.headers);

    const result = await checkEmailExists(email, clientIp);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error("Error parsing request body:", error);
    return NextResponse.json(
      { error: "Request inválido" },
      { status: 400 }
    );
  }
}