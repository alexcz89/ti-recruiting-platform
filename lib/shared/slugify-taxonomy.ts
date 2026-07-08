// lib/shared/slugify-taxonomy.ts

/**
 * Slugifier canonico para TaxonomyTerm ([kind, slug] es unique).
 *
 * Lo usan tanto los scripts de seed/refresh como el runtime (ensureTerm en
 * lib/db/candidate.ts). Si este algoritmo cambia, los slugs generados en
 * runtime dejarian de coincidir con los del catalogo y se duplicarian terminos.
 *
 * "Nucleo & Systems Engineer" -> "nucleo-systems-engineer"
 */
export function slugifyTaxonomyLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
