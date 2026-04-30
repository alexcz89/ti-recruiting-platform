// lib/utils/slugify.ts

/**
 * Genera un slug SEO-friendly para una vacante.
 * Incluye un sufijo de 6 chars del ID para garantizar unicidad.
 *
 * Ejemplo: "Desarrollador Salesforce", "CDMX", "clxyz123abc456"
 *       → "desarrollador-salesforce-cdmx-abc456"
 */
export function generateJobSlug(
  title: string,
  city: string | null | undefined,
  id: string
): string {
  const base = [title, city].filter(Boolean).join(" ");

  const slug = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos: é→e, ó→o
    .replace(/[^a-z0-9\s-]/g, "")   // quita caracteres especiales
    .trim()
    .replace(/\s+/g, "-")           // espacios → guiones
    .replace(/-+/g, "-")            // guiones dobles → uno
    .slice(0, 60);                  // máximo 60 chars

  const suffix = id.slice(-6);      // últimos 6 chars del cuid
  return `${slug}-${suffix}`;
}