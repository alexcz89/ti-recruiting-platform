// lib/company.ts
import { prisma } from '@/lib/server/prisma';
import type { Company } from "@prisma/client";

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
 *   "task.com.mx"               -> "task.com.mx"  ✅ (no "com.mx")
 */
export function normalizeDomain(
  domain: string | null | undefined
): string | null {
  if (!domain) return null;
  let d = String(domain).trim().toLowerCase();

  // Quitar esquema y path
  d = d.replace(/^https?:\/\//, "").split("/")[0];
  // Quitar puerto si lo hay
  d = d.split(":")[0];

  const parts = d.split(".").filter(Boolean);
  if (parts.length <= 2) return d || null;

  // Verificar si los últimos 2 segmentos forman un TLD compuesto (ej: com.mx)
  const lastTwo = parts.slice(-2).join(".");
  if (COMPOUND_TLDS.has(lastTwo)) {
    // TLD compuesto: tomar los últimos 3 segmentos como dominio base
    // "task.com.mx" → ["task", "com", "mx"] → "task.com.mx"
    // "jobs.task.com.mx" → ["jobs", "task", "com", "mx"] → "task.com.mx"
    return parts.slice(-3).join(".");
  }

  // TLD simple: tomar los últimos 2 segmentos
  // "jobs.kfc.com" → "kfc.com"
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
 *   "kfc.com"       -> "Kfc"
 *   "bbva.mx"       -> "Bbva"
 *   "task.com.mx"   -> "Task"  ✅
 */
export function domainToDisplayName(domain: string): string {
  const d = normalizeDomain(domain) || domain;
  // Tomar el primer segmento (antes del primer punto)
  const firstPart = d.split(".")[0] || d;
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
}

/**
 * Busca (o crea) una Company a partir del correo.
 * - Si el dominio es genérico (gmail/outlook, etc.) devuelve null.
 * - Si ya existe una Company con ese dominio, la reutiliza.
 * - Si no existe, crea una nueva con un nombre sugerido.
 */
export async function getOrCreateCompanyFromEmail(opts: {
  email: string;
  suggestedName?: string | null;
  country?: string | null;
  city?: string | null;
  size?: string | null;
}): Promise<Company | null> {
  const rawDomain = extractDomainFromEmail(opts.email);
  const domain = normalizeDomain(rawDomain);

  if (!domain) return null;
  if (isGenericDomain(domain)) return null;

  const name =
    (opts.suggestedName && opts.suggestedName.trim()) ||
    domainToDisplayName(domain);

  const company = await prisma.company.upsert({
    where: { domain },
    update: {
      country: opts.country ?? undefined,
      city: opts.city ?? undefined,
      size: opts.size ?? undefined,
    },
    create: {
      name,
      domain,
      country: opts.country ?? null,
      city: opts.city ?? null,
      size: opts.size ?? null,
    },
  });

  return company;
}

/**
 * Helper pensado para reclutadores:
 * - Siempre espera un correo corporativo (ya filtramos Gmail/etc. antes).
 * - Llama a getOrCreateCompanyFromEmail y lanza error si no puede.
 */
export async function ensureCompanyForRecruiter(opts: {
  email: string;
  companyName: string;
  size?: string | null;
  country?: string | null;
  city?: string | null;
}): Promise<Company> {
  const company = await getOrCreateCompanyFromEmail({
    email: opts.email,
    suggestedName: opts.companyName,
    country: opts.country ?? null,
    city: opts.city ?? null,
    size: opts.size ?? null,
  });

  if (!company) {
    throw new Error(
      "No se pudo derivar una empresa a partir del correo corporativo."
    );
  }

  return company;
}

/**
 * Helper de más alto nivel:
 * - Obtiene/crea Company desde el email
 * - Liga el user.companyId si aplica
 */
export async function ensureUserCompanyByEmail(opts: {
  userId: string;
  email: string;
  suggestedName?: string | null;
  country?: string | null;
  city?: string | null;
  size?: string | null;
}): Promise<Company | null> {
  const company = await getOrCreateCompanyFromEmail({
    email: opts.email,
    suggestedName: opts.suggestedName,
    country: opts.country ?? null,
    city: opts.city ?? null,
    size: opts.size ?? null,
  });

  if (!company) return null;

  await prisma.user.update({
    where: { id: opts.userId },
    data: {
      companyId: company.id,
    },
  });

  return company;
}