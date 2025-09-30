// lib/dates.ts
import { format, formatDistanceToNow, differenceInYears, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Edad a partir de una fecha (Date o ISO)
export function getAge(input: Date | string | null | undefined): number | null {
  if (!input) return null;
  const d = typeof input === "string" ? parseISO(input) : input;
  if (isNaN(d.getTime())) return null;
  return differenceInYears(new Date(), d);
}

// “hace X …” (relative time)
export function fromNow(input: Date | string | number): string {
  const d = typeof input === "string" ? parseISO(input) : new Date(input);
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

// Canon: Fecha corta legible (ej. 26/09/2025)
export function formatDate(input: Date | string | number): string {
  const d = typeof input === "string" ? parseISO(input) : new Date(input);
  return format(d, "dd/MM/yyyy", { locale: es });
}

// Fecha/hora legible (ej. 26 sep 2025 14:30)
export function formatDateTime(input: Date | string | number): string {
  const d = typeof input === "string" ? parseISO(input) : new Date(input);
  return format(d, "d MMM yyyy HH:mm", { locale: es });
}

/**
 * @deprecated Usa `formatDate` (mismo comportamiento, nombre canónico).
 */
export const formatShort = formatDate;
