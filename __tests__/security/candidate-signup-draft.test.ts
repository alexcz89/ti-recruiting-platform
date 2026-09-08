import { describe, expect, it } from "vitest";
import {
  CANDIDATE_SIGNUP_STORAGE_KEY,
  readCandidateSignupDraft,
  writeCandidateSignupDraft,
} from "@/lib/client/candidate-signup-draft";

function memoryStorage(initial?: Record<string, string>): Storage {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("candidate signup draft", () => {
  it("cleans passwords from a legacy draft while preserving safe fields", () => {
    const storage = memoryStorage({
      [CANDIDATE_SIGNUP_STORAGE_KEY]: JSON.stringify({
        firstName: "Candidata A",
        email: "a@example.test",
        location: "Monterrey",
        password: "Secret123!",
        confirmPassword: "Secret123!",
      }),
    });

    expect(readCandidateSignupDraft(storage)).toEqual({
      firstName: "Candidata A",
      email: "a@example.test",
      location: "Monterrey",
    });
    expect(storage.getItem(CANDIDATE_SIGNUP_STORAGE_KEY)).not.toContain("password");
    expect(storage.getItem(CANDIDATE_SIGNUP_STORAGE_KEY)).not.toContain("Secret123!");
  });

  it("never writes password fields and restores non-sensitive fields", () => {
    const storage = memoryStorage();
    writeCandidateSignupDraft(storage, {
      firstName: "Candidata B",
      phone: "+521234567890",
      locationLat: 25.68,
      password: "DoNotPersist1!",
      confirmPassword: "DoNotPersist1!",
    });

    expect(readCandidateSignupDraft(storage)).toEqual({
      firstName: "Candidata B",
      phone: "+521234567890",
      locationLat: 25.68,
    });
  });
});
