// lib/shared/slugify-taxonomy.ts
//
// Slugifier ÚNICO para TaxonomyTerm (skills, certificaciones, idiomas).
// Todos los seeds, scripts de refresh y flujos runtime que crean términos
// (ensureTerm / findOrCreateTerm) deben usar esta función. Tener slugifiers
// distintos por archivo fue lo que produjo términos duplicados en la BD
// (ej. "nodejs" vs "node-js") y colisiones ("C", "C++" y "C#" → slug "c").

/**
 * Labels cuyo slug canónico no sigue la regla general. "Node.js" quedó
 * históricamente como "nodejs" (los pools de badge y los CandidateSkill
 * existentes apuntan a ese slug), así que se respeta como canónico.
 */
const SLUG_OVERRIDES: Record<string, string> = {
  "node.js": "nodejs",
  "node js": "nodejs",
};

export function slugifyTaxonomyLabel(label: string): string {
  const key = label.trim().toLowerCase();
  const override = SLUG_OVERRIDES[key];
  if (override) return override;

  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // "#" y "++" desaparecerían con la regla general y provocan colisiones
    // (C / C++ / C# → "c"). Se traducen antes: C++ → cpp, C# → csharp.
    .replace(/\+\+/g, "pp")
    .replace(/#/g, "sharp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
