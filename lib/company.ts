// lib/company.ts
import { prisma } from "@/lib/server/prisma";
import type { Company, CompanySize } from "@prisma/client";

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

function normalizeCompanySize(size?: string | null): CompanySize | undefined {
  if (!size) return undefined;

  const map: Record<string, CompanySize> = {
    ONE_TO_TEN: "ONE_TO_TEN",
    ELEVEN_TO_FIFTY: "ELEVEN_TO_FIFTY",
    FIFTY_ONE_TO_TWO_HUNDRED: "FIFTY_ONE_TO_TWO_HUNDRED",
    TWO_HUNDRED_ONE_TO_FIVE_HUNDRED: "TWO_HUNDRED_ONE_TO_FIVE_HUNDRED",
    FIVE_HUNDRED_PLUS: "FIVE_HUNDRED_PLUS",

    "1-10": "ONE_TO_TEN",
    "11-50": "ELEVEN_TO_FIFTY",
    "51-200": "FIFTY_ONE_TO_TWO_HUNDRED",
    "201-500": "TWO_HUNDRED_ONE_TO_FIVE_HUNDRED",
    "500+": "FIVE_HUNDRED_PLUS",

    // legacy
    "201-1000": "TWO_HUNDRED_ONE_TO_FIVE_HUNDRED",
    "1000+": "FIVE_HUNDRED_PLUS",
  };

  return map[size] ?? undefined;
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

  const normalizedSize = normalizeCompanySize(opts.size);

  const company = await prisma.company.upsert({
    where: { domain },
    update: {
      country: opts.country ?? undefined,
      city: opts.city ?? undefined,
      size: normalizedSize ?? undefined,
    },
    create: {
      name,
      domain,
      country: opts.country ?? null,
      city: opts.city ?? null,
      size: normalizedSize ?? null,
    },
  });

  return company;
}

/**
 * Helper pensado para reclutadores:
 * - Siempre espera un correo corporativo.
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
 * - Liga el recruiterProfile.companyId si aplica
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

  await prisma.recruiterProfile.upsert({
    where: { userId: opts.userId },
    update: {
      companyId: company.id,
      companyName: company.name,
    },
    create: {
      userId: opts.userId,
      companyId: company.id,
      companyName: company.name,
      phone: null,
      status: "PENDING",
    },
  });

  return company;
}