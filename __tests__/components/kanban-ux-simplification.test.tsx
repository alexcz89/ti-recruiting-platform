// @vitest-environment happy-dom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DropResult } from "@hello-pangea/dnd";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), error: vi.fn(), drag: vi.fn(), dragStart: vi.fn(), targets: vi.fn(), draggables: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/ui/toast", () => ({ toastError: mocks.error }));
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (result: DropResult) => void }) => {
    mocks.drag.mockImplementation(onDragEnd); return <>{children}</>;
  },
  Droppable: ({ children, droppableId }: { children: (...args: unknown[]) => React.ReactNode; droppableId: string }) => { mocks.targets(droppableId); return children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }, { isDraggingOver: false }); },
  Draggable: ({ children, draggableId, isDragDisabled }: { children: (...args: unknown[]) => React.ReactNode; draggableId: string; isDragDisabled: boolean }) => { mocks.draggables(draggableId, isDragDisabled); return children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: { onMouseDown: mocks.dragStart } }, { isDragging: false }); },
}));
import KanbanBoard from "@/app/dashboard/jobs/[id]/KanbanBoard";
import { RECRUITER_PIPELINE as PRIMARY_RECRUITER_PIPELINE_BUCKETS, RECRUITER_PIPELINE_STATE_LABELS as RECRUITER_PIPELINE_LABELS } from "@/lib/hiring-process/recruiting-presentation";
const card = { id: "app-a", stage: "APPLIED", disposition: "ACTIVE", applicationStatus: "SUBMITTED", status: "REVIEW", displayStatus: "APPLIED", stateVersion: 1, writerCompatibility: "CANONICAL" as const,
  candidate: { id: "candidate-a", name: "Nombre de candidato extraordinariamente largo para verificar que no se trunca", email: "a@example.invalid", city: "México", location: "Ubicación ambigua" }, _score: 61, _locked: false,
  _assessments: [{ state: "COMPLETED" as const, score: 85, passed: true, attemptId: "attempt-a", templateTitle: "Prueba técnica" }] };
const props = { jobId: "job-a", statuses: [...PRIMARY_RECRUITER_PIPELINE_BUCKETS], statusLabels: RECRUITER_PIPELINE_LABELS, applications: [card], canonicalRecruiterReadsEnabled: true, hasMatchSignals: true };
const drop = (source = "APPLIED", destination = "REVIEW") => ({ draggableId: "app-a", source: { droppableId: source, index: 0 }, destination: { droppableId: destination, index: 0 } } as DropResult);
beforeEach(() => { vi.clearAllMocks(); window.sessionStorage.clear(); vi.stubGlobal("React", React); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("marks only applied candidates as overdue based on submittedAt", () => {
  const oldDate = new Date(Date.now() - 10 * 86_400_000);
  const recentDate = new Date();

  const pending = {
    ...card,
    submittedAt: oldDate,
    updatedAt: recentDate,
  };

  const view = render(
    <KanbanBoard
      {...props}
      applications={[pending]}
      moveAction={vi.fn()}
    />
  );

  expect(
    screen.getAllByText(/Pendiente de revisión desde hace \d+ días/)
  ).toHaveLength(2);

  view.rerender(
    <KanbanBoard
      {...props}
      applications={[{
        ...pending,
        stage: "REVIEW",
        applicationStatus: "REVIEWING",
        displayStatus: "REVIEW",
      }]}
      moveAction={vi.fn()}
    />
  );

  expect(
    screen.queryByText(/Pendiente de revisión desde hace \d+ días/)
  ).not.toBeInTheDocument();
});
it("shows the same authorized essentials on desktop and mobile, with a stage selector", () => {
  render(<KanbanBoard {...props} moveAction={vi.fn()} />);
  expect(screen.getAllByRole("link", { name: card.candidate.name })).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: card.candidate.name })[0]).toHaveAttribute("href", "/dashboard/candidates/candidate-a?jobId=job-a&applicationId=app-a");
  expect(screen.getAllByText("México")).toHaveLength(2);
  expect(screen.getAllByText("61%")).toHaveLength(2);
  expect(screen.getAllByText(/85%/).length).toBeGreaterThan(0);
  expect(screen.queryByText("Ubicación ambigua")).not.toBeInTheDocument();
  expect(screen.queryByText("Ver perfil")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /Cambiar etapa de/ })).toHaveLength(2);
  const selector = screen.getByRole("combobox", { name: "Etapa" });
  fireEvent.change(selector, { target: { value: "REVIEW" } });
  expect(screen.getByText("No hay candidatos en esta etapa.")).toBeInTheDocument();
  expect(selector).toHaveValue("REVIEW");
});

