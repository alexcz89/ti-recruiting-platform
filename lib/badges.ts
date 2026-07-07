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
