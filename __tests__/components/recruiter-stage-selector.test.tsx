// @vitest-environment happy-dom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/ui/toast", () => ({ toastError: vi.fn() }));

import InterestSelect from "@/app/dashboard/jobs/[id]/applications/InterestSelect";
import { toastError } from "@/lib/ui/toast";
import { getRecruitingPresentation, type PresentationSource } from "@/lib/hiring-process/recruiting-presentation";
import { countRecruiterPresentationRows } from "@/lib/hiring-process/recruiter-list";

const applied = { applicationId: "app", initial: "REVIEW" as const, initialStateVersion: 1, legacyStatus: "SUBMITTED", canonicalStage: "APPLIED" as const, canonicalDisposition: "ACTIVE" as const, canonicalRecruiterReadsEnabled: true };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); refresh.mockClear(); vi.mocked(toastError).mockClear(); });

it.each(["default", "icon"] as const)("offers exactly five states in the %s menu without secondary stage groups", async variant => {
  render(<InterestSelect {...applied} variant={variant} />);
  fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
  await screen.findByRole("menuitem", { name: "En revisión" });
  expect(screen.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Por revisar", "En revisión", "Entrevista", "Contratado", "Descartado"]);
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(screen.queryByText(/Oferta|Finalizados|Registrar retiro|Cancelar proceso/)).not.toBeInTheDocument();
});

it.each([true, false])("resumes a paused process using its persisted stage and the existing versioned command, reads=%s", async reads => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: {
    stage: "INTERVIEW", disposition: "ACTIVE", status: "INTERVIEW", recruiterInterest: "ACCEPTED", stateVersion: 5,
  } })));
  vi.stubGlobal("fetch", fetch);
  render(<InterestSelect {...applied} canonicalRecruiterReadsEnabled={reads} canonicalStage="INTERVIEW" canonicalDisposition="HOLD" legacyStatus="INTERVIEW" initial="ACCEPTED" initialStateVersion={4} />);
  fireEvent.keyDown(screen.getByRole("button", { name: "Cambiar etapa: Entrevista" }), { key: "Enter" });
  const current = await screen.findByRole("menuitem", { name: "Entrevista Reanudar" });
  expect(current).toHaveAttribute("aria-current", "step");
  expect(current).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(current);
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ intent: "SET_RECRUITING_STATE", destination: "INTERVIEW", expectedVersion: 4, commandId: expect.any(String) });
  await waitFor(() => expect(screen.getByRole("button", { name: "Cambiar etapa: Entrevista" })).toBeEnabled());
});

it("does not disguise a persisted ASSESSMENT change as resuming the same stage", async () => {
  render(<InterestSelect {...applied} canonicalStage="ASSESSMENT" canonicalDisposition="HOLD" legacyStatus="REVIEWING" />);
  fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
  expect(await screen.findByRole("menuitem", { name: "En revisión" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Reanudar proceso" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "En revisión" }));
  expect(screen.getByRole("dialog", { name: "Regresar a En revisión" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Motivo" })).toBeInTheDocument();
});

it.each([true, false])("resumes a paused OFFER in place while keeping the five-state UI, reads=%s", async reads => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: {
    stage: "OFFER", disposition: "ACTIVE", status: "OFFER", recruiterInterest: "ACCEPTED", stateVersion: 5,
  } })));
  vi.stubGlobal("fetch", fetch);
  render(<InterestSelect {...applied} canonicalRecruiterReadsEnabled={reads} canonicalStage="OFFER" canonicalDisposition="HOLD" legacyStatus="OFFER" initial="ACCEPTED" initialStateVersion={4} />);
  fireEvent.keyDown(screen.getByRole("button", { name: "Cambiar etapa: Entrevista" }), { key: "Enter" });
  const resume = await screen.findByRole("menuitem", { name: "Entrevista Reanudar" });
  expect(screen.getAllByRole("menuitem")).toHaveLength(5);
  expect(screen.queryByRole("menuitem", { name: "Oferta" })).not.toBeInTheDocument();
  fireEvent.click(resume);
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ intent: "SET_RECRUITING_STATE", destination: "OFFER", expectedVersion: 4, commandId: expect.any(String) });
  await waitFor(() => expect(screen.getByRole("button", { name: "Cambiar etapa: Entrevista" })).toBeEnabled());
  expect(screen.queryByLabelText("En pausa")).not.toBeInTheDocument();
});

