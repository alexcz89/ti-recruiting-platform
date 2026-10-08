// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/ui/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
}));

import InterestSelect from "@/app/dashboard/jobs/[id]/applications/InterestSelect";
import CandidateReviewShell, {
  type AppState,
  type NavEntry,
} from "@/components/dashboard/CandidateReviewShell";
import { getRecruiterApplicationReadModel } from "@/lib/hiring-process/recruiter-read-model";

const baseApplication: AppState = {
  id: "application-current",
  stage: "APPLIED",
  disposition: "ACTIVE",
  status: "SUBMITTED",
  recruiterInterest: "REVIEW",
  stateVersion: 1,
  internalNotes: null,
  starred: false,
  createdAt: "2026-10-08T12:00:00.000Z",
  submittedAt: "2026-10-08T12:00:00.000Z",
  reviewingAt: null,
  interviewAt: null,
  offerAt: null,
  hiredAt: null,
  rejectedAt: null,
  lastViewedAt: null,
  viewCount: 0,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("recruiter reader surfaces", () => {
  it.each([
    ["APPLIED", "ACTIVE", "REVIEW", "Por revisar"],
    ["REVIEW", "ACTIVE", "REVIEW", "En revisión"],
    ["REVIEW", "ACTIVE", "MAYBE", "Preselecto"],
    ["INTERVIEW", "ACTIVE", "REVIEW", "Entrevista"],
    ["OFFER", "ACTIVE", "ACCEPTED", "Oferta"],
    ["CLOSED", "REJECTED", "ACCEPTED", "Descartado"],
    ["CLOSED", "HIRED", "ACCEPTED", "Contratado"],
  ] as const)(
    "shows %s/%s as %s in the candidate rail",
    (stage, disposition, recruiterInterest, label) => {
      const readModel = getRecruiterApplicationReadModel(
        { stage, disposition, status: "SUBMITTED", recruiterInterest },
        { canonicalReadsEnabled: true },
      );
      const navList: NavEntry[] = [
        {
          candidateId: "candidate-rail",
          applicationId: "application-rail",
          name: "Rail Candidate",
          seniority: null,
          location: null,
          readModel,
          canonicalRecruiterReadsEnabled: true,
          starred: false,
        },
      ];

      render(
        <CandidateReviewShell
          candidateId="candidate-current"
          candidateName="Current Candidate"
          candidateSeniority={null}
          candidateLocation={null}
          resumeUrl={null}
          waHref={null}
          fromJobId="job-1"
          jobTitle="Job"
          matchScore={null}
          matchLocked={false}
          applicationId="application-current"
          currentApplication={baseApplication}
          navList={navList}
          navIndex={-1}
          slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }}
        />,
      );

      expect(screen.getByText("1. Rail Candidate").closest("a")).toHaveTextContent(label);
    },
  );

  it("shows canonical Interview instead of stale legacy Review in InterestSelect", () => {
    render(
      <InterestSelect
        applicationId="application-1"
        initial="REVIEW"
        initialStateVersion={3}
        legacyStatus="INTERVIEW"
        canonicalStage="INTERVIEW"
        canonicalDisposition="ACTIVE"
        canonicalRecruiterReadsEnabled
      />,
    );

    expect(screen.getByRole("button", { name: "Entrevista" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Por revisar" })).not.toBeInTheDocument();
  });

  it("preserves the legacy rail presentation while the reader flag is off", () => {
    const navList: NavEntry[] = [
      {
        candidateId: "candidate-rail",
        applicationId: "application-rail",
        name: "Legacy Rail Candidate",
        seniority: null,
        location: null,
        readModel: getRecruiterApplicationReadModel(
          {
            stage: "INTERVIEW",
            disposition: "ACTIVE",
            status: "INTERVIEW",
            recruiterInterest: "REVIEW",
          },
          { canonicalReadsEnabled: false },
        ),
        canonicalRecruiterReadsEnabled: false,
        starred: false,
      },
    ];

    render(
      <CandidateReviewShell
        candidateId="candidate-current"
        candidateName="Current Candidate"
        candidateSeniority={null}
        candidateLocation={null}
        resumeUrl={null}
        waHref={null}
        fromJobId="job-1"
        jobTitle="Job"
        matchScore={null}
        matchLocked={false}
        applicationId="application-current"
        currentApplication={baseApplication}
        navList={navList}
        navIndex={-1}
        slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }}
      />,
    );

    expect(screen.getByText("1. Legacy Rail Candidate").closest("a")).not.toHaveTextContent("Por revisar");
  });

  it("shows Offer and Hired canonically without making them writable", () => {
    const offer = render(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={4}
        legacyStatus="OFFER"
        canonicalStage="OFFER"
        canonicalDisposition="ACTIVE"
        canonicalRecruiterReadsEnabled
      />,
    );
    expect(screen.getByRole("button", { name: "Oferta" })).toBeDisabled();
    offer.unmount();

    render(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={5}
        legacyStatus="HIRED"
        canonicalStage="CLOSED"
        canonicalDisposition="HIRED"
        canonicalRecruiterReadsEnabled
      />,
    );
    expect(screen.getByRole("button", { name: "Contratado" })).toBeDisabled();
  });

  it("keeps the legacy InterestSelect presentation when the reader flag is off", () => {
    render(
      <InterestSelect
        applicationId="application-1"
        initial="REVIEW"
        initialStateVersion={3}
        legacyStatus="INTERVIEW"
        canonicalStage="INTERVIEW"
        canonicalDisposition="ACTIVE"
      />,
    );

    expect(screen.getByRole("button", { name: /Por revisar/ })).toBeEnabled();
  });

  it("uses canonical Review as the current selector option despite stale Accepted", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={2}
        legacyStatus="REVIEWING"
        canonicalStage="REVIEW"
        canonicalDisposition="ACTIVE"
        canonicalRecruiterReadsEnabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /En revisión/ }));
    const review = screen.getByRole("option", { name: /En revisión/ });
    expect(review).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Entrevista/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    fireEvent.click(review);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses Review as the current selector option for canonical Applied", () => {
    render(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={1}
        legacyStatus="SUBMITTED"
        canonicalStage="APPLIED"
        canonicalDisposition="ACTIVE"
        canonicalRecruiterReadsEnabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Por revisar/ }));
    expect(screen.getByRole("option", { name: /Por revisar/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: /Entrevista/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("labels canonical Review correctly and clears canonical Preselected", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          application: {
            stateVersion: 3,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <InterestSelect
        applicationId="application-1"
        initial="MAYBE"
        initialStateVersion={2}
        legacyStatus="REVIEWING"
        canonicalStage="REVIEW"
        canonicalDisposition="ACTIVE"
        canonicalRecruiterReadsEnabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Preselecto/ }));
    expect(screen.getByRole("option", { name: /Preselecto/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("option", { name: /En revisión/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      intent: "CLEAR_PRESELECTED",
      expectedVersion: 2,
    });
  });

  it("keeps legacy option labels and active selection when reader flag is off", () => {
    render(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={2}
        legacyStatus="REVIEWING"
        canonicalStage="REVIEW"
        canonicalDisposition="ACTIVE"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Entrevista/ }));
    expect(screen.getByRole("option", { name: /Entrevista/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: /Por revisar/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});
