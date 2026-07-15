import { describe, expect, it } from "vitest";
import {
  buildCandidateSignupHref,
  sanitizeInternalCallbackUrl,
} from "@/lib/auth/callback-url";

describe("sanitizeInternalCallbackUrl", () => {
  it("keeps an internal certification callback with query and hash", () => {
    expect(
      sanitizeInternalCallbackUrl(
        "/certificaciones?exam=template-1#skill-sql"
      )
    ).toBe("/certificaciones?exam=template-1#skill-sql");
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\\\evil.example/path",
    "javascript:alert(1)",
  ])("rejects external or unsafe callback %s", (value) => {
    expect(sanitizeInternalCallbackUrl(value, "/jobs")).toBe("/jobs");
  });
});

describe("buildCandidateSignupHref", () => {
  it("routes directly to candidate signup and preserves certification intent", () => {
    const href = buildCandidateSignupHref(
      "/certificaciones?exam=template-1#skill-sql"
    );
    const url = new URL(href, "https://www.taskio.com.mx");

    expect(url.pathname).toBe("/auth/signup/candidate");
    expect(url.searchParams.get("callbackUrl")).toBe(
      "/certificaciones?exam=template-1#skill-sql"
    );
  });
});
