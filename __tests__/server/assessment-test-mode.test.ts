import { afterEach, describe, expect, it, vi } from "vitest";
import { isUntimedMcqTestAllowed } from "@/lib/server/assessmentTestMode";

const base = {
  email: "qa@example.test",
  templateType: "MCQ",
  isBadgeExam: false,
};

const allowedEnv = {
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  ASSESSMENT_TEST_UNTIMED_ENABLED: "true",
  ASSESSMENT_TEST_UNTIMED_EMAILS: "qa@example.test",
};

describe("untimed MCQ diagnostic guard", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("permits authorized account in preview", () => {
    expect(isUntimedMcqTestAllowed(base, allowedEnv)).toBe(true);
  });

  it("rejects production even if explicitly enabled", () => {
    expect(isUntimedMcqTestAllowed(base, { ...allowedEnv, VERCEL_ENV: "production" })).toBe(false);
    expect(isUntimedMcqTestAllowed(base, { ...allowedEnv, VERCEL_ENV: undefined })).toBe(false);
  });

  it("requires enablement and authorized email", () => {
    expect(isUntimedMcqTestAllowed(base, { ...allowedEnv, ASSESSMENT_TEST_UNTIMED_ENABLED: "false" })).toBe(false);
    expect(isUntimedMcqTestAllowed({ ...base, email: "other@example.test" }, allowedEnv)).toBe(false);
  });

  it("rejects badge, mixed and coding assessments", () => {
    expect(isUntimedMcqTestAllowed({ ...base, isBadgeExam: true }, allowedEnv)).toBe(false);
    expect(isUntimedMcqTestAllowed({ ...base, templateType: "MIXED" }, allowedEnv)).toBe(false);
    expect(isUntimedMcqTestAllowed({ ...base, templateType: "CODING" }, allowedEnv)).toBe(false);
  });

  it("accepts local development with explicit settings", () => {
    expect(isUntimedMcqTestAllowed(base, {
      ...allowedEnv, NODE_ENV: "development", VERCEL_ENV: undefined,
    })).toBe(true);
  });
});