it("honors server-detected integrity problems even when the abbreviated client source looks valid", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<InterestSelect {...applied} integrityIssue />);
  expect(screen.getByRole("status")).toHaveTextContent("Advertencia de integridad");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByText("Por revisar")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["WITHDRAWN", "CANCELLED"] as const)("shows an integrity warning instead of a state or controls for CLOSED / %s with HIRED status", disposition => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<InterestSelect {...applied} canonicalStage="CLOSED" canonicalDisposition={disposition} legacyStatus="HIRED" initial="ACCEPTED" />);
  expect(screen.getByRole("status")).toHaveTextContent("Advertencia de integridad");
  expect(screen.queryByText("Descartado")).not.toBeInTheDocument();
  expect(screen.queryByText("Contratado")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

async function choose(current: string, option: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: `Cambiar etapa: ${current}` }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole("menuitem", { name: option.split(" ·")[0] }));
}

async function chooseClosure(label: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Cambiar etapa: Entrevista" }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole("menuitem", { name: label === "Contratar candidato" ? "Contratado" : "Descartado" }));
}

describe.each([true, false])("confirmed stage closures, canonical reads=%s", reads => {
  describe.each([true, false])("canonical source=%s", canonical => {
    it.each([
      { label: "Contratar candidato", intent: "HIRE_CANDIDATE", outcome: "HIRED", interest: "ACCEPTED", finalLabel: "Contratado" },
      { label: "Descartar candidato", intent: "REJECT_CANDIDATE", outcome: "REJECTED", interest: "REJECTED", finalLabel: "Descartado" },
    ] as const)("confirms $intent before submitting and waits for the persisted terminal state", async scenario => {
      let finish!: (response: Response) => void;
      const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
      vi.stubGlobal("fetch", fetch);
      render(<InterestSelect {...applied} initial="ACCEPTED" legacyStatus="OFFER" canonicalStage={canonical ? "OFFER" : null}
        canonicalDisposition={canonical ? "ACTIVE" : null} initialStateVersion={canonical ? 6 : 0} canonicalRecruiterReadsEnabled={reads} />);
      await chooseClosure(scenario.label);
      expect(screen.getByRole("dialog", { name: scenario.label })).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Motivo" })).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
      expect(fetch).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(fetch.mock.calls[0][0]).toBe("/api/applications/app/intent");
      expect(body).toEqual({ intent: "SET_RECRUITING_STATE", destination: scenario.outcome, expectedVersion: canonical ? 6 : 0, commandId: expect.any(String) });
      expect(screen.getByRole("button", { name: "Cambiar etapa: Entrevista" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
      const confirm = screen.getByRole("button", { name: "Guardando…" });
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledOnce();
      await act(async () => finish(new Response(JSON.stringify({ application: {
        stage: canonical ? "CLOSED" : null, disposition: canonical ? scenario.outcome : null,
        status: scenario.outcome, recruiterInterest: scenario.interest, stateVersion: canonical ? 7 : 0,
      } }))));
      expect(screen.getByText(scenario.finalLabel)).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      if (scenario.outcome === "HIRED") expect(screen.queryByRole("button", { name: "Cambiar etapa: Contratado" })).not.toBeInTheDocument();
      else expect(screen.getByRole("button", { name: `Cambiar etapa: ${scenario.finalLabel}` })).toBeEnabled();
      expect(refresh).toHaveBeenCalledOnce();
    });
  });
});

describe("stage closure safeguards", () => {
  const offerProps = { ...applied, initial: "ACCEPTED" as const, legacyStatus: "OFFER", canonicalStage: "OFFER" as const, initialStateVersion: 6 };
  it.each(["Contratar candidato", "Descartar candidato"])("allows cancelling %s without sending a command", async label => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...offerProps} />);
    await chooseClosure(label);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await chooseClosure(label);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([403, 404, 409, 422, "network"])("keeps Oferta on %s and reuses the command ID on retry", async failure => {
    const fetch = vi.fn();
    if (failure === "network") fetch.mockRejectedValue(new Error("private details"));
    else fetch.mockImplementation(async () => new Response(JSON.stringify({ error: "private details" }), { status: failure as number }));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...offerProps} />);
    await chooseClosure("Contratar candidato");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Cambiar etapa: Entrevista" })).toBeEnabled();
    expect(screen.getByRole("dialog", { name: "Contratar candidato" })).toBeInTheDocument();
    expect(JSON.stringify(vi.mocked(toastError).mock.calls)).not.toContain("private details");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(JSON.parse(fetch.mock.calls[0][1].body));
  });
});

