import { afterEach, describe, expect, it, vi } from "vitest";
import { isUntimedMcqTestAllowed } from "@/lib/server/assessmentTestMode";

const base = {
  email: "qa@example.test",
  templateId: "template-a",
  templateType: "MCQ",
  isBadgeExam: false,
};

const allowedEnv = {
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  ASSESSMENT_TEST_UNTIMED_ENABLED: "true",
  ASSESSMENT_TEST_UNTIMED_EMAILS: "qa@example.test",
  ASSESSMENT_TEST_UNTIMED_TEMPLATE_IDS: "template-a",
};

describe("untimed MCQ diagnostic guard", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("permits explicit account + template in preview", () => {
    expect(isUntimedMcqTestAllowed(base, allowedEnv)).toBe(true);
  });

  it("rejects production even if explicitly enabled", () => {
    expect(isUntimedMcqTestAllowed(base, { ...allowedEnv, VERCEL_ENV: "production" })).toBe(false);
    expect(isUntimedMcqTestAllowed(base, { ...allowedEnv, VERCEL_ENV: undefined })).toBe(false);
  });

  it("requires explicit enablement and both allowlists", () => {
    expect(isUntimedMcqTestAllowed(base, { ...allowedEnv, ASSESSMENT_TEST_UNTIMED_ENABLED: "false" })).toBe(false);
    expect(isUntimedMcqTestAllowed({ ...base, email: "other@example.test" }, allowedEnv)).toBe(false);
    expect(isUntimedMcqTestAllowed({ ...base, templateId: "template-b" }, allowedEnv)).toBe(false);
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
