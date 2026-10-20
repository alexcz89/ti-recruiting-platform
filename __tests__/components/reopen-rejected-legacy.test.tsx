// @vitest-environment happy-dom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CandidateReviewShell, { type AppState, type ShellProps } from "@/components/dashboard/CandidateReviewShell";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
vi.mock("@/lib/ui/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
const legacy: AppState = {
  id: "app-a", stage: null, disposition: null, stateVersion: 0,
  status: "REJECTED", recruiterInterest: "REJECTED", internalNotes: "Notas A",
  starred: false, createdAt: "2026-10-01", submittedAt: "2026-10-01",
  reviewingAt: null, interviewAt: null, offerAt: null, hiredAt: null,
  rejectedAt: "2026-10-02", lastViewedAt: null, viewCount: 0,
};
function props(app: AppState): ShellProps {
  return { candidateId: app.id, candidateName: app.id, candidateSeniority: null,
    candidateLocation: null, resumeUrl: null, waHref: null, fromJobId: "job",
    jobTitle: "Job", matchScore: null, matchLocked: false, applicationId: app.id,
    currentApplication: app, navList: [], navIndex: -1,
    slots: { summary: null, profile: null, cv: null, assessments: null } };
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([legacy, { ...legacy, stage: "CLOSED", disposition: "REJECTED", stateVersion: 0 } as AppState])(
  "offers reopen for exact rejected representation %#", (app) => {
    render(<CandidateReviewShell {...props(app)} />);
    expect(screen.getByRole("button", { name: "Reabrir proceso" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Preselecto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entrevista" })).not.toBeInTheDocument();
  },
);
it.each([
  { stage: "CLOSED", disposition: "REJECTED", status: "HIRED" },
  { stage: "CLOSED", disposition: "REJECTED", recruiterInterest: "REVIEW" },
  { stage: "CLOSED", disposition: "HIRED" },
  { stage: "CLOSED", disposition: "WITHDRAWN" },
  { stage: "CLOSED", disposition: "CANCELLED" },
  { stage: "CLOSED" }, { disposition: "REJECTED" }, { stateVersion: 1 },
  { status: "REVIEWING" }, { recruiterInterest: "REVIEW" },
])("does not reopen inconsistent/terminal tuple %j", (patch) => {
  render(<CandidateReviewShell {...props({ ...legacy, ...patch } as AppState)} />);
  expect(screen.queryByRole("button", { name: "Reabrir proceso" })).not.toBeInTheDocument();
});
function confirm() {
  fireEvent.click(screen.getByRole("button", { name: "Reabrir proceso" }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "ADDITIONAL_REVIEW" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
}
it.each(["Preselecto", "Entrevista"])("reopens legacy then sends normal %s intent", async (label) => {
  const reopened = { ...legacy, status: "REVIEWING", recruiterInterest: "REVIEW", rejectedAt: null };
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ application: reopened })));
  render(<CandidateReviewShell {...props(legacy)} />);
  confirm();
  await waitFor(() => expect(screen.queryByRole("button", { name: "Reabrir proceso" })).not.toBeInTheDocument());
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
    intent: "REOPEN_REJECTED", expectedVersion: 0, commandId: expect.any(String), reasonCode: "ADDITIONAL_REVIEW",
  });
  expect(mocks.refresh).toHaveBeenCalled();
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ application: reopened })));
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)).intent)
    .toBe(label === "Preselecto" ? "MARK_PRESELECTED" : "MOVE_TO_INTERVIEW");
});
it.each([409, 422])("keeps rejection and explains HTTP %s", async (status) => {
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status }));
  render(<CandidateReviewShell {...props(legacy)} />);
  confirm();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(status === 409 ? /cambió/ : /estado actual/));
  expect(screen.queryByRole("button", { name: "Preselecto" })).not.toBeInTheDocument();
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("resets application, notes and dialog when navigating to another candidate", () => {
  const { rerender } = render(<CandidateReviewShell {...props(legacy)} />);
  fireEvent.click(screen.getByRole("button", { name: "Reabrir proceso" }));
  const next = { ...legacy, id: "app-b", status: "REVIEWING", recruiterInterest: "REVIEW", internalNotes: "Notas B" };
  rerender(<CandidateReviewShell {...props(next)} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Escribe tus notas sobre este candidato...")).toHaveValue("Notas B");
  expect(screen.getByRole("button", { name: "Preselecto" })).toBeEnabled();
  expect(fetch).not.toHaveBeenCalled();
});

it("isolates a pending reopen response from the next candidate", async () => {
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
  const { rerender } = render(<CandidateReviewShell {...props(legacy)} />);
  confirm();
  const next = { ...legacy, id: "app-b", internalNotes: "Notas B" };
  rerender(<CandidateReviewShell {...props(next)} />);
  resolve(new Response(JSON.stringify({ application: {
    ...legacy, status: "REVIEWING", recruiterInterest: "REVIEW", rejectedAt: null,
  } })));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "Reabrir proceso" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Preselecto" })).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Escribe tus notas sobre este candidato...")).toHaveValue("Notas B");
});

