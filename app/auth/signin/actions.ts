// app/auth/signin/actions.ts
"use server";

/**
 * Archivo de Server Actions para /auth/signin
 * Importante: en módulos con "use server", TODOS los exports deben ser funciones async (acciones).
 * Helpers NO deben exportarse. Si necesitas compartir helpers, muévelos a /lib/*.
 */

/** Helper interno: valida correo corporativo (NO exportar) */
function _isCorporateEmailSync(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();

  // Lista básica de dominios "free"
  const FREE = new Set([
    "gmail.com","hotmail.com","outlook.com","live.com","yahoo.com",
    "icloud.com","proton.me","aol.com","yandex.com","gmx.com",
    "msn.com","zoho.com","mail.com","outlook.es","hotmail.es","yahoo.com.mx",
  ]);
  return domain.length > 0 && !FREE.has(domain);
}

/** Helper interno: sanitiza callback URL relativa (NO exportar) */
function _sanitizeCallbackUrlSync(cb?: string | null): string | undefined {
  if (!cb) return undefined;
  try {
    if (cb.startsWith("/")) return cb;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Normaliza role y callbackUrl desde querystring (Server Action async) */
export async function prepareSigninParams(input: {
  role?: string | null;
  callbackUrl?: string | null;
}) {
  const rawRole = (input.role || "").toUpperCase();
  const role: "RECRUITER" | "CANDIDATE" | "ADMIN" =
    rawRole === "RECRUITER" ? "RECRUITER" :
    rawRole === "ADMIN" ? "ADMIN" : "CANDIDATE";

  const callbackUrl = _sanitizeCallbackUrlSync(input.callbackUrl);

  return { role, callbackUrl };
}

/**
 * (Opcional) Acción para validar si un email cumple con “corporativo”.
 * Útil si decides validar del lado servidor antes de llamar a next-auth.
 */
export async function isCorporateEmail(email: string) {
  return _isCorporateEmailSync(email);
}

/**
 * (Opcional) Acción para sanear una callbackUrl del cliente.
 * Devuelve solo rutas relativas seguras, o undefined.
 */
export async function sanitizeCallbackUrl(cb?: string | null) {
  return _sanitizeCallbackUrlSync(cb);
}
