// @vitest-environment happy-dom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/ui/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

import ActionsMenu from "@/app/dashboard/jobs/[id]/applications/ActionsMenu";
import InterestSelect from "@/app/dashboard/jobs/[id]/applications/InterestSelect";
import { toastError } from "@/lib/ui/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const base = {
  applicationId: "app", jobId: "job", candidateEmail: "candidate@example.test", assessment: { enabled: false as const },
  canonicalRecruiterReadsEnabled: true,
};
const offer = { stage: "OFFER" as const, disposition: "ACTIVE" as const, status: "OFFER", recruiterInterest: "ACCEPTED", stateVersion: 6 };
const rejected = { stage: "CLOSED" as const, disposition: "REJECTED" as const, status: "REJECTED", recruiterInterest: "REJECTED", stateVersion: 8 };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); refresh.mockClear(); vi.mocked(toastError).mockClear(); });

async function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Acciones de la postulación" }), { button: 0, ctrlKey: false });
}

describe("secondary recruiter process actions", () => {
  it.each(["REVIEW", "MAYBE"] as const)("keeps %s preselection actionable in the List variant without duplicating discard or reopen", async interest => {
    const nextInterest = interest === "REVIEW" ? "MAYBE" : "REVIEW";
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: {
      stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: nextInterest, stateVersion: 3,
    } })));
    vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} stageActionsInSelector processSource={{ stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: interest, stateVersion: 2 }} />);
    await openMenu();
    const label = interest === "REVIEW" ? "Preseleccionar" : "Quitar preselección";
    expect(await screen.findByRole("menuitem", { name: label })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Descartar candidato|Descartado|Reabrir proceso/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: label }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ intent: interest === "REVIEW" ? "MARK_PRESELECTED" : "CLEAR_PRESELECTED", expectedVersion: 2, commandId: expect.any(String) });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("confirms pause, blocks duplicate submission and keeps the persisted underlying stage", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} stageActionsInSelector processSource={offer} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Poner en pausa" }));
    expect(screen.getByRole("dialog", { name: "Mover a En pausa" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guardando…" }));
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ intent: "SET_RECRUITING_STATE", destination: "HOLD", expectedVersion: 6, commandId: expect.any(String) });
    await act(async () => finish(new Response(JSON.stringify({ application: { ...offer, disposition: "HOLD", stateVersion: 7 } }))));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: "Poner en pausa" })).not.toBeInTheDocument();
  });

  it("keeps List preselection unconfirmed after an authorization failure without disclosing private details", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "private company metadata" }), { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} stageActionsInSelector processSource={{ stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 2 }} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Preseleccionar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
    expect(JSON.stringify(vi.mocked(toastError).mock.calls)).not.toContain("private company metadata");
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "Preseleccionar" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Quitar preselección" })).not.toBeInTheDocument();
  });

  it("cancels pause without a write", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} stageActionsInSelector processSource={offer} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Poner en pausa" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["REJECTED", "WITHDRAWN", "CANCELLED"] as const)("does not offer pause for CLOSED / %s with either reader flag", async disposition => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const reads of [true, false]) {
      const closed = disposition === "REJECTED" ? rejected : { ...offer, stage: "CLOSED" as const, disposition };
      const view = render(<ActionsMenu {...base} stageActionsInSelector canonicalRecruiterReadsEnabled={reads} processSource={closed} />);
      await openMenu();
      await screen.findByRole("menuitem", { name: "Eliminar" });
      expect(screen.queryByRole("menuitem", { name: "Poner en pausa" })).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      view.unmount();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("offers pause again only after the server supplies a reopened active state", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const view = render(<ActionsMenu {...base} stageActionsInSelector processSource={rejected} />);
    await openMenu();
    await screen.findByRole("menuitem", { name: "Eliminar" });
    expect(screen.queryByRole("menuitem", { name: "Poner en pausa" })).not.toBeInTheDocument();
    view.rerender(<ActionsMenu {...base} stageActionsInSelector processSource={{ stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 9 }} />);
    expect(await screen.findByRole("menuitem", { name: "Poner en pausa" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Poner en pausa" }));
    expect(screen.getByRole("dialog", { name: "Mover a En pausa" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([403, 409, 422, "network"])("keeps pause unconfirmed on %s and preserves the retry command", async failure => {
    const fetch = failure === "network" ? vi.fn().mockRejectedValue(new Error("private metadata"))
      : vi.fn().mockImplementation(async () => new Response(JSON.stringify({ error: "private metadata" }), { status: failure as number }));
    vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} stageActionsInSelector processSource={offer} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Poner en pausa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog", { name: "Mover a En pausa" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(JSON.parse(fetch.mock.calls[0][1].body));
    expect(JSON.stringify(vi.mocked(toastError).mock.calls)).not.toContain("private metadata");
  });

  it.each([
    { source: { ...offer, stage: "CLOSED" as const, disposition: "HIRED" as const, status: "HIRED" }, integrity: false },
    { source: { ...offer, stage: "REVIEW" as const, status: "REVIEWING", recruiterInterest: "ACCEPTED" }, integrity: false },
    { source: { ...offer, stage: "REVIEW" as const, status: "REVIEWING", recruiterInterest: "REVIEW" }, integrity: true },
  ])("keeps terminal and inconsistent List records free of stage-changing secondary actions: %j", async scenario => {
    render(<ActionsMenu {...base} stageActionsInSelector integrityIssue={scenario.integrity} processSource={scenario.source} />);
    await openMenu();
    await screen.findByRole("menuitem", { name: "Eliminar" });
    expect(screen.queryByRole("menuitem", { name: /Poner en pausa|Preseleccionar|Quitar preselección|Descartar candidato|Reabrir proceso/ })).not.toBeInTheDocument();
  });
  it.each([["55 1234 5678", "525512345678"], ["+52 1 55 1234 5678", "525512345678"], ["+1 415 555 2671", "14155552671"]])("opens a validated WhatsApp conversation for %s", async (phone, digits) => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ActionsMenu {...base} candidatePhone={phone} processSource={offer} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Abrir WhatsApp" }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining(`https://wa.me/${digits}?text=`), "_blank", "noopener,noreferrer");
  });
  it.each([[null, "WhatsApp: Sin teléfono registrado"], ["123", "WhatsApp: teléfono inválido"]])("keeps unavailable WhatsApp accessible without opening an invalid link", async (phone, label) => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ActionsMenu {...base} candidatePhone={phone} processSource={offer} />);
    await openMenu();
    const item = await screen.findByRole("menuitem", { name: label! });
    expect(item).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(item);
    expect(open).not.toHaveBeenCalled();
  });
  it("keeps the existing shared menu styling when compact is omitted", async () => {
    render(<DropdownMenu>
      <DropdownMenuTrigger>Menú existente</DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuItem>Acción existente</DropdownMenuItem><DropdownMenuSeparator /></DropdownMenuContent>
    </DropdownMenu>);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Menú existente" }), { button: 0, ctrlKey: false });
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("glass-card", "p-4", "md:p-6");
    expect(menu).not.toHaveAttribute("compact");
    expect(screen.getByRole("menuitem", { name: "Acción existente" })).toHaveClass("p-4", "md:p-6");
    expect(menu.querySelector('[role="separator"]')).toHaveClass("glass-card", "p-4", "md:p-6");
  });
  it("keeps preselection in the three-dot menu and preserves its existing discard action", async () => {
    render(<>
      <InterestSelect applicationId="app" initial="REVIEW" initialStateVersion={1} legacyStatus="SUBMITTED" canonicalStage="APPLIED" canonicalDisposition="ACTIVE" canonicalRecruiterReadsEnabled />
      <ActionsMenu {...base} processSource={{ stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW", stateVersion: 1 }} />
    </>);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Cambiar etapa: Por revisar" }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("menuitem", { name: "En revisión" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Preseleccionar" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Descartado" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "Preseleccionar" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Descartar candidato" })).toBeInTheDocument();
  });

  it("reopens a rejected application only with a reason and server version", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: {
      stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 9,
    } })));
    vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} processSource={rejected} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reabrir proceso" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Selecciona un motivo");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "RECONSIDERED" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      intent: "REOPEN_REJECTED", expectedVersion: 8, reasonCode: "RECONSIDERED", commandId: expect.any(String),
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalledOnce();
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: "Reabrir proceso" })).not.toBeInTheDocument();
  });

  it("does not confirm a denied reopen or disclose the private error", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "private company metadata" }), { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} processSource={rejected} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reabrir proceso" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), { target: { value: "OTHER" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Nota/ }), { target: { value: "Revisar nuevamente" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ reasonCode: "OTHER", reasonText: "Revisar nuevamente" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(toastError).mock.calls)).not.toContain("private company metadata");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("hides hiring in the list, confirms discard and keeps the server result as the source of truth", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ application: {
      stage: "CLOSED", disposition: "REJECTED", status: "REJECTED", recruiterInterest: "REJECTED", stateVersion: 7,
    } })));
    vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} processSource={offer} />);
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: "Contratar" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Descartar candidato" }));
    expect(screen.getByRole("dialog", { name: "Descartar candidato" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "REJECT_CANDIDATE", expectedVersion: 6, commandId: expect.any(String) });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty("reasonCode");
    expect(refresh).toHaveBeenCalledOnce();
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: "Contratar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Descartar candidato" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Reabrir proceso" })).toBeInTheDocument();
  });

  it("keeps discard unconfirmed on a denied response", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "private company metadata" }), { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    render(<ActionsMenu {...base} processSource={offer} />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Descartar candidato" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog", { name: "Descartar candidato" })).toBeInTheDocument();
    expect(JSON.stringify(vi.mocked(toastError).mock.calls)).not.toContain("private company metadata");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
