// lib/profile-helpers.ts
export const educationRank: Record<string, number> = {
  NONE: 0, PRIMARY: 1, SECONDARY: 2, HIGH_SCHOOL: 3,
  TECHNICAL: 4, BACHELOR: 5, MASTER: 6, DOCTORATE: 7, OTHER: 2,
};

export function pickHighestEducation(levels: (string | null | undefined)[] | null | undefined) {
  if (!levels?.length) return null;
  let best: string | null = null; let bestScore = -1;
  for (const lv of levels) {
    const key = String(lv ?? "NONE").toUpperCase();
    const score = educationRank[key] ?? -1;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}