it("renders exactly five balanced columns with compact actions and no secondary sections", () => {
  render(<KanbanBoard {...props} moveAction={vi.fn()} />);
  const triggers = screen.getAllByRole("button", { name: `Cambiar etapa de ${card.candidate.name}` });
  for (const trigger of triggers) {
    expect(trigger).toHaveClass("h-11", "w-11");
    expect(trigger.textContent).toBe("");
  }
  const grid = screen.getByRole("region", { name: "Por revisar" }).parentElement!;
  expect(grid).toHaveClass("grid", "grid-cols-5");
  expect(grid.children).toHaveLength(5);
  expect(grid).not.toHaveClass("w-max");
  expect([...new Set(mocks.targets.mock.calls.flat())]).toEqual([...PRIMARY_RECRUITER_PIPELINE_BUCKETS]);
  expect(document.querySelectorAll("details, summary")).toHaveLength(0);
  expect(screen.queryByRole("region", { name: "Finalizados" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Ver resultados de Prueba técnica" })).toHaveLength(2);
});
it("omits missing city and locked score without inventing a location", () => {
  render(<KanbanBoard {...props} applications={[{ ...card, candidate: { ...card.candidate, city: null }, _score: null, _locked: true, _assessments: [] }]} moveAction={vi.fn()} />);
  expect(screen.queryByText("México")).not.toBeInTheDocument();
  expect(screen.queryByText("Ubicación ambigua")).not.toBeInTheDocument();
  expect(screen.queryByText("61%")).not.toBeInTheDocument();
  expect(screen.getAllByText("Pro")).toHaveLength(2);
});
it("keeps long candidate names and assessment titles readable with a results focus target", () => {
  const title = "Evaluación técnica de arquitectura y programación con un nombre especialmente largo";
  render(<KanbanBoard {...props} applications={[{ ...card, _assessments: [{ ...card._assessments[0], templateTitle: title }] }]} moveAction={vi.fn()} />);
  expect(screen.getAllByRole("link", { name: card.candidate.name })[0]).toHaveClass(
    "[overflow-wrap:anywhere]",
    "text-zinc-900",
    "dark:text-zinc-50"
  );
  expect(screen.getAllByText(title)).toHaveLength(2);
  expect(screen.getAllByText(title)[0]).toHaveClass(
    "[overflow-wrap:anywhere]",
    "text-xs",
    "leading-5"
  );
  expect(screen.getAllByText(title)[0]).not.toHaveClass("line-clamp-2");
  expect(screen.queryByText(`${title.slice(0, 21)}…`)).not.toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: `Ver resultados de ${title}` })[0]).toHaveClass("focus-visible:outline");
});
it("holds columns and counts until the server confirms, then moves once", async () => {
  let finish!: (value: { ok: boolean; application?: { stage: string; disposition: string; stateVersion: number; status: string; recruiterInterest: string } }) => void;
  const moveAction = vi.fn(() => new Promise<Parameters<typeof finish>[0]>((resolve) => { finish = resolve; }));
  render(<KanbanBoard {...props} moveAction={moveAction} />);
  act(() => { mocks.drag(drop()); });
  expect(moveAction).toHaveBeenCalledOnce();
  expect(screen.getAllByText("Por revisar").length).toBeGreaterThan(0);
  expect(screen.getByRole("option", { name: /Por revisar \(1\)/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /En revisión \(0\)/ })).toBeInTheDocument();
  act(() => { mocks.drag(drop()); });
  expect(moveAction).toHaveBeenCalledOnce();
  await act(async () => finish({ ok: true, application: { stage: "REVIEW", disposition: "ACTIVE", stateVersion: 2, status: "REVIEWING", recruiterInterest: "REVIEW" } }));
  await waitFor(() => expect(screen.getByRole("option", { name: /En revisión \(1\)/ })).toBeInTheDocument());
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it("retains source and counts after a conflict or rejected transition", async () => {
  const moveAction = vi.fn(async () => ({ ok: false, message: "conflict" }));
  render(<KanbanBoard {...props} moveAction={moveAction} />);
  await act(async () => mocks.drag(drop()));
  expect(screen.getByRole("option", { name: /Por revisar \(1\)/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /En revisión \(0\)/ })).toBeInTheDocument();
  expect(mocks.error).toHaveBeenCalledOnce();
});

it.each([true, false])("confirms Kanban discard before changing counters with canonical reads=%s", async reads => {
  let finish!: (response: Response) => void;
  const fetch = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const sourceCard = reads ? card : { ...card, stage: null, disposition: null, stateVersion: 0,
    writerCompatibility: "LEGACY" as const };
  render(<KanbanBoard {...props} applications={[sourceCard]} canonicalRecruiterReadsEnabled={reads} moveAction={vi.fn()} />);
  const menuButton = screen.getAllByRole("button", { name: `Cambiar etapa de ${card.candidate.name}` })[0];
  fireEvent.mouseDown(menuButton);
  expect(mocks.dragStart).not.toHaveBeenCalled();
  fireEvent.pointerDown(menuButton, { button: 0, ctrlKey: false });
  expect(await screen.findByRole("menuitem", { name: "Descartado" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Contratar" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Descartado" }));
  expect(screen.getByRole("dialog", { name: "Descartar candidato" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Guardando…" }));
  expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body ?? ""))).toMatchObject({ intent: "SET_RECRUITING_STATE", destination: "REJECTED", expectedVersion: reads ? 1 : 0, commandId: expect.any(String) });
  expect(screen.getByRole("option", { name: "Por revisar (1)" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Descartado (0)" })).toBeInTheDocument();
  await act(async () => finish(new Response(JSON.stringify({ application: reads
    ? { stage: "CLOSED", disposition: "REJECTED", status: "REJECTED", recruiterInterest: "REJECTED", stateVersion: 2 }
    : { stage: null, disposition: null, status: "REJECTED", recruiterInterest: "REJECTED", stateVersion: 0 },
  }))));
  await waitFor(() => expect(screen.getByRole("option", { name: "Por revisar (0)" })).toBeInTheDocument());
  expect(screen.getByRole("option", { name: "Descartado (1)" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Etapa" }), { target: { value: "REJECTED" } });
  expect(screen.getAllByRole("link", { name: card.candidate.name }).length).toBeGreaterThan(0);
});

it("keeps Kanban counters and the candidate when discard is rejected", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "private metadata" }), { status: 409 }));
  vi.stubGlobal("fetch", fetch);
  render(<KanbanBoard {...props} moveAction={vi.fn()} />);
  fireEvent.pointerDown(screen.getAllByRole("button", { name: `Cambiar etapa de ${card.candidate.name}` })[0], { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Descartado" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(screen.getByRole("option", { name: "Por revisar (1)" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Descartado (0)" })).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Descartar candidato" })).toBeInTheDocument();
  expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("private metadata");
});

it("offers audited moves for terminal cards but none for incompatible cards", () => {
  const terminal = { ...card, id: "closed", stage: "CLOSED", disposition: "REJECTED", applicationStatus: "REJECTED", status: "REJECTED",
    candidate: { ...card.candidate, name: "Closed" } };
  const incompatible = { ...card, id: "invalid", writerCompatibility: "NONE" as const, candidate: { ...card.candidate, name: "Invalid" } };
  render(<KanbanBoard {...props} applications={[terminal, incompatible]} moveAction={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Etapa" }), { target: { value: "REJECTED" } });
  expect(screen.getAllByRole("button", { name: "Cambiar etapa de Closed" })[0]).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Cambiar etapa de Invalid" })).not.toBeInTheDocument();
});

it("uses the persisted state to classify a successful response that differs from the requested column", async () => {
  const moveAction = vi.fn(async () => ({ ok: true, application: {
    stage: "CLOSED", disposition: "REJECTED", stateVersion: 2,
    status: "REJECTED", recruiterInterest: "REJECTED",
  } }));
  render(<KanbanBoard {...props} moveAction={moveAction} />);
  await act(async () => mocks.drag(drop("APPLIED", "REVIEW")));
  expect(moveAction).toHaveBeenCalledOnce();
  expect(screen.getByRole("option", { name: /Por revisar \(0\)/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /En revisión \(0\)/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Descartado (1)" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Etapa" }), { target: { value: "REJECTED" } });
  expect(screen.getAllByRole("link", { name: card.candidate.name }).length).toBeGreaterThan(0);
});
it("restores the selected mobile stage after navigating to a profile and returning to the same job", () => {
  const view = render(<KanbanBoard {...props} moveAction={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Etapa" }), { target: { value: "REVIEW" } });
  expect(window.sessionStorage.getItem("kanban-stage:job-a")).toBe("REVIEW");
  view.unmount();
  render(<KanbanBoard {...props} moveAction={vi.fn()} />);
  expect(screen.getByRole("combobox", { name: "Etapa" })).toHaveValue("REVIEW");
});
it.each([true, false])("keeps canonical and legacy columns distinct with reader flag %s", (reads) => {
  const states = [...props.statuses];
  const applications = [
    { ...card, id: "active", displayStatus: "REVIEW", stage: "REVIEW", applicationStatus: "REVIEWING", status: "REVIEW", candidate: { ...card.candidate, name: "Active" } },
    { ...card, id: "legacy", displayStatus: reads ? "APPLIED" : "REVIEW", stage: null, disposition: null, stateVersion: 0, status: "REVIEW", writerCompatibility: "LEGACY" as const, candidate: { ...card.candidate, name: "Legacy" } },
    { ...card, id: "hired", displayStatus: "HIRED", stage: "CLOSED", disposition: "HIRED", applicationStatus: "HIRED", status: "ACCEPTED", candidate: { ...card.candidate, name: "Hired" } },
    { ...card, id: "hold", displayStatus: "HOLD", stage: "REVIEW", disposition: "HOLD", applicationStatus: "REVIEWING", status: "REVIEW", candidate: { ...card.candidate, name: "Hold" } },
    { ...card, id: "closed", displayStatus: "CLOSED_OTHER", stage: "CLOSED", disposition: "CANCELLED", status: "REVIEW", candidate: { ...card.candidate, name: "Closed" } },
  ];
  render(<KanbanBoard {...props} statuses={states} statusLabels={RECRUITER_PIPELINE_LABELS} applications={applications} canonicalRecruiterReadsEnabled={reads} moveAction={vi.fn()} />);
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
  expect(screen.getByRole("option", { name: /En revisión \(2\)/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /Por revisar \(1\)/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Hold" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Hired" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cambiar etapa de Hired" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Closed" })).toBeInTheDocument();
});

it("keeps each job's mobile stage separate and restores it when returning", () => {
  const moveAction = vi.fn();
  const view = render(<KanbanBoard {...props} moveAction={moveAction} />);
  const selector = () => screen.getByRole("combobox", { name: "Etapa" });
  fireEvent.change(selector(), { target: { value: "REVIEW" } });
  expect(selector()).toHaveValue("REVIEW");
  view.rerender(<KanbanBoard {...props} jobId="job-b" moveAction={moveAction} />);
  expect(selector()).toHaveValue("APPLIED");
  fireEvent.change(selector(), { target: { value: "INTERVIEW" } });
  view.rerender(<KanbanBoard {...props} jobId="job-a" moveAction={moveAction} />);
  expect(selector()).toHaveValue("REVIEW");
  view.rerender(<KanbanBoard {...props} jobId="job-b" moveAction={moveAction} />);
  expect(selector()).toHaveValue("INTERVIEW");
});
it("falls back for invalid saved stages and keeps working when browser storage fails", () => {
  window.sessionStorage.setItem("kanban-stage:job-b", "NOT_A_STAGE");
  const read = vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const write = vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  const moveAction = vi.fn();
  const view = render(<KanbanBoard {...props} moveAction={moveAction} />);
  const selector = () => screen.getByRole("combobox", { name: "Etapa" });
  fireEvent.change(selector(), { target: { value: "REVIEW" } });
  expect(selector()).toHaveValue("REVIEW");
  view.rerender(<KanbanBoard {...props} jobId="job-b" moveAction={moveAction} />);
  expect(selector()).toHaveValue("APPLIED");
  fireEvent.change(selector(), { target: { value: "INTERVIEW" } });
  expect(selector()).toHaveValue("INTERVIEW");
  expect(read).toHaveBeenCalled();
  expect(write).toHaveBeenCalled();
  read.mockRestore(); write.mockRestore();
});

it("ignores a saved stage that is unavailable for the new job", () => {
  window.sessionStorage.setItem("kanban-stage:job-b", "NOT_A_STAGE");
  const view = render(<KanbanBoard {...props} moveAction={vi.fn()} />);
  view.rerender(<KanbanBoard {...props} jobId="job-b" moveAction={vi.fn()} />);
  expect(screen.getByRole("combobox", { name: "Etapa" })).toHaveValue("APPLIED");
});

it("requires confirmation before dropping an interview into Contratado and keeps hiring terminal", async () => {
  const interview = { ...card, stage: "INTERVIEW", applicationStatus: "INTERVIEW", status: "ACCEPTED", displayStatus: "INTERVIEW" };
  const move = vi.fn().mockResolvedValue({ ok: true, application: { stage: "CLOSED", disposition: "HIRED", stateVersion: 2, status: "HIRED", recruiterInterest: "ACCEPTED" } });
  render(<KanbanBoard {...props} applications={[interview]} moveAction={move} />);
  act(() => mocks.drag(drop("INTERVIEW", "HIRED")));
  expect(move).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Contratar candidato" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(move).toHaveBeenCalledOnce());
  expect(Object.fromEntries(move.mock.calls[0][0].entries())).toMatchObject({ intent: "SET_RECRUITING_STATE", destination: "HIRED", expectedVersion: "1" });
  await waitFor(() => expect(screen.getByRole("option", { name: "Contratado (1)" })).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: `Cambiar etapa de ${card.candidate.name}` })).not.toBeInTheDocument();
  act(() => mocks.drag(drop("HIRED", "REVIEW")));
  expect(move).toHaveBeenCalledOnce();
});
it.each([true, false])("moves REVIEW → INTERVIEW directly by drag and INTERVIEW → REVIEW after a reason, reads=%s", async reads => {
  const review = { ...card, stage: "REVIEW", applicationStatus: "REVIEWING", status: "REVIEW", displayStatus: "REVIEW" };
  const move = vi.fn().mockResolvedValueOnce({ ok: true, application: { stage: "INTERVIEW", disposition: "ACTIVE", stateVersion: 2, status: "INTERVIEW", recruiterInterest: "ACCEPTED" } })
    .mockResolvedValueOnce({ ok: true, application: { stage: "REVIEW", disposition: "ACTIVE", stateVersion: 3, status: "REVIEWING", recruiterInterest: "REVIEW" } });
  render(<KanbanBoard {...props} applications={[review]} canonicalRecruiterReadsEnabled={reads} moveAction={move} />);
  await act(async () => mocks.drag(drop("REVIEW", "INTERVIEW")));
  expect(move).toHaveBeenCalledOnce();
  expect(move.mock.calls[0][0].get("destination")).toBe("INTERVIEW");
  expect(screen.getByRole("option", { name: "Entrevista (1)" })).toBeInTheDocument();
  act(() => mocks.drag(drop("INTERVIEW", "REVIEW")));
  expect(screen.getByRole("dialog", { name: "Regresar a En revisión" })).toBeInTheDocument();
  expect(move).toHaveBeenCalledOnce();
  expect(screen.getByRole("option", { name: "Entrevista (1)" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(move).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "CORRECTION" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(move).toHaveBeenCalledTimes(2));
  expect(Object.fromEntries(move.mock.calls[1][0].entries())).toMatchObject({ intent: "SET_RECRUITING_STATE", destination: "REVIEW", expectedVersion: "2", reasonCode: "CORRECTION", commandId: expect.any(String) });
  await waitFor(() => expect(screen.getByRole("option", { name: "En revisión (1)" })).toBeInTheDocument());
  expect(screen.getByRole("option", { name: "Entrevista (0)" })).toBeInTheDocument();
});
it("allows APPLIED → INTERVIEW and INTERVIEW → APPLIED without intermediate writes", async () => {
  const move = vi.fn().mockResolvedValueOnce({ ok: true, application: { stage: "INTERVIEW", disposition: "ACTIVE", stateVersion: 2, status: "INTERVIEW", recruiterInterest: "ACCEPTED" } });
  const view = render(<KanbanBoard {...props} moveAction={move} />);
  await act(async () => mocks.drag(drop("APPLIED", "INTERVIEW")));
  expect(move).toHaveBeenCalledOnce();
  expect(move.mock.calls[0][0].get("destination")).toBe("INTERVIEW");
  view.rerender(<KanbanBoard {...props} applications={[{ ...card, stage: "INTERVIEW", applicationStatus: "INTERVIEW", status: "ACCEPTED" }]} moveAction={move} />);
  act(() => mocks.drag(drop("INTERVIEW", "APPLIED")));
  expect(screen.getByRole("dialog", { name: "Regresar a Por revisar" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "PROCESS_CHANGE" } });
  move.mockResolvedValueOnce({ ok: true, application: { stage: "APPLIED", disposition: "ACTIVE", stateVersion: 2, status: "SUBMITTED", recruiterInterest: "REVIEW" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(move).toHaveBeenCalledTimes(2));
  expect(move.mock.calls[1][0].get("destination")).toBe("APPLIED");
});
it.each(["REVIEW", "INTERVIEW"])("reopens a discarded candidate through the mobile card control directly to %s", async destination => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: { stage: destination, disposition: "ACTIVE", stateVersion: 3,
    status: destination === "INTERVIEW" ? "INTERVIEW" : "REVIEWING", recruiterInterest: destination === "INTERVIEW" ? "ACCEPTED" : "REVIEW" } })));
  vi.stubGlobal("fetch", fetch);
  const closed = { ...card, stage: "CLOSED", disposition: "REJECTED", applicationStatus: "REJECTED", status: "REJECTED", stateVersion: 2 };
  render(<KanbanBoard {...props} applications={[closed]} moveAction={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Etapa" }), { target: { value: "REJECTED" } });
  const mobile = screen.getByRole("combobox", { name: "Etapa" }).parentElement!;
  const trigger = within(mobile).getByRole("button", { name: `Cambiar etapa de ${card.candidate.name}` });
  trigger.focus(); fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: destination === "INTERVIEW" ? "Entrevista" : "En revisión" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "RECONSIDERED" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "SET_RECRUITING_STATE", destination, expectedVersion: 2, reasonCode: "RECONSIDERED" });
  await waitFor(() => expect(screen.getByRole("option", { name: "Descartado (0)" })).toBeInTheDocument());
  expect(screen.getByRole("option", { name: `${destination === "INTERVIEW" ? "Entrevista" : "En revisión"} (1)` })).toBeInTheDocument();
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it("does not turn a visual Review card from ASSESSMENT into a new review or preselection", async () => {
  const move = vi.fn();
  render(<KanbanBoard {...props} applications={[{ ...card, stage: "ASSESSMENT", applicationStatus: "REVIEWING", displayStatus: "ASSESSMENT" }]} moveAction={move} />);
  await act(async () => mocks.drag(drop("REVIEW", "APPLIED")));
  expect(move).not.toHaveBeenCalled();
  expect(screen.getByRole("option", { name: /En revisión \(1\)/ })).toBeInTheDocument();
});

it.each([true, false])("keeps ASSESSMENT in Review and updates evaluation feedback without moving the persisted process, reads=%s", reads => {
  const move = vi.fn();
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const assessmentCard = { ...card, stage: "ASSESSMENT", applicationStatus: "REVIEWING", displayStatus: "ASSESSMENT",
    _assessments: [{ ...card._assessments[0], state: "STARTED" as const, score: null, passed: null, attemptId: null }] };
  const view = render(<KanbanBoard {...props} canonicalRecruiterReadsEnabled={reads} applications={[assessmentCard]} moveAction={move} />);
  expect(screen.getByRole("option", { name: "En revisión (1)" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /^Evaluación/ })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "En revisión" })).toHaveTextContent("En progreso");
  expect(screen.queryByText("Evaluación técnica", { exact: true })).not.toBeInTheDocument();
  view.rerender(<KanbanBoard {...props} canonicalRecruiterReadsEnabled={reads} applications={[{ ...assessmentCard,
    _assessments: [{ ...card._assessments[0], score: 0, passed: false }] }]} moveAction={move} />);
  expect(screen.getByRole("option", { name: "En revisión (1)" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "En revisión" })).toHaveTextContent("0%· No aprobó");
  expect(screen.getAllByRole("link", { name: "Ver resultados de Prueba técnica" })).toHaveLength(1);
  expect(move).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it.each([true, false])("projects every authorized record once and keeps integrity exceptions outside the five states, reads=%s", reads => {
  const make = (id: string, stage: string | null, disposition: string | null, applicationStatus: string, status: string, version = 1) => ({ ...card, id, stage, disposition, applicationStatus, status, stateVersion: version, candidate: { ...card.candidate, name: id } });
  const applications = [card,
    make("Rejected canonical", "CLOSED", "REJECTED", "REJECTED", "REJECTED"),
    make("Rejected legacy", null, null, "REJECTED", "REJECTED", 0),
    make("Withdrawn", "CLOSED", "WITHDRAWN", "SUBMITTED", "REVIEW"),
    make("Hired", "CLOSED", "HIRED", "HIRED", "ACCEPTED"),
    make("Cancelled", "CLOSED", "CANCELLED", "SUBMITTED", "REVIEW"),
    make("Paused", "REVIEW", "HOLD", "REVIEWING", "REVIEW"),
    make("Offer", "OFFER", "ACTIVE", "OFFER", "ACCEPTED"),
    make("Inconsistent", "APPLIED", "ACTIVE", "HIRED", "ACCEPTED"),
  ];
  const before = structuredClone(applications);
  const move = vi.fn();
  render(<KanbanBoard {...props} applications={applications} canonicalRecruiterReadsEnabled={reads} moveAction={move} />);
  expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Por revisar (1)", "En revisión (1)", "Entrevista (1)", "Contratado (1)", "Descartado (4)"]);
  expect(screen.getAllByRole("region").filter(region => region.getAttribute("aria-label") !== "Tablero de candidaturas")).toHaveLength(5);
  expect(document.querySelectorAll("details, summary")).toHaveLength(0);
  expect(screen.getByRole("status")).toHaveTextContent("Advertencia de integridad: 1 registro");
  expect(screen.getByRole("link", { name: "Inconsistent" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cambiar etapa de Inconsistent" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cambiar etapa de Hired" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "En revisión" })).getByText("En pausa")).toBeInTheDocument();
  for (const name of ["Withdrawn", "Cancelled", "Rejected canonical", "Rejected legacy"]) expect(within(screen.getByRole("region", { name: "Descartado" })).getByRole("link", { name })).toBeInTheDocument();
  expect(mocks.draggables.mock.calls.find(call => call[0] === "Inconsistent")).toBeUndefined();
  expect(applications).toEqual(before);
  expect(move).not.toHaveBeenCalled();
});

it.each(["WITHDRAWN", "CANCELLED"] as const)("keeps a CLOSED / %s record with HIRED status visible outside every column and without controls", disposition => {
  const inconsistent = { ...card, id: "contradictory-closure", stage: "CLOSED", disposition, applicationStatus: "HIRED", status: "ACCEPTED",
    candidate: { ...card.candidate, name: "Contradictory closure" }, _assessments: [] };
  const move = vi.fn();
  render(<KanbanBoard {...props} applications={[card, inconsistent]} moveAction={move} />);
  const warning = screen.getByRole("status");
  expect(within(warning).getByRole("link", { name: "Contradictory closure" })).toBeInTheDocument();
  expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Por revisar (1)", "En revisión (0)", "Entrevista (0)", "Contratado (0)", "Descartado (0)"]);
  expect(screen.queryByRole("button", { name: "Cambiar etapa de Contradictory closure" })).not.toBeInTheDocument();
  expect(mocks.draggables.mock.calls.find(call => call[0] === inconsistent.id)).toBeUndefined();
  expect(move).not.toHaveBeenCalled();
});
