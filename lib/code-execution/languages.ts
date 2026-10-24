// Client-safe catalog shared by Judge0 and assessment authoring.
export const JUDGE0_LANGUAGE_IDS = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
  csharp: 51,
  go: 60,
  rust: 73,
  ruby: 72,
  php: 68,
  swift: 83,
  kotlin: 78,
  sql: 82,
} as const;

export type CodingLanguage = keyof typeof JUDGE0_LANGUAGE_IDS;

export function isCodingLanguage(value: string): value is CodingLanguage {
  return Object.prototype.hasOwnProperty.call(JUDGE0_LANGUAGE_IDS, value);
}
