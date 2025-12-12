// lib/domains.ts

// Lista básica de dominios gratuitos. Puedes ampliarla si quieres.
export const FREE_DOMAINS: string[] = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "aol.com",
  "yahoo.com.mx",
  "hotmail.com.mx",
  "outlook.com.mx",
];

// Normaliza un dominio (minúsculas, sin espacios, quita "www.")
function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const clean = domain.trim().toLowerCase();
  if (!clean) return null;
  return clean.startsWith("www.") ? clean.slice(4) : clean;
}

/**
 * Extrae el dominio de un email.
 * ej. "juan@empresa.com" -> "empresa.com"
 */
export function extractDomainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const match = String(email).toLowerCase().match(/@([^@]+)$/);
  if (!match) return null;
  return normalizeDomain(match[1]);
}

/**
 * Extrae el dominio "bonito" de una URL.
 * - Si no viene con http/https se le agrega "https://"
 * - Quita "www."
 *
 * ej.
 *   "https://www.empresa.com" -> "empresa.com"
 *   "empresa.com" -> "empresa.com"
 */
export function extractDomainFromUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (!url) return null;

  // Si no tiene protocolo, asumimos https
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const u = new URL(url);
    return normalizeDomain(u.hostname);
  } catch {
    // Si no se pudo parsear, intentamos algo muy básico
    const parts = url.split("/")[0];
    return normalizeDomain(parts);
  }
}

/**
 * Determina si un dominio es de correo gratuito (gmail, outlook, etc.)
 */
export function isFreeDomain(domain: string | null | undefined): boolean {
  const norm = normalizeDomain(domain);
  if (!norm) return false;
  return FREE_DOMAINS.includes(norm);
}

/**
 * Devuelve true si el email parece corporativo (no es gmail, hotmail, etc.)
 */
export function isCorporateEmail(email: string | null | undefined): boolean {
  const domain = extractDomainFromEmail(email || "");
  if (!domain) return false;
  return !isFreeDomain(domain);
}

/**
 * Compara dominios de email vs sitio web.
 *
 * - Normaliza (minúsculas, sin "www.")
 * - Permite pequeñas variaciones (.com vs .com.mx) quedándose con
 *   los últimos 2–3 segmentos.
 */
export function domainMatches(
  emailDomainRaw: string | null | undefined,
  websiteDomainRaw: string | null | undefined
): boolean {
  const emailDomain = normalizeDomain(emailDomainRaw);
  const webDomain = normalizeDomain(websiteDomainRaw);
  if (!emailDomain || !webDomain) return false;

  // Si son exactamente iguales, listo
  if (emailDomain === webDomain) return true;

  // Comparamos los últimos 2 o 3 segmentos, para tolerar cosas como:
  // - empresa.com vs www.empresa.com
  // - empresa.com vs empresa.com.mx
  const splitAndTail = (d: string): string => {
    const parts = d.split(".");
    if (parts.length <= 2) return d;
    // Nos quedamos con los últimos 3 primero, si no los últimos 2
    const tail3 = parts.slice(-3).join(".");
    const tail2 = parts.slice(-2).join(".");
    // Preferimos el que contiene el nombre de la empresa
    return tail3.length <= 15 ? tail3 : tail2;
  };

  return splitAndTail(emailDomain) === splitAndTail(webDomain);
}