describe("editable recruiter stage", () => {
  it.each([true, false])("advances APPLIED to REVIEW using the existing intent with reads=%s", async reads => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: { stage: reads ? "REVIEW" : null, disposition: reads ? "ACTIVE" : null, status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: reads ? 2 : 0 } })));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} canonicalRecruiterReadsEnabled={reads} canonicalStage={reads ? "APPLIED" : null} canonicalDisposition={reads ? "ACTIVE" : null} initialStateVersion={reads ? 1 : 0} />);
    await choose("Por revisar", "En revisión");
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "SET_RECRUITING_STATE", destination: "REVIEW", expectedVersion: reads ? 1 : 0 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cambiar etapa: En revisión" })).toBeInTheDocument());
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the old stage while pending and after a conflict, then refreshes the list", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} />);
    await choose("Por revisar", "En revisión");
    expect(screen.getByRole("button", { name: "Cambiar etapa: Por revisar" })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => finish(new Response(JSON.stringify({ error: "CONFLICT" }), { status: 409 })));
    expect(screen.getByRole("button", { name: "Cambiar etapa: Por revisar" })).toBeEnabled();
    expect(toastError).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    { from: "REVIEW", status: "REVIEWING", interest: "REVIEW", to: "INTERVIEW", label: "Entrevista", intent: "MOVE_TO_INTERVIEW" },
    { from: "APPLIED", status: "SUBMITTED", interest: "REVIEW", to: "INTERVIEW", label: "Entrevista", intent: "SET_RECRUITING_STATE" },
  ] as const)("advances $from to $to only after confirmation", async scenario => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} initial={scenario.interest} legacyStatus={scenario.status} canonicalStage={scenario.from} />);
    const currentLabel = scenario.from === "APPLIED" ? "Por revisar" : scenario.from === "REVIEW" ? "En revisión" : "Entrevista";
    await choose(currentLabel, scenario.label);
    expect(screen.getByRole("button", { name: `Cambiar etapa: ${currentLabel}` })).toBeDisabled();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "SET_RECRUITING_STATE", destination: scenario.to, expectedVersion: 1 });
    const persisted: PresentationSource = { stage: scenario.to, disposition: "ACTIVE", status: scenario.to, recruiterInterest: "ACCEPTED", stateVersion: 2 };
    await act(async () => finish(new Response(JSON.stringify({ application: persisted }))));
    expect(screen.getByRole("button", { name: `Cambiar etapa: ${scenario.label}` })).toBeEnabled();
    expect(refresh).toHaveBeenCalledOnce();
    expect(getRecruitingPresentation(persisted, true).column).toBe(scenario.to);
    expect(countRecruiterPresentationRows([persisted], true)[scenario.to]).toBe(1);
  });

  it("requires an audited reason for INTERVIEW to REVIEW and confirms only server state", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: { stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 5 } })));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} initial="ACCEPTED" initialStateVersion={4} legacyStatus="INTERVIEW" canonicalStage="INTERVIEW" />);
    await choose("Entrevista", "En revisión · requiere motivo");
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Selecciona un motivo");
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "CORRECTION" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "SET_RECRUITING_STATE", destination: "REVIEW", reasonCode: "CORRECTION", expectedVersion: 4 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cambiar etapa: En revisión" })).toBeInTheDocument());
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("maps OFFER to Interview but sends an audited backward command to REVIEW with an audited reason and confirms the server state", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: {
      stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 7,
    } })));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} initial="ACCEPTED" initialStateVersion={6} legacyStatus="OFFER" canonicalStage="OFFER" />);
    const trigger = screen.getByRole("button", { name: "Cambiar etapa: Entrevista" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "En revisión" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "PROCESS_CHANGE" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      intent: "SET_RECRUITING_STATE", destination: "REVIEW", expectedVersion: 6, reasonCode: "PROCESS_CHANGE", commandId: expect.any(String),
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cambiar etapa: En revisión" })).toBeInTheDocument());
    expect(screen.queryByRole("menuitem", { name: "Contratar" })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("closes the reason dialog on Escape without sending a command", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} initial="ACCEPTED" initialStateVersion={6} legacyStatus="OFFER" canonicalStage="OFFER" />);
    await choose("Entrevista", "En revisión · requiere motivo");
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Motivo" })).toHaveFocus());
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the reason dialog open and blocks cancellation during submission", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} initial="ACCEPTED" initialStateVersion={6} legacyStatus="OFFER" canonicalStage="OFFER" />);
    await choose("Entrevista", "En revisión · requiere motivo");
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "CORRECTION" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => finish(new Response(JSON.stringify({ application: {
      stage: "INTERVIEW", disposition: "ACTIVE", status: "INTERVIEW", recruiterInterest: "ACCEPTED", stateVersion: 7,
    } }))));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("opens the stage menu from the keyboard with a labelled trigger", async () => {
    render(<InterestSelect {...applied} />);
    const trigger = screen.getByRole("button", { name: "Cambiar etapa: Por revisar" });
    expect(trigger).toHaveClass("min-h-11", "w-[160px]");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "En revisión" })).toBeInTheDocument();
  });
});

