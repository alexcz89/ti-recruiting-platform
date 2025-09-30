// lib/search/fuse.ts
import Fuse from "fuse.js";

/**
 * Crea un índice de Fuse para arrays simples de string.
 * Útil para autocompletar de skills/certs.
 */
export function createStringFuse(list: string[]) {
  return new Fuse(list, {
    includeScore: true,
    threshold: 0.35, // sensibilidad (0=estricto, 1=muy laxo). Ajusta a gusto.
    ignoreLocation: true,
    distance: 100,
    keys: [], // array de strings simples => sin keys
  });
}

/** Devuelve top-N resultados (strings) para un query dado */
export function searchStrings(fuse: Fuse<string>, q: string, limit = 30): string[] {
  if (!q.trim()) return [];
  return fuse.search(q).slice(0, limit).map(r => r.item);
}
