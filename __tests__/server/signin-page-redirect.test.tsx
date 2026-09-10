import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/components/ui/Skeleton", () => ({ FormSkeleton: () => null }));
vi.mock("@/app/auth/signin/SignInUnified", () => ({ default: () => null }));

vi.stubGlobal("React", React);

const { default: SignInPage } = await import("@/app/auth/signin/page");

function session(role: "CANDIDATE" | "RECRUITER") {
  return {
    user: { id: `${role.toLowerCase()}-1`, role },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

describe("/auth/signin authenticated redirects", () => {
  beforeEach(() => {
    mocks.getServerSession.mockResolvedValue(null);
  });

  it("redirects an authenticated recruiter to the recruiter overview", async () => {
    mocks.getServerSession.mockResolvedValue(session("RECRUITER"));

    await expect(
      Promise.resolve().then(() => SignInPage({ searchParams: {} }))
    ).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/overview"
    );
  });

  it("redirects an authenticated candidate to the candidate profile summary", async () => {
    mocks.getServerSession.mockResolvedValue(session("CANDIDATE"));

    await expect(
      Promise.resolve().then(() => SignInPage({ searchParams: {} }))
    ).rejects.toThrow(
      "NEXT_REDIRECT:/profile/summary"
    );
  });

  it("renders the sign-in form without redirect after sign-out", async () => {
    await expect(
      Promise.resolve().then(() => SignInPage({ searchParams: {} }))
    ).resolves.toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
