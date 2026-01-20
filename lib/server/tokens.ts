import 'server-only';

// lib/server/tokens.ts 
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "dev-secret"
);

// ============= TOKENS EXISTENTES (email verify) =============

export async function createEmailVerifyToken(
  payload: { email: string },
  minutes = 60
): Promise<string> {
  if (!payload?.email) throw new Error("Falta email en payload");
  const exp = Math.floor(Date.now() / 1000) + minutes * 60;

  return await new SignJWT({ ...payload, typ: "email-verify" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

export async function verifyEmailVerifyToken(
  token: string
): Promise<{ email: string; exp: number; typ: string }> {
  if (!token || typeof token !== "string") throw new Error("Token ausente o inválido");
  const { payload } = await jwtVerify(token, secret);
  if (payload.typ !== "email-verify") throw new Error("Tipo de token inválido");

  const email = String(payload.email || "");
  const exp = Number(payload.exp || 0);
  if (!email || !exp) throw new Error("Token incompleto o corrupto");

  return { email, exp, typ: String(payload.typ) };
}

export function isTokenExpired(exp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return exp <= now;
}

// ============= NUEVOS: PASSWORD RESET TOKENS =============

/**
 * Crea un token JWT para restablecer contraseña
 * @param payload - { email: string, userId: string }
 * @param minutes - tiempo de expiración (por defecto 60 minutos)
 * @returns token JWT firmado
 */
export async function createPasswordResetToken(
  payload: { email: string; userId: string },
  minutes = 60
): Promise<string> {
  if (!payload?.email || !payload?.userId) {
    throw new Error("Falta email o userId en payload");
  }
  
  const exp = Math.floor(Date.now() / 1000) + minutes * 60;

  return await new SignJWT({ ...payload, typ: "password-reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

/**
 * Verifica y decodifica un token de password reset
 * @param token - token JWT a verificar
 * @returns payload con email, userId, exp, typ
 * @throws Error si el token es inválido, expirado o no es de tipo password-reset
 */
export async function verifyPasswordResetToken(
  token: string
): Promise<{ email: string; userId: string; exp: number; typ: string }> {
  if (!token || typeof token !== "string") {
    throw new Error("Token ausente o inválido");
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.typ !== "password-reset") {
      throw new Error("Tipo de token inválido");
    }

    const email = String(payload.email || "");
    const userId = String(payload.userId || "");
    const exp = Number(payload.exp || 0);
    
    if (!email || !userId || !exp) {
      throw new Error("Token incompleto o corrupto");
    }

    // Verificar si está expirado
    if (isTokenExpired(exp)) {
      throw new Error("El token ha expirado");
    }

    return { email, userId, exp, typ: String(payload.typ) };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Error al verificar el token");
  }
}