// @vitest-environment happy-dom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

afterEach(() => { cleanup(); vi.unstubAllGlobals(); refresh.mockClear(); vi.mocked(toastError).mockClear(); });

async function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Acciones de la postulación" }), { button: 0, ctrlKey: false });
}

describe("secondary recruiter process actions", () => {
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
  it("keeps preselection and discard in the three-dot menu, outside the stage selector", async () => {
    render(<>
      <InterestSelect applicationId="app" initial="REVIEW" initialStateVersion={1} legacyStatus="SUBMITTED" canonicalStage="APPLIED" canonicalDisposition="ACTIVE" canonicalRecruiterReadsEnabled />
      <ActionsMenu {...base} processSource={{ stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW", stateVersion: 1 }} />
    </>);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Cambiar etapa: Por revisar" }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("menuitem", { name: "En revisión" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Preseleccionar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Descartar candidato" })).not.toBeInTheDocument();
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
