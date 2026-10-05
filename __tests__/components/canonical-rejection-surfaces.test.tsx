// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/ui/toast", () => ({
  toastSuccess: mocks.toastSuccess,
  toastError: mocks.toastError,
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
}));

import InterestSelect from "@/app/dashboard/jobs/[id]/applications/InterestSelect";
import CandidateReviewShell, {
  type AppState,
} from "@/components/dashboard/CandidateReviewShell";

const rejectedApplication: AppState = {
  id: "application-1",
  status: "REJECTED",
  recruiterInterest: "REJECTED",
  stateVersion: 2,
  internalNotes: null,
  starred: false,
  createdAt: "2026-10-05T12:00:00.000Z",
  submittedAt: "2026-10-05T12:00:00.000Z",
  reviewingAt: null,
  interviewAt: null,
  offerAt: null,
  hiredAt: null,
  rejectedAt: "2026-10-05T12:05:00.000Z",
  lastViewedAt: null,
  viewCount: 0,
};

describe("canonical rejection surfaces", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends one REJECT_CANDIDATE command from InterestSelect", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          application: {
            status: "REJECTED",
            recruiterInterest: "REJECTED",
            stateVersion: 2,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <InterestSelect
        applicationId="application-1"
        initial="REVIEW"
        initialStateVersion={1}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Por revisar/ }));
    fireEvent.click(screen.getByRole("option", { name: /Descartado/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/applications/application-1/intent");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      intent: "REJECT_CANDIDATE",
      expectedVersion: 1,
    });
  });

  it("does not toggle a terminal CandidateReviewShell rejection back to REVIEW", () => {
    render(
      <CandidateReviewShell
        candidateId="candidate-1"
        candidateName="Candidate"
        candidateSeniority={null}
        candidateLocation={null}
        resumeUrl={null}
        waHref={null}
        fromJobId="job-1"
        jobTitle="Job"
        matchScore={null}
        matchLocked={false}
        applicationId="application-1"
        currentApplication={rejectedApplication}
        navList={[]}
        navIndex={-1}
        slots={{
          summary: <div>Summary</div>,
          profile: <div>Profile</div>,
          cv: null,
          assessments: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Descartar/ }));
    expect(fetch).not.toHaveBeenCalled();
  });
});
