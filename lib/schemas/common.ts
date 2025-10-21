// lib/schemas/common.ts
import { z } from "zod";

export const MonthRE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const nonEmptyString = z.string().min(1);
export const urlOptional = z.string().url("URL inválida").optional().or(z.literal(""));

export const isoCountry2 = z
  .string()
  .length(2, "Código país ISO-2")
  .regex(/^[a-z]{2}$/i, "Solo letras")
  .transform((s) => s.toLowerCase());

export function stripDiacritics(s: string) {
  return (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** "YYYY-MM" → Date (primer día UTC) */
export function monthToDate(ym?: string | null): Date | null {
  if (!ym || !MonthRE.test(ym)) return null;
  return new Date(`${ym}-01T00:00:00.000Z`);
}

/** Date → "YYYY-MM" (UTC) */
export function dateToMonth(d?: Date | string | null): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  const m = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}
