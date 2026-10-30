// @vitest-environment happy-dom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

async function choose(current: string, option: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: `Cambiar etapa: ${current}` }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole("menuitem", { name: option }));
}

describe("editable recruiter stage", () => {
  it.each([true, false])("advances APPLIED to REVIEW using the existing intent with reads=%s", async reads => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: { stage: reads ? "REVIEW" : null, disposition: reads ? "ACTIVE" : null, status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: reads ? 2 : 0 } })));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} canonicalRecruiterReadsEnabled={reads} canonicalStage={reads ? "APPLIED" : null} canonicalDisposition={reads ? "ACTIVE" : null} initialStateVersion={reads ? 1 : 0} />);
    await choose("Por revisar", "En revisión");
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "START_REVIEW", expectedVersion: reads ? 1 : 0 });
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
    { from: "INTERVIEW", status: "INTERVIEW", interest: "ACCEPTED", to: "OFFER", label: "Oferta", intent: "MOVE_TO_OFFER" },
  ] as const)("advances $from to $to only after confirmation", async scenario => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} initial={scenario.interest} legacyStatus={scenario.status} canonicalStage={scenario.from} />);
    await choose(scenario.from === "REVIEW" ? "En revisión" : "Entrevista", scenario.label);
    expect(screen.getByRole("button", { name: `Cambiar etapa: ${scenario.from === "REVIEW" ? "En revisión" : "Entrevista"}` })).toBeDisabled();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: scenario.intent, expectedVersion: 1 });
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
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "MOVE_BACKWARD", targetStage: "REVIEW", reasonCode: "CORRECTION", expectedVersion: 4 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cambiar etapa: En revisión" })).toBeInTheDocument());
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("sends OFFER to INTERVIEW with an audited reason and confirms the server state", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: {
      stage: "INTERVIEW", disposition: "ACTIVE", status: "INTERVIEW", recruiterInterest: "ACCEPTED", stateVersion: 7,
    } })));
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} initial="ACCEPTED" initialStateVersion={6} legacyStatus="OFFER" canonicalStage="OFFER" />);
    const trigger = screen.getByRole("button", { name: "Cambiar etapa: Oferta" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Entrevista · requiere motivo" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "PROCESS_CHANGE" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      intent: "MOVE_BACKWARD", targetStage: "INTERVIEW", expectedVersion: 6, reasonCode: "PROCESS_CHANGE", commandId: expect.any(String),
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cambiar etapa: Entrevista" })).toBeInTheDocument());
    expect(screen.queryByRole("menuitem", { name: "Contratar" })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("closes the reason dialog on Escape without sending a command", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<InterestSelect {...applied} initial="ACCEPTED" initialStateVersion={6} legacyStatus="OFFER" canonicalStage="OFFER" />);
    await choose("Oferta", "En revisión · requiere motivo");
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
    await choose("Oferta", "Entrevista · requiere motivo");
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
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "En revisión" })).toBeInTheDocument();
  });
});
