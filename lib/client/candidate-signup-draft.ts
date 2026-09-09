export const CANDIDATE_SIGNUP_STORAGE_KEY = "signup_multi_step_data_v1";

const STRING_FIELDS = [
  "firstName", "lastName", "maternalSurname", "email", "phone", "location",
  "placeId", "city", "admin1", "country", "cityNorm", "admin1Norm",
  "linkedin", "github",
] as const;
const NUMBER_FIELDS = ["locationLat", "locationLng"] as const;

export type CandidateSignupDraft = Partial<
  Record<(typeof STRING_FIELDS)[number], string> &
  Record<(typeof NUMBER_FIELDS)[number], number>
>;

export function sanitizeCandidateSignupDraft(value: unknown): CandidateSignupDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const safe: CandidateSignupDraft = {};

  for (const field of STRING_FIELDS) {
    if (typeof source[field] === "string") safe[field] = source[field] as never;
  }
  for (const field of NUMBER_FIELDS) {
    if (typeof source[field] === "number" && Number.isFinite(source[field])) {
      safe[field] = source[field] as never;
    }
  }
  return safe;
}

export function readCandidateSignupDraft(storage: Storage): CandidateSignupDraft {
  const raw = storage.getItem(CANDIDATE_SIGNUP_STORAGE_KEY);
  if (!raw) return {};

  try {
    const safe = sanitizeCandidateSignupDraft(JSON.parse(raw));
    // Rewriting immediately removes password/confirmPassword from legacy drafts.
    storage.setItem(CANDIDATE_SIGNUP_STORAGE_KEY, JSON.stringify(safe));
    return safe;
  } catch {
    storage.removeItem(CANDIDATE_SIGNUP_STORAGE_KEY);
    return {};
  }
}

export function writeCandidateSignupDraft(storage: Storage, value: unknown) {
  storage.setItem(
    CANDIDATE_SIGNUP_STORAGE_KEY,
    JSON.stringify(sanitizeCandidateSignupDraft(value))
  );
}