it.each([true, false])("shows all destinations, marks the current state and does not resubmit it with reads=%s", async reads => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<InterestSelect {...applied} canonicalRecruiterReadsEnabled={reads} />);
  const trigger = screen.getByRole("button", { name: "Cambiar etapa: Por revisar" });
  trigger.focus(); fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
  const current = await screen.findByRole("menuitem", { name: "Por revisar" });
  expect(current).toHaveAttribute("aria-current", "step");
  expect(current).toHaveAttribute("aria-disabled", "true");
  expect(screen.getAllByRole("menuitem")).toHaveLength(5);
  for (const label of ["En revisión", "Entrevista", "Contratado", "Descartado"]) expect(screen.getByRole("menuitem", { name: label })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Requiere conciliación" })).not.toBeInTheDocument();
  fireEvent.click(current); expect(fetch).not.toHaveBeenCalled();
});

it.each(["En revisión", "Entrevista"])("reopens a discarded candidate directly into %s with a reason", async label => {
  const destination = label === "Entrevista" ? "INTERVIEW" : "REVIEW";
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: {
    stage: destination, disposition: "ACTIVE", status: destination === "INTERVIEW" ? "INTERVIEW" : "REVIEWING", recruiterInterest: destination === "INTERVIEW" ? "ACCEPTED" : "REVIEW", stateVersion: 5,
  } })));
  vi.stubGlobal("fetch", fetch);
  render(<InterestSelect {...applied} canonicalStage="CLOSED" canonicalDisposition="REJECTED" legacyStatus="REJECTED" initial="REJECTED" initialStateVersion={4} />);
  await choose("Descartado", label);
  expect(screen.getByRole("dialog", { name: `Reabrir en ${label}` })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "RECONSIDERED" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "SET_RECRUITING_STATE", destination, reasonCode: "RECONSIDERED", expectedVersion: 4 });
  await waitFor(() => expect(screen.getByRole("button", { name: `Cambiar etapa: ${label}` })).toBeEnabled());
});

it("hires directly from REVIEW only after confirmation", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: { stage: "CLOSED", disposition: "HIRED", status: "HIRED", recruiterInterest: "ACCEPTED", stateVersion: 2 } })));
  vi.stubGlobal("fetch", fetch);
  render(<InterestSelect {...applied} canonicalStage="REVIEW" legacyStatus="REVIEWING" />);
  await choose("En revisión", "Contratado");
  expect(screen.getByRole("dialog", { name: "Contratar candidato" })).toBeInTheDocument(); expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "SET_RECRUITING_STATE", destination: "HIRED" });
});

it("offers the same destinations from a labelled icon with no visible stage and preserves keyboard access", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<InterestSelect {...applied} variant="icon" accessibleLabel="Cambiar etapa de Ana" />);
  const trigger = screen.getByRole("button", { name: "Cambiar etapa de Ana" });
  expect(trigger).toHaveClass("h-11", "w-11");
  expect(trigger).not.toHaveClass("w-[160px]");
  expect(trigger.textContent).toBe("");
  expect(screen.queryByText("Por revisar")).not.toBeInTheDocument();
  trigger.focus(); fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
  const current = await screen.findByRole("menuitem", { name: "Por revisar" });
  expect(current).toHaveAttribute("aria-disabled", "true");
  expect(current).toHaveAttribute("aria-current", "step");
  expect(screen.getAllByRole("menuitem")).toHaveLength(5);
  expect(screen.getByRole("menuitem", { name: "Descartado" })).toHaveClass("min-h-11");
  fireEvent.click(screen.getByRole("menuitem", { name: "Descartado" }));
  expect(screen.getByRole("dialog", { name: "Descartar candidato" })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("hides the icon rather than exposing a fallback control for incompatible records", () => {
  render(<InterestSelect {...applied} variant="icon" legacyStatus="HIRED" initial="ACCEPTED" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByText("Requiere conciliación")).not.toBeInTheDocument();
});

describe.each([true, false])("hired UI, reads=%s", reads => {
  it.each([true, false])("keeps the list label and removes the Kanban action for canonical source=%s", canonical => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const hiredProps = { ...applied, initial: "ACCEPTED" as const, legacyStatus: "HIRED", canonicalStage: canonical ? "CLOSED" as const : null,
      canonicalDisposition: canonical ? "HIRED" as const : null, initialStateVersion: canonical ? 3 : 0, canonicalRecruiterReadsEnabled: reads };
    const view = render(<InterestSelect {...hiredProps} />);
    expect(screen.getByText("Contratado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.rerender(<InterestSelect {...hiredProps} variant="icon" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

it.each([true, false])("allows reopening final states with a confirmed reason with reads=%s", reads => {
  render(<InterestSelect applicationId="closed" initial="REJECTED" initialStateVersion={reads ? 3 : 0} legacyStatus="REJECTED" canonicalStage={reads ? "CLOSED" : null} canonicalDisposition={reads ? "REJECTED" : null} canonicalRecruiterReadsEnabled={reads} />);
  expect(screen.getByText("Descartado")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cambiar etapa: Descartado" })).toBeEnabled();
});
