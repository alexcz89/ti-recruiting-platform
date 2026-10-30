// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { getRecruitingPresentation } from "@/lib/hiring-process/recruiting-presentation";

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
    ["APPLIED", "ACTIVE", "SUBMITTED", "REVIEW", "Por revisar"],
    ["REVIEW", "ACTIVE", "REVIEWING", "REVIEW", "En revisión"],
    ["REVIEW", "ACTIVE", "REVIEWING", "MAYBE", "Preselecto"],
    ["INTERVIEW", "ACTIVE", "INTERVIEW", "ACCEPTED", "Entrevista"],
    ["OFFER", "ACTIVE", "OFFER", "ACCEPTED", "Oferta"],
    ["CLOSED", "REJECTED", "REJECTED", "REJECTED", "Descartado"],
    ["CLOSED", "HIRED", "HIRED", "ACCEPTED", "Contratado"],
  ] as const)(
    "shows %s/%s as %s in the candidate rail",
    (stage, disposition, status, recruiterInterest, label) => {
      const presentation = getRecruitingPresentation(
        { stage, disposition, status, recruiterInterest, stateVersion: 2 },
        true,
      );
      const navList: NavEntry[] = [
        {
          candidateId: "candidate-rail",
          applicationId: "application-rail",
          name: "Rail Candidate",
          seniority: null,
          location: null,
          presentation,
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

  it.each([true, false])("separates process state, preselection and authorized actions with reads=%s", async reads => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: { stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 3 } })));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect applicationId="app" initial="MAYBE" initialStateVersion={2} legacyStatus="REVIEWING" canonicalStage="REVIEW" canonicalDisposition="ACTIVE" canonicalRecruiterReadsEnabled={reads} />);
    expect(screen.getByText("En revisión")).toBeInTheDocument();
    expect(screen.getByText("Preselecto")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Acciones de candidatura" }), { target: { value: "CLEAR_PRESELECTED" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "CLEAR_PRESELECTED", expectedVersion: 2 });
    await waitFor(() => expect(screen.queryByText("Preselecto")).not.toBeInTheDocument());
  });
  it.each([true, false])("does not offer transitions for inconsistent rows with reads=%s", reads => {
    render(<InterestSelect applicationId="app" initial="ACCEPTED" initialStateVersion={2} legacyStatus="REVIEWING" canonicalStage="REVIEW" canonicalDisposition="ACTIVE" canonicalRecruiterReadsEnabled={reads} />);
    expect(screen.getByText("Requiere conciliación")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("keeps hired terminal and offers only rejection for an active offer", () => {
    const view = render(<InterestSelect applicationId="app" initial="ACCEPTED" initialStateVersion={4} legacyStatus="OFFER" canonicalStage="OFFER" canonicalDisposition="ACTIVE" canonicalRecruiterReadsEnabled />);
    expect(screen.getByText("Oferta")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Pasar a entrevista" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Descartar" })).toBeInTheDocument();
    view.rerender(<InterestSelect applicationId="app" initial="ACCEPTED" initialStateVersion={5} legacyStatus="HIRED" canonicalStage="CLOSED" canonicalDisposition="HIRED" canonicalRecruiterReadsEnabled />);
    expect(screen.getByText("Contratado")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it.each([true, false])("uses the same process label in list and profile with reads=%s", reads => {
    const cases = [
      { stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW", label: "Por revisar" },
      { stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "MAYBE", label: "En revisión" },
      { stage: "ASSESSMENT", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", label: "En revisión" },
      { stage: "INTERVIEW", disposition: "ACTIVE", status: "INTERVIEW", recruiterInterest: "ACCEPTED", label: "Entrevista" },
      { stage: "OFFER", disposition: "ACTIVE", status: "OFFER", recruiterInterest: "ACCEPTED", label: "Oferta" },
      { stage: "CLOSED", disposition: "WITHDRAWN", status: "REVIEWING", recruiterInterest: "REVIEW", label: "Retirado" },
      { stage: "CLOSED", disposition: "CANCELLED", status: "REVIEWING", recruiterInterest: "REVIEW", label: "Cancelado" },
      { stage: "REVIEW", disposition: "HOLD", status: "REVIEWING", recruiterInterest: "REVIEW", label: "En pausa" },
    ] as const;
    for (const state of cases) {
      const list = render(<InterestSelect applicationId="app" initial={state.recruiterInterest} initialStateVersion={2} legacyStatus={state.status} canonicalStage={state.stage} canonicalDisposition={state.disposition} canonicalRecruiterReadsEnabled={reads} />);
      expect(within(list.container).getByText(state.label)).toBeInTheDocument();
      const profile = render(<CandidateReviewShell candidateId="c" candidateName="Candidate" candidateSeniority={null} candidateLocation={null} resumeUrl={null} waHref={null} fromJobId="j" jobTitle="Job" matchScore={null} matchLocked={false} applicationId="app" currentApplication={{ ...baseApplication, ...state }} canonicalRecruiterReadsEnabled={reads} navList={[]} navIndex={-1} slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }} />);
      expect(within(profile.container).getAllByText(state.recruiterInterest === "MAYBE" ? "En revisión · Preselecto" : state.stage === "ASSESSMENT" ? "En revisión · Evaluación técnica" : state.label).length).toBeGreaterThan(0);
      list.unmount(); profile.unmount();
    }
  });

});
