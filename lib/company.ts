// lib/company.ts

/**
 * Dominios "genéricos" que NO deberían crear una Company
 * (candidatos / reclutadores con correos personales).
 */
const GENERIC_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.es",
  "hotmail.com",
  "hotmail.es",
  "live.com",
  "yahoo.com",
  "yahoo.com.mx",
  "icloud.com",
  "proton.me",
  "protonmail.com",
];

/**
 * TLDs compuestos conocidos (country-code + generic).
 * Necesarios para extraer correctamente el SLD.
 * Ej: "task.com.mx" → SLD = "task", no "com"
 */
const COMPOUND_TLDS = new Set([
  "com.mx", "com.ar", "com.co", "com.pe", "com.cl", "com.ve", "com.br",
  "com.ec", "com.bo", "com.py", "com.uy", "com.gt", "com.hn", "com.sv",
  "com.ni", "com.cr", "com.pa", "com.do", "com.pr", "com.cu",
  "co.uk", "co.nz", "co.za", "co.in", "co.jp", "co.kr",
  "org.mx", "net.mx", "edu.mx",
]);

/**
 * Extrae el dominio de un correo: "juan@kfc.com" -> "kfc.com"
 */
export function extractDomainFromEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null;
  const parts = String(email).toLowerCase().split("@");
  if (parts.length !== 2) return null;
  return parts[1].trim();
}

/**
 * Normaliza dominio: quita esquema/subdominios y pasa a minúsculas.
 *   "https://jobs.kfc.com/path" -> "kfc.com"
 *   "jobs.kfc.com"              -> "kfc.com"
 *   "task.com.mx"               -> "task.com.mx"
 */
export function normalizeDomain(
  domain: string | null | undefined
): string | null {
  if (!domain) return null;
  let d = String(domain).trim().toLowerCase();

  d = d.replace(/^https?:\/\//, "").split("/")[0];
  d = d.split(":")[0];

  const parts = d.split(".").filter(Boolean);
  if (parts.length <= 2) return d || null;

  const lastTwo = parts.slice(-2).join(".");
  if (COMPOUND_TLDS.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

/**
 * Devuelve true si el dominio es de correo personal (gmail, outlook, etc.)
 */
export function isGenericDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  const d = normalizeDomain(domain);
  if (!d) return false;
  return GENERIC_DOMAINS.includes(d);
}

/**
 * Convierte un dominio en un nombre razonable:
 *   "kfc.com"     -> "Kfc"
 *   "bbva.mx"     -> "Bbva"
 *   "task.com.mx" -> "Task"
 */
export function domainToDisplayName(domain: string): string {
  const d = normalizeDomain(domain) || domain;
  const firstPart = d.split(".")[0] || d;
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
}
