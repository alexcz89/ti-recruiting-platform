import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type ResendSend = (
  payload: Record<string, unknown>,
  options?: { idempotencyKey?: string },
) => Promise<{ data: { id: string }; error: null }>;

const mocks = vi.hoisted(() => ({
  send: vi.fn<ResendSend>(async () => ({
    data: { id: "email-a" },
    error: null,
  })),
}));

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

let sendAssessmentInviteEmail: typeof import("@/lib/server/mailer")["sendAssessmentInviteEmail"];

beforeAll(async () => {
  vi.stubEnv("EMAIL_ENABLED", "true");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "qa@example.com");
  vi.resetModules();
  ({ sendAssessmentInviteEmail } = await import("@/lib/server/mailer"));
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("assessment email provider idempotency", () => {
  it("passes the operation-scoped key to Resend emails.send", async () => {
    await sendAssessmentInviteEmail({
      to: "candidate@example.com",
      templateTitle: "QA Assessment",
      inviteUrl: "https://preview.example/assessments/template-a?token=token-a",
      expiresAt: "2026-09-13T12:00:00.000Z",
      dedupeKey: "invite-a:operation-a",
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "candidate@example.com",
        subject: expect.stringContaining("QA Assessment"),
      }),
      {
        idempotencyKey: expect.stringMatching(
          /^assessment-invite:invite-a:operation-a:payload:[a-f0-9]{64}$/,
        ),
      },
    );
  });

  it("does not reuse a provider key when the payload changes", async () => {
    const common = {
      to: "candidate@example.com",
      templateTitle: "QA Assessment",
      dedupeKey: "invite-a:operation-reused",
    };

    await sendAssessmentInviteEmail({
      ...common,
      inviteUrl: "https://preview.example/assessments/template-a?token=token-a",
      expiresAt: "2026-09-13T12:00:00.000Z",
    });
    await sendAssessmentInviteEmail({
      ...common,
      inviteUrl: "https://preview.example/assessments/template-a?token=token-b",
      expiresAt: "2026-09-14T12:00:00.000Z",
    });

    const [firstCall, secondCall] = mocks.send.mock.calls.slice(-2);
    const firstKey = firstCall?.[1]?.idempotencyKey;
    const secondKey = secondCall?.[1]?.idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });
});
