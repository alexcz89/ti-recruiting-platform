// @vitest-environment happy-dom

import { cleanup, render, screen, within } from "@testing-library/react";
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
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Droppable: ({ children }: { children: (...args: unknown[]) => React.ReactNode }) =>
    children(
      { innerRef: vi.fn(), droppableProps: {}, placeholder: null },
      { isDraggingOver: false },
    ),
  Draggable: ({ children }: { children: (...args: unknown[]) => React.ReactNode }) =>
    children(
      { innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} },
      { isDragging: false },
    ),
}));

import KanbanBoard from "@/app/dashboard/jobs/[id]/KanbanBoard";
import InterestSelect from "@/app/dashboard/jobs/[id]/applications/InterestSelect";
import CandidateReviewShell, {
  type AppState,
  type NavEntry,
} from "@/components/dashboard/CandidateReviewShell";
import {
  PRIMARY_RECRUITER_PIPELINE_BUCKETS,
  RECRUITER_PIPELINE_LABELS,
  getRecruiterApplicationReadModel,
} from "@/lib/hiring-process/recruiter-read-model";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const application = {
  id: "application-1",
  status: "REVIEW",
  displayStatus: "INTERVIEW",
  applicationStatus: "INTERVIEW",
  stage: "INTERVIEW",
  disposition: "ACTIVE",
  stateVersion: 3,
  writerCompatibility: "CANONICAL" as const,
  createdAt: "2026-10-10T12:00:00.000Z",
  updatedAt: "2026-10-10T12:00:00.000Z",
  candidate: {
    id: "candidate-1",
    name: "Mixed Cohort Candidate",
    email: "candidate@example.invalid",
  },
};

const currentApplication: AppState = {
  id: "current-application",
  stage: "APPLIED",
  disposition: "ACTIVE",
  status: "SUBMITTED",
  recruiterInterest: "REVIEW",
  stateVersion: 1,
  internalNotes: null,
  starred: false,
  createdAt: "2026-10-10T12:00:00.000Z",
  submittedAt: "2026-10-10T12:00:00.000Z",
  reviewingAt: null,
  interviewAt: null,
  offerAt: null,
  hiredAt: null,
  rejectedAt: null,
  lastViewedAt: null,
  viewCount: 0,
};

describe("recruiter reader surface cutover", () => {
  it("regroups Kanban presentation OFF -> ON -> OFF without invoking its writer", () => {
    const moveAction = vi.fn().mockResolvedValue({ ok: true });
    const { rerender } = render(
      <KanbanBoard
        jobId="job-1"
        statuses={["REVIEW", "MAYBE", "ACCEPTED", "REJECTED"]}
        statusLabels={{
          REVIEW: "Por revisar",
          MAYBE: "Preselecto",
          ACCEPTED: "Entrevista",
          REJECTED: "Descartado",
        }}
        applications={[application]}
        moveAction={moveAction}
      />,
    );

    const legacyReviewColumn = screen
      .getByRole("heading", { name: "Por revisar" })
      .closest('[class*="w-[310px]"]');
    expect(legacyReviewColumn).not.toBeNull();
    expect(
      within(legacyReviewColumn as HTMLElement).getByText("Mixed Cohort Candidate"),
    ).toBeInTheDocument();

    rerender(
      <KanbanBoard
        jobId="job-1"
        statuses={[...PRIMARY_RECRUITER_PIPELINE_BUCKETS]}
        statusLabels={RECRUITER_PIPELINE_LABELS}
        applications={[application]}
        canonicalRecruiterReadsEnabled
        moveAction={moveAction}
      />,
    );
    const canonicalInterviewColumn = screen
      .getByRole("heading", { name: "Entrevista" })
      .closest('[class*="w-[310px]"]');
    expect(canonicalInterviewColumn).not.toBeNull();
    expect(
      within(canonicalInterviewColumn as HTMLElement).getByText(
        "Mixed Cohort Candidate",
      ),
    ).toBeInTheDocument();

    rerender(
      <KanbanBoard
        jobId="job-1"
        statuses={["REVIEW", "MAYBE", "ACCEPTED", "REJECTED"]}
        statusLabels={{
          REVIEW: "Por revisar",
          MAYBE: "Preselecto",
          ACCEPTED: "Entrevista",
          REJECTED: "Descartado",
        }}
        applications={[application]}
        moveAction={moveAction}
      />,
    );
    expect(
      within(
        screen
          .getByRole("heading", { name: "Por revisar" })
          .closest('[class*="w-[310px]"]') as HTMLElement,
      ).getByText("Mixed Cohort Candidate"),
    ).toBeInTheDocument();
    expect(moveAction).not.toHaveBeenCalled();
  });

  it("changes selector presentation OFF -> ON -> OFF without issuing a request", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const props = {
      applicationId: "application-1",
      initial: "ACCEPTED" as const,
      initialStateVersion: 2,
      legacyStatus: "REVIEWING",
      canonicalStage: "REVIEW" as const,
      canonicalDisposition: "ACTIVE" as const,
    };
    const { rerender } = render(<InterestSelect {...props} />);

    expect(screen.getByRole("button", { name: /Entrevista/ })).toBeEnabled();
    rerender(<InterestSelect {...props} canonicalRecruiterReadsEnabled />);
    expect(screen.getByRole("button", { name: /En revisión/ })).toBeEnabled();
    rerender(<InterestSelect {...props} />);
    expect(screen.getByRole("button", { name: /Entrevista/ })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("changes the recruiter rail label without mutating or requesting", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const navEntry = (canonicalReadsEnabled: boolean): NavEntry => ({
      candidateId: "candidate-1",
      applicationId: "application-1",
      name: "Rail Candidate",
      seniority: null,
      location: null,
      readModel: getRecruiterApplicationReadModel(
        {
          stage: "INTERVIEW",
          disposition: "ACTIVE",
          status: "INTERVIEW",
          recruiterInterest: "REVIEW",
        },
        { canonicalReadsEnabled },
      ),
      canonicalRecruiterReadsEnabled: canonicalReadsEnabled,
      starred: false,
    });
    const renderShell = (entry: NavEntry) => (
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
        applicationId="current-application"
        currentApplication={currentApplication}
        navList={[entry]}
        navIndex={-1}
        slots={{
          summary: <div>Summary</div>,
          profile: <div>Profile</div>,
          cv: null,
          assessments: null,
        }}
      />
    );
    const { rerender } = render(renderShell(navEntry(false)));

    expect(screen.getByText("1. Rail Candidate").closest("a")).not.toHaveTextContent(
      "Entrevista",
    );
    rerender(renderShell(navEntry(true)));
    expect(screen.getByText("1. Rail Candidate").closest("a")).toHaveTextContent("Entrevista");
    rerender(renderShell(navEntry(false)));
    expect(screen.getByText("1. Rail Candidate").closest("a")).not.toHaveTextContent(
      "Entrevista",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
