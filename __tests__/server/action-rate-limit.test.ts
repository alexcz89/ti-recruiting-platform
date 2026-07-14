import { beforeEach, describe, expect, it } from "vitest";
import {
  checkActionRateLimit,
  resetActionRateLimit,
} from "@/lib/server/rate-limit";

describe("authenticated action rate limiting", () => {
  const action = "cv-parse";
  const userId = "candidate-1";
  const config = { maxAttempts: 2, windowMs: 60_000 };

  beforeEach(() => resetActionRateLimit(action, userId));

  it("bloquea al superar el límite configurado", () => {
    expect(checkActionRateLimit(action, userId, config).allowed).toBe(true);
    expect(checkActionRateLimit(action, userId, config).allowed).toBe(true);
    expect(checkActionRateLimit(action, userId, config).allowed).toBe(false);
  });

  it("mantiene contadores separados por acción", () => {
    checkActionRateLimit(action, userId, { maxAttempts: 1, windowMs: 60_000 });
    expect(
      checkActionRateLimit("cv-upload", userId, {
        maxAttempts: 1,
        windowMs: 60_000,
      }).allowed
    ).toBe(true);
  });
});