it("preserves rejected state on network failure", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  render(<CandidateReviewShell {...props(legacy)} />);
  confirm();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se pudo actualizar"));
  expect(screen.queryByRole("button", { name: "Preselecto" })).not.toBeInTheDocument();
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it.each([375, 768, 1024, 1366, 1440, 1920])(
  "keeps identity and wrapping actions in separate rows at %ipx",
  (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const active = {
      ...legacy,
      status: "REVIEWING",
      recruiterInterest: "REVIEW",
      rejectedAt: null,
    };
    const shellProps = {
      ...props(active),
      candidateName: "Nombre de candidato extraordinariamente largo para validar el encabezado",
      candidateLocation: "San Nicolás de los Garza, Nuevo León, México",
      waHref: "https://wa.me/5215555555555",
      resumeUrl: "https://example.com/cv.pdf",
    };
    render(<CandidateReviewShell {...shellProps} />);

    const layout = screen.getByTestId("candidate-header-layout");
    const actions = screen.getByTestId("candidate-header-actions");
    expect(layout).toHaveClass("flex-col", "min-w-0");
    expect(layout).not.toHaveClass("sm:flex-row");
    expect(actions).toHaveClass("w-full", "min-w-0", "flex-wrap");
    expect(actions).not.toHaveClass("shrink-0");
    expect(within(actions).getByRole("button", { name: "Preselecto" })).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "Entrevista" })).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "Descartar" })).toBeEnabled();
    expect(within(actions).getByRole("link", { name: "WA" })).toBeVisible();
    expect(within(actions).getByRole("link", { name: "CV" })).toBeVisible();
    expect(within(actions).getByRole("link", { name: "Pipeline" })).toBeVisible();
    cleanup();
  },
);

it("renders only rejected workflow controls while preserving utilities", () => {
  render(<CandidateReviewShell {...{
    ...props(legacy),
    waHref: "https://wa.me/5215555555555",
    resumeUrl: "https://example.com/cv.pdf",
  }} />);
  const actions = screen.getByTestId("candidate-header-actions");
  expect(within(actions).getByText("Descartado")).toBeVisible();
  expect(within(actions).getByRole("button", { name: "Reabrir proceso" })).toBeEnabled();
  expect(within(actions).queryByRole("button", { name: "Preselecto" })).not.toBeInTheDocument();
  expect(within(actions).queryByRole("button", { name: "Entrevista" })).not.toBeInTheDocument();
  expect(within(actions).queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
  expect(within(actions).getByRole("link", { name: "WA" })).toBeVisible();
  expect(within(actions).getByRole("link", { name: "CV" })).toBeVisible();
  expect(within(actions).getByRole("link", { name: "Pipeline" })).toBeVisible();
});
