// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AssessmentExportButton from "@/components/dashboard/assessments/AssessmentExportButton";

const fetchMock = vi.fn();
let clicked: ReturnType<typeof vi.spyOn>;
let createUrl: ReturnType<typeof vi.spyOn>;
let revokeUrl: ReturnType<typeof vi.spyOn>;
const href = "/api/dashboard/assessments/export?state=COMPLETED&sort=score_asc";
beforeEach(() => {
  vi.stubGlobal("React", React); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
  clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic-csv");
  revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("assessment export download and safe error feedback", () => {
  it("downloads a CSV once with current filters, preserves focus and cleans up the object URL", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(done => { resolve = done; }));
    render(<AssessmentExportButton href={href} />);
    const button = screen.getByRole("button", { name: "Exportar CSV" }); button.focus(); fireEvent.click(button); fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(href, { cache: "no-store" });
    expect(button).toBeDisabled(); expect(button).toHaveAttribute("aria-busy", "true");
    resolve(new Response("Candidato\r\nQA", { headers: { "Content-Type": "text/csv; charset=utf-8" } }));
    await waitFor(() => expect(clicked).toHaveBeenCalledOnce());
    const anchor = clicked.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("evaluaciones.csv"); expect(anchor.href).toBe("blob:synthetic-csv");
    expect(createUrl).toHaveBeenCalledOnce(); expect(revokeUrl).toHaveBeenCalledWith("blob:synthetic-csv");
    await waitFor(() => expect(button).toBeEnabled()); expect(button).toHaveFocus(); expect(screen.queryByRole("alert")).toBeNull();
  });
  it.each([422, 401, 403, 500])("shows an accessible recoverable error for HTTP %s, without downloading JSON or leaking details", async status => {
    fetchMock.mockResolvedValue(new Response('{"error":"PRIVATE_PROVIDER_DETAILS"}', { status }));
    render(<AssessmentExportButton href={href} />); fireEvent.click(screen.getByRole("button"));
    const alert = await screen.findByRole("alert"); expect(alert).not.toHaveTextContent("PRIVATE");
    expect(alert).toHaveTextContent(status === 422 ? /2000.*Refina/ : status === 401 || status === 403 ? /sesión/ : /Intenta nuevamente/);
    expect(clicked).not.toHaveBeenCalled(); expect(createUrl).not.toHaveBeenCalled(); expect(screen.getByRole("button")).toBeEnabled();
  });
  it.each(["network", "login-html"])("allows retry after %s and refuses unexpected content", async mode => {
    if (mode === "network") fetchMock.mockRejectedValueOnce(new Error("PRIVATE_NETWORK_ERROR"));
    else fetchMock.mockResolvedValueOnce(new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } }));
    render(<AssessmentExportButton href={href} />); fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Intenta nuevamente"); expect(clicked).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response("Candidato", { headers: { "Content-Type": "text/csv" } })); fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(clicked).toHaveBeenCalledOnce()); expect(screen.queryByRole("alert")).toBeNull();
  });
});
