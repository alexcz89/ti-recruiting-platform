// @vitest-environment happy-dom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DropResult } from "@hello-pangea/dnd";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), error: vi.fn(), drag: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/ui/toast", () => ({ toastError: mocks.error, toastSuccess: vi.fn() }));
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (result: DropResult) => void }) => {
    mocks.drag.mockImplementation(onDragEnd);
    return <>{children}</>;
  },
  Droppable: ({ children }: { children: (...args: unknown[]) => React.ReactNode }) => children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }, { isDraggingOver: false }),
  Draggable: ({ children }: { children: (...args: unknown[]) => React.ReactNode }) => children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}));
import InterestSelect from "@/app/dashboard/jobs/[id]/applications/InterestSelect";
import KanbanBoard from "@/app/dashboard/jobs/[id]/KanbanBoard";
import CandidateReviewShell, { type AppState } from "@/components/dashboard/CandidateReviewShell";
import { PRIMARY_RECRUITER_PIPELINE_BUCKETS, RECRUITER_PIPELINE_LABELS } from "@/lib/hiring-process/recruiter-read-model";

const initial: AppState = {
  id: "app-a", stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW", stateVersion: 1,
  internalNotes: null, starred: false, createdAt: "2026-10-01T12:00:00Z", submittedAt: "2026-10-01T12:00:00Z",
  reviewingAt: null, interviewAt: null, offerAt: null, hiredAt: null, rejectedAt: null, lastViewedAt: null, viewCount: 0,
};
const reviewed = { ...initial, stage: "REVIEW" as const, status: "REVIEWING", stateVersion: 2, reviewingAt: "2026-10-02T12:00:00Z" };
const response = () => new Response(JSON.stringify({ application: reviewed }), { status: 200 });
const card = { id: "app-a", stage: "APPLIED", disposition: "ACTIVE", applicationStatus: "SUBMITTED", status: "REVIEW", displayStatus: "APPLIED", stateVersion: 1, writerCompatibility: "CANONICAL" as const, candidate: { id: "candidate-a", name: "Candidate A", email: "a@example.invalid" } };
const boardProps = { jobId: "job-a", statuses: [...PRIMARY_RECRUITER_PIPELINE_BUCKETS], statusLabels: RECRUITER_PIPELINE_LABELS, applications: [card], canonicalRecruiterReadsEnabled: true };
const selector = (reads = true, state = initial) => <InterestSelect applicationId="app-a" initial={state.recruiterInterest as "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED"} initialStateVersion={state.stateVersion} legacyStatus={state.status} canonicalStage={state.stage} canonicalDisposition={state.disposition} canonicalRecruiterReadsEnabled={reads} />;
const profile = (state = initial, reads = true) => <CandidateReviewShell candidateId="candidate-a" candidateName="Candidate A" candidateSeniority={null} candidateLocation={null} resumeUrl={null} waHref={null} fromJobId="job-a" jobTitle="Job" matchScore={null} matchLocked={false} applicationId="app-a" currentApplication={state} canonicalRecruiterReadsEnabled={reads} navList={[]} navIndex={-1} slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }} />;
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("START_REVIEW interactions", () => {
  it.each([true, false])("offers legacy START_REVIEW only with reads=%s enabled", async (reads) => {
    const legacy = { ...initial, stage: null, disposition: null, stateVersion: 0 };
    const saved = { ...legacy, status: "REVIEWING" };
    const fetch = vi.fn(async () => new Response(JSON.stringify({ application: saved })));
    vi.stubGlobal("fetch", fetch);
    const { rerender } = render(selector(reads, legacy));
    if (!reads) {
      expect(screen.queryByRole("button", { name: "Iniciar revisión" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Por revisar/ })).toBeEnabled();
      expect(fetch).not.toHaveBeenCalled();
      return;
    }
    fireEvent.click(screen.getByRole("button", { name: "Iniciar revisión" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    rerender(selector(reads, saved));
    expect(screen.getByRole("button", { name: reads ? /En revisión/ : /Por revisar/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Iniciar revisión" })).not.toBeInTheDocument();
  });

  it.each([true, false])("gates the profile action on reads=%s", (reads) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(profile(initial, reads));
    expect(screen.queryByRole("button", { name: "Iniciar revisión" }) !== null).toBe(reads);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { stage: "REVIEW" as const, disposition: "HOLD" as const },
    { stage: "CLOSED" as const, disposition: "REJECTED" as const },
    { stage: null, disposition: "ACTIVE" as const },
    { stage: null, disposition: null, stateVersion: 1 },
    { status: "HIRED", recruiterInterest: "ACCEPTED" },
    { status: "REJECTED" },
    { recruiterInterest: "REJECTED" },
  ])("does not offer review for an incompatible source %j", (patch) => {
    render(selector(true, { ...initial, ...patch }));
    expect(screen.queryByRole("button", { name: "Iniciar revisión" })).not.toBeInTheDocument();
  });
  it("starts review from the list once and reflects refreshed stage", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const { rerender } = render(selector());
    fireEvent.click(screen.getByRole("button", { name: "Iniciar revisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciando revisión…" }));
    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /Por revisar/ })).toBeDisabled();
    await act(async () => resolve(response()));
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toMatchObject({ intent: "START_REVIEW", expectedVersion: 1, commandId: expect.any(String) });
    rerender(selector(true, reviewed));
    expect(screen.getByRole("button", { name: /En revisión/ })).toBeEnabled();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it.each(["network", "conflict"])("keeps the action usable after %s and reuses the command on retry", async (failure) => {
    const fetch = vi.fn();
    if (failure === "network") fetch.mockRejectedValueOnce(new Error("offline"));
    else fetch.mockResolvedValueOnce(new Response("{}", { status: 409 }));
    fetch.mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetch);
    render(selector());
    fireEvent.click(screen.getByRole("button", { name: "Iniciar revisión" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Iniciar revisión" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Iniciar revisión" })).not.toBeInTheDocument());
    expect(JSON.parse(fetch.mock.calls[0][1].body).commandId).toBe(JSON.parse(fetch.mock.calls[1][1].body).commandId);
  });

  it("refreshes the profile activity without losing unsaved notes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response()));
    const { rerender } = render(profile());
    fireEvent.change(screen.getByPlaceholderText("Escribe tus notas sobre este candidato..."), { target: { value: "Local draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar revisión" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    rerender(profile(reviewed));
    expect(screen.getByText("En revisión")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escribe tus notas sobre este candidato...")).toHaveValue("Local draft");
    expect(screen.queryByRole("button", { name: "Iniciar revisión" })).not.toBeInTheDocument();
  });

  it("supports dragging to Review then quick advancing to Preselecto with the saved version", async () => {
    const move = vi.fn().mockResolvedValue({ ok: true, application: reviewed });
    render(<KanbanBoard {...boardProps} moveAction={move} />);
    act(() => mocks.drag({ draggableId: "app-a", source: { droppableId: "APPLIED", index: 0 }, destination: { droppableId: "REVIEW", index: 0 } }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    const first = move.mock.calls[0][0] as FormData;
    expect(first.get("intent")).toBe("START_REVIEW");
    expect(first.get("expectedVersion")).toBe("1");
    expect(first.get("commandId")).toEqual(expect.any(String));
    fireEvent.click(screen.getByTitle("Mover a Preselecto"));
    await waitFor(() => expect(move).toHaveBeenCalledTimes(2));
    expect((move.mock.calls[1][0] as FormData).get("expectedVersion")).toBe("2");
    expect((move.mock.calls[1][0] as FormData).get("newStatus")).toBe("MAYBE");
  });

  it("restores the original column when the Kanban request rejects", async () => {
    render(<KanbanBoard {...boardProps} moveAction={vi.fn().mockRejectedValue(new Error("offline"))} />);
    fireEvent.click(screen.getByTitle("Mover a En revisión"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce());
    const column = screen.getByRole("heading", { name: "Por revisar" }).closest(".flex-1") as HTMLElement;
    expect(within(column).getByText("Candidate A")).toBeInTheDocument();
  });

  it("retains the legacy column when the reader flag is disabled", () => {
    render(<KanbanBoard {...boardProps} canonicalRecruiterReadsEnabled={false}
      statuses={["REVIEW", "MAYBE", "ACCEPTED", "REJECTED"]}
      statusLabels={{ REVIEW: "Por revisar", MAYBE: "Preselecto", ACCEPTED: "Entrevista", REJECTED: "Descartado" }}
      applications={[{ ...card, applicationStatus: "REVIEWING", displayStatus: "REVIEW" }]} moveAction={vi.fn()} />);
    const column = screen.getByRole("heading", { name: "Por revisar" }).closest(".flex-1") as HTMLElement;
    expect(within(column).getByText("Candidate A")).toBeInTheDocument();
  });
});
