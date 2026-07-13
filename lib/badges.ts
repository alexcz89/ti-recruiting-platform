// lib/badges.ts
// Sistema de badges de skills verificados (exámenes gratis candidato-iniciados).
// Los niveles son enteros extensibles: agregar un nivel = agregar una entrada aquí.

export const BADGE_LEVELS = [1, 2, 3] as const;

export const BADGE_LEVEL_LABELS: Record<number, string> = {
  1: "Básico",
  2: "Intermedio",
  3: "Avanzado",
};

/** Días de espera para reintentar un examen de badge reprobado. */
export const BADGE_RETRY_COOLDOWN_DAYS = 30;

export function badgeLevelLabel(level: number): string {
  return BADGE_LEVEL_LABELS[level] ?? `Nivel ${level}`;
}

/** Logo oficial de la tecnología (public/logos) por slug de TaxonomyTerm.
 *  Si un skill no tiene logo, el medallón usa su nombre en texto. */
const BADGE_LOGOS: Record<string, string> = {
  java: "/logos/java-original.svg",
  javascript: "/logos/javascript-original.svg",
  typescript: "/logos/typescript-original.svg",
  python: "/logos/python-original.svg",
  react: "/logos/react-original.svg",
  nodejs: "/logos/nodejs-plain.svg",
  "node-js": "/logos/nodejs-plain.svg",
  git: "/logos/git-original.svg",
};

export function badgeLogoSrc(termSlug: string | null | undefined): string | null {
  if (!termSlug) return null;
  return BADGE_LOGOS[termSlug] ?? null;
}
