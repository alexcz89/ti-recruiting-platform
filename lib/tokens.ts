// lib/tokens.ts
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "dev-secret"
);

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
