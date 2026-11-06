// @vitest-environment happy-dom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), write: vi.fn(), fetch: vi.fn(), confirm: vi.fn(), open: vi.fn(), success: vi.fn(), error: vi.fn() }));
const router = { refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, loading: () => "toast-qa" } }));
import Menu from "@/components/dashboard/assessments/AssessmentActionsMenu";
import AutoRefresh from "@/components/dashboard/assessments/AutoRefresh";

beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React); vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("navigator", { clipboard: { writeText: mocks.write }, userAgent: "vitest" });
  vi.stubGlobal("confirm", mocks.confirm); vi.stubGlobal("open", mocks.open);
  mocks.confirm.mockReturnValue(true); mocks.write.mockResolvedValue(undefined);
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const props = { applicationId: "app-a", templateId: "template-a", invitePath: "/assessments/template-a?token=qa", resultsUrl: "/dashboard/assessments/attempts/attempt-a/results", ariaLabel: "Acciones de evaluación de Candidata QA" };
async function openMenu() {
  const trigger = screen.getByRole("button", { name: props.ariaLabel }); trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" }); await screen.findByRole("menu"); return trigger;
}
describe("existing assessment actions through the shared accessible menu", () => {
  it("opens by keyboard, moves focus and restores it on Escape", async () => {
    render(<Menu {...props} />); const trigger = await openMenu(); const copy = screen.getByRole("menuitem", { name: "Copiar link" });
    await waitFor(() => expect(copy).toHaveFocus()); fireEvent.keyDown(copy, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Abrir link" })).toHaveFocus());
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument()); await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("copies the same absolute invitation URL", async () => {
    render(<Menu {...props} />); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Copiar link" }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledWith(new URL(props.invitePath, window.location.origin).toString()));
    expect(mocks.success).toHaveBeenCalled();
  });
  it("preserves secure new-tab opening and the results destination", async () => {
    mocks.open.mockReturnValue(null);
    render(<Menu {...props} />); await openMenu(); expect(screen.getByRole("menuitem", { name: "Ver resultados" })).toHaveAttribute("href", props.resultsUrl);
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir link" }));
    expect(mocks.open).toHaveBeenCalledWith(new URL(props.invitePath, window.location.origin).toString(), "_blank", "noopener,noreferrer");
  });
  it("does not resend when the existing confirmation is cancelled", async () => {
    mocks.confirm.mockReturnValue(false); render(<Menu {...props} />); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Reenviar assessment" }));
    expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("keeps the resend endpoint, operation identity and successful refresh", async () => {
    render(<Menu {...props} />); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Reenviar assessment" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    const [url, options] = mocks.fetch.mock.calls[0]; expect(url).toBe("/api/applications/app-a/assessment-invite"); expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ templateId: "template-a", resendOperationId: expect.any(String), resendRequestedAt: expect.any(String) });
  });
  it("blocks duplicate sends while the request is pending", async () => {
    let resolve!: (value: Response) => void; mocks.fetch.mockReturnValue(new Promise<Response>(done => { resolve = done; }));
    render(<Menu {...props} />); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Reenviar assessment" }));
    const item = await screen.findByRole("menuitem", { name: "Reenviando..." }); expect(item).toHaveAttribute("aria-disabled", "true"); fireEvent.click(item); expect(mocks.fetch).toHaveBeenCalledOnce();
    await act(async () => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))); await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });
  it("does not report success or refresh after a server rejection", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: "Conflicto de invitación" }), { status: 409 }));
    render(<Menu {...props} />); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Reenviar assessment" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Conflicto de invitación", { id: "toast-qa" })); expect(mocks.refresh).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
  });
  it("does not enable unavailable actions", async () => {
    render(<Menu ariaLabel={props.ariaLabel} />); await openMenu();
    for (const name of ["Copiar link", "Abrir link", "Reenviar assessment"]) expect(screen.getByRole("menuitem", { name })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("menuitem", { name: "Ver resultados" })).not.toBeInTheDocument();
  });
});
describe("assessment auto-refresh lifecycle", () => {
  it("refreshes once every 30 seconds, preserves countdown and stops on unmount", () => {
    vi.useFakeTimers(); const view = render(<AutoRefresh hasInProgress intervalMs={30000} />);
    act(() => { vi.advanceTimersByTime(29000); }); expect(mocks.refresh).not.toHaveBeenCalled(); expect(screen.getByText("Actualización en 1s")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); }); expect(mocks.refresh).toHaveBeenCalledTimes(1); view.unmount(); act(() => { vi.advanceTimersByTime(60000); }); expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it("does not poll when no evaluation is in progress", () => {
    vi.useFakeTimers(); const view = render(<AutoRefresh hasInProgress={false} />); act(() => { vi.advanceTimersByTime(60000); }); expect(mocks.refresh).not.toHaveBeenCalled(); expect(view.container).toBeEmptyDOMElement();
  });
});
