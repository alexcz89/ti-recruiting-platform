// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn(), menu: vi.fn(), refresh: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/headers", () => ({ headers: () => new Headers({ host: "localhost:3026" }), cookies: () => ({ toString: () => "synthetic-session=qa" }) }));
vi.mock("@/components/dashboard/assessments/AssessmentActionsMenu", () => ({ default: (props: { ariaLabel?: string }) => { mocks.menu(props); return <button>{props.ariaLabel ?? "Acciones"}</button>; } }));
vi.mock("@/components/dashboard/assessments/AutoRefresh", () => ({ default: (props: unknown) => { mocks.refresh(props); return <span>Auto-refresh existente</span>; } }));
import Page from "@/app/dashboard/assessments/page";
import Loading from "@/app/dashboard/assessments/loading";
import ErrorBoundary from "@/app/dashboard/assessments/error";

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  inv: { id, templateId: "template-a", token: "synthetic-token", applicationId: "app-a", createdAt: "2026-11-06T12:00:00Z", candidate: { id: "candidate-a", name: "Candidata QA", email: "qa@example.invalid" }, template: { title: "Backend", passingScore: 85 }, application: { job: { id: "job-a", title: "Full Stack" } } },
  uiState: "COMPLETED", resultsUrl: `/dashboard/assessments/attempts/${id}/results`, attempt: { id, totalScore: 0, passed: false, severity: "NORMAL" }, ...extra,
});
let data: { rows: ReturnType<typeof row>[]; jobs: Array<{ id: string; title: string }>; total: number; totalPages: number };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("React", React); vi.stubGlobal("fetch", mocks.fetch);
  mocks.session.mockResolvedValue({ user: { role: "RECRUITER", companyId: "company-a" } });
  data = { rows: [row("attempt-a")], jobs: [{ id: "job-a", title: "Full Stack" }], total: 1, totalPages: 1 };
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify(data), { status: 200 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("recruiter assessments operational workspace", () => {
  it.each([null, "CANDIDATE"])("preserves role guards before fetching data: %s", async role => {
    mocks.session.mockResolvedValue(role ? { user: { role } } : null);
    await expect(Page({})).rejects.toThrow(role ? "REDIRECT:/" : "REDIRECT:/auth/signin"); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["RECRUITER", "ADMIN"])("keeps authenticated no-store fetching for %s", async role => {
    mocks.session.mockResolvedValue({ user: { role } });
    render(await Page({ searchParams: { q: " QA ", jobId: "job-a", state: "completed", hasAttempt: "1", sort: "score_desc", page: "2" } }));
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(new URL(url).searchParams.get("q")).toBe("QA"); expect(new URL(url).searchParams.get("state")).toBe("COMPLETED");
    expect(options).toEqual({ cache: "no-store", headers: { cookie: "synthetic-session=qa" } });
    const exportUrl = screen.getByRole("link", { name: "Exportar CSV" }).getAttribute("href")!;
    expect(exportUrl).toContain("state=COMPLETED"); expect(exportUrl).toContain("hasAttempt=1"); expect(exportUrl).toContain("sort=score_desc"); expect(exportUrl).not.toContain("page=");
  });
  it("prioritizes five accessible columns, real score 0 and existing destinations", async () => {
    render(await Page({}));
    expect(screen.getAllByRole("columnheader").map(n => n.textContent)).toEqual(["Candidato", "Evaluación y vacante", "Estado y resultado", "Integridad", "Acciones"]);
    expect(screen.getByText("0%")).toBeInTheDocument(); expect(screen.getByText("No aprobó")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Candidata QA" })).toHaveAttribute("href", "/dashboard/candidates/candidate-a");
    expect(screen.getByRole("link", { name: "Full Stack" })).toHaveAttribute("href", "/dashboard/jobs/job-a/applications");
    expect(screen.getByRole("link", { name: /Ver resultados de Candidata QA/ })).toHaveAttribute("href", "/dashboard/assessments/attempts/attempt-a/results");
    expect(mocks.menu).toHaveBeenCalledWith(expect.objectContaining({ applicationId: "app-a", templateId: "template-a", invitePath: "/assessments/template-a?token=synthetic-token", resultsUrl: "/dashboard/assessments/attempts/attempt-a/results" }));
    const region = screen.getByRole("region", { name: /Tabla de evaluaciones/ }); expect(region).toHaveAttribute("tabindex", "0"); expect(region.className).toContain("overflow-x-auto");
    expect(screen.queryByText("Score prom.")).not.toBeInTheDocument(); expect(screen.queryByRole("link", { name: /alertas/i })).not.toBeInTheDocument();
  });
  it("uses the persisted pass result rather than a guessed passing threshold", async () => {
    data.rows = [row("attempt-a", { attempt: { id: "attempt-a", totalScore: 50, passed: true } })];
    render(await Page({})); expect(screen.getByText("Aprobó")).toBeInTheDocument(); expect(screen.getByText("50%")).toBeInTheDocument();
  });
  it("does not call missing integrity evidence Normal or present a signal as fraud", async () => {
    data.rows = [row("a", { attempt: null, uiState: "PENDING", resultsUrl: null }), row("b"), row("c", { attempt: { severity: "CRITICAL", severityScore: 90, multiSession: true } })];
    render(await Page({})); expect(screen.queryByText("Normal")).not.toBeInTheDocument(); expect(screen.getByText("Sin datos")).toBeInTheDocument(); expect(screen.getByText("Sin datos suficientes")).toBeInTheDocument();
    expect(screen.getByText("Revisar señales")).toBeInTheDocument(); expect(screen.getByText(/no determinan fraude/i)).toBeInTheDocument();
  });
  it("does not display an unfinished default score as a final result and mounts refresh once", async () => {
    data.rows = [row("a", { uiState: "IN_PROGRESS", resultsUrl: null, attempt: { id: "a", totalScore: 0, status: "IN_PROGRESS" } })];
    render(await Page({})); expect(screen.queryByText("0%")).not.toBeInTheDocument(); expect(screen.getByText("Sin resultado final")).toBeInTheDocument(); expect(mocks.refresh).toHaveBeenCalledTimes(1); expect(mocks.refresh).toHaveBeenCalledWith({ hasInProgress: true, intervalMs: 30000 });
  });
  it("keeps every filter labeled, reset and export, without preserving a stale page on form submission", async () => {
    render(await Page({ searchParams: { jobId: "job-a", state: "EXPIRED", hasAttempt: "0", sort: "score_asc", page: "3" } }));
    for (const label of ["Buscar", "Vacante", "Estado", "Intentos", "Ordenar"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByLabelText("Estado")).toHaveValue("EXPIRED"); expect(screen.getByLabelText("Intentos")).toHaveValue("0");
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Limpiar" })).toHaveAttribute("href", "/dashboard/assessments"); expect(document.querySelector('form [name="page"]')).toBeNull();
  });
  it("paginates globally filtered results and displays the correct total", async () => {
    data.total = 75;
    data.totalPages = 2;
    render(await Page({ searchParams: { state: "COMPLETED", hasAttempt: "1", page: "1" } }));
    expect(screen.getByText(/75 evaluaciones coincidentes/)).toBeInTheDocument();
    expect(screen.queryByText(/página actual/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", expect.stringContaining("page=2"));
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", expect.stringContaining("hasAttempt=1"));
  });
  it("distinguishes an empty filtered result from an empty workspace", async () => {
    data.rows = [];
    data.total = 0;
    data.totalPages = 1;
    render(await Page({ searchParams: { state: "COMPLETED", hasAttempt: "1" } }));
    expect(screen.getByText("No hay coincidencias con estos filtros")).toBeInTheDocument();
    expect(screen.getByText(/0 evaluaciones coincidentes/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Siguiente" })).not.toBeInTheDocument();
  });
  it("distinguishes a genuinely empty workspace, and does not refresh it", async () => {
    data.rows = []; data.total = 0;
    render(await Page({})); expect(screen.getByText("Todavía no hay evaluaciones")).toBeInTheDocument(); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("retains full accessible text for long truncated names", async () => {
    const name = "Nombre de candidata especialmente largo que debe conservarse íntegro";
    const item = row("a"); item.inv.candidate.name = name; data.rows = [item];
    render(await Page({})); expect(screen.getByRole("link", { name })).toHaveAttribute("title", name);
  });
  it("handles API errors without showing private provider details", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: "SECRET INTERNAL" }), { status: 500 }));
    render(await Page({})); expect(screen.getByRole("alert")).not.toHaveTextContent("SECRET INTERNAL"); expect(screen.getByRole("link", { name: "Reintentar" })).toBeInTheDocument();
  });
  it("provides loading and a safe retry boundary", () => {
    const { unmount } = render(<Loading />); expect(screen.getByRole("status")).toHaveTextContent("Cargando evaluaciones"); unmount();
    const reset = vi.fn(); render(<ErrorBoundary error={new Error("PRIVATE")} reset={reset} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("PRIVATE"); fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); expect(reset).toHaveBeenCalledOnce();
  });
});
