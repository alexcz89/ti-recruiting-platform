// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Page from "@/app/assessments/page";
import Intro from "@/app/assessments/[templateId]/AssessmentIntro";
import Results from "@/app/assessments/attempts/[attemptId]/results/page";
import InboxError from "@/app/assessments/error";
import InboxLoading from "@/app/assessments/loading";
import { AssessmentInboxRefresh } from "@/app/assessments/AssessmentInboxRefresh";
import Header from "@/components/Header";
import { ASSESSMENTS_UPDATED_EVENT } from "@/lib/client/assessment-updates";

const mocks = vi.hoisted(() => ({
  invites: vi.fn(), attempts: vi.fn(), session: vi.fn(), refresh: vi.fn(), fetch: vi.fn(),
  path: "/assessments", attemptId: "active", badge: 2,
}));
vi.mock("@/lib/server/prisma", () => ({ prisma: { assessmentInvite: { findMany: mocks.invites }, assessmentAttempt: { findMany: mocks.attempts } } }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(), useRouter: () => ({ refresh: mocks.refresh }), useParams: () => ({ attemptId: mocks.attemptId }), usePathname: () => mocks.path,
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { user: { id: "candidate", role: "CANDIDATE", name: "QA" } } }), signOut: vi.fn() }));
vi.mock("@/components/ThemeToggle", () => ({ default: () => <button>Cambiar tema</button> }));
vi.mock("@/components/LogoTaskio", () => ({ default: () => <span>TaskIO</span> }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
const date = new Date("2026-10-27T10:00:00Z");
const invite = (id: string, status: string) => ({
  id, token: id + "-token", templateId: id, applicationId: id + "-app", status,
  sentAt: date, createdAt: date, updatedAt: date, expiresAt: new Date("2099-01-01"),
  template: { id, title: "Evaluación " + id, timeLimit: 30 },
  application: { id: id + "-app", job: { title: "Backend", company: { name: "Empresa QA" } } },
});
const active = { id: "attempt-active", inviteId: "active", status: "IN_PROGRESS", applicationId: "active-app", templateId: "active",
  createdAt: date, startedAt: date, expiresAt: new Date("2099-01-01"), submittedAt: null, totalScore: null };
const done = { ...active, id: "attempt-done", inviteId: "done", templateId: "done", applicationId: "done-app", status: "SUBMITTED", submittedAt: date, totalScore: 100 };
const result = { attempt: { totalScore: 100, passed: true, timeSpent: 30, sectionScores: {}, submittedAt: date }, template: { title: "Evaluación QA", passingScore: 60 }, answers: [], stats: { totalQuestions: 1, answeredQuestions: 1 } };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  mocks.refresh.mockReset();
  mocks.path = "/assessments"; mocks.attemptId = "active"; mocks.badge = 2;
  mocks.session.mockResolvedValue({ user: { id: "candidate", role: "CANDIDATE" } });
  mocks.invites.mockResolvedValue([invite("pending", "SENT"), invite("active", "STARTED"), invite("done", "SUBMITTED")]);
  mocks.attempts.mockResolvedValue([active, done]);
  mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ badge: mocks.badge })));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("candidate inbox presentation and refresh", () => {
  it("separates states, dates and actions, placing active work first", async () => {
    render(await Page());
    const progress = screen.getByRole("region", { name: "En progreso" });
    expect(within(progress).getByRole("link", { name: "Continuar" }).getAttribute("href")).toContain("attemptId=attempt-active");
    const pending = screen.getByRole("region", { name: "Pendientes" });
    expect(within(pending).getByText("Enviada")).toBeTruthy();
    expect(within(pending).getByRole("link", { name: "Iniciar" }).getAttribute("href")).toContain("pending-token");
    const completed = screen.getByRole("region", { name: "Completadas" });
    expect(within(completed).getByText("Finalización")).toBeTruthy();
    expect(within(completed).getByText("100%")).toBeTruthy();
    expect(within(completed).queryByText("Expira")).toBeNull();
    expect(within(completed).queryByRole("link", { name: "Iniciar" })).toBeNull();
    expect(progress.compareDocumentPosition(pending) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mocks.invites.mock.calls[0][0].select.sentAt).toBe(true);
  });
  it("uses assigned date explicitly when sentAt is missing and never invents received dates", async () => {
    mocks.invites.mockResolvedValue([{ ...invite("pending", "SENT"), sentAt: null }]); mocks.attempts.mockResolvedValue([]);
    render(await Page()); expect(screen.getByText("Asignada")).toBeTruthy(); expect(screen.queryByText("Recibida")).toBeNull();
    expect(screen.getAllByRole("time").length).toBeGreaterThan(0);
  });
  it("fresh server data moves a completed attempt and updates all inbox counts", async () => {
    const view = render(await Page());
    mocks.invites.mockResolvedValue([invite("pending", "SUBMITTED"), invite("active", "STARTED"), invite("done", "SUBMITTED")]);
    mocks.attempts.mockResolvedValue([active, done, { ...done, inviteId: "pending", templateId: "pending", applicationId: "pending-app" }]);
    view.rerender(await Page());
    expect(within(screen.getByRole("region", { name: "Pendientes" })).queryByRole("link", { name: "Iniciar" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Completadas" })).getAllByText("100%")).toHaveLength(2);
    expect(screen.getByText("evaluación por completar")).toBeTruthy();
  });
  it("shows an actionable empty state without competing primary certification banners", async () => {
    mocks.invites.mockResolvedValue([]); mocks.attempts.mockResolvedValue([]);
    render(await Page()); expect(screen.getByRole("heading", { name: "Aún no tienes evaluaciones asignadas" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver mis postulaciones" })).toBeTruthy();
  });
  it("coalesces browser restore/focus/completion and removes listeners after unmount without submitting", async () => {
    const view = render(<AssessmentInboxRefresh />);
    fireEvent(window, new Event("pageshow")); fireEvent(window, new Event("focus")); fireEvent(window, new Event(ASSESSMENTS_UPDATED_EVENT));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    fireEvent(window, new Event("focus")); view.unmount(); fireEvent(window, new Event("focus"));
    await new Promise(resolve => setTimeout(resolve, 75));
    expect(mocks.refresh).toHaveBeenCalledOnce(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("revalidates an internally entered cached inbox after another session submits, including Back", async () => {
    const cachedInbox = await Page();
    mocks.invites.mockResolvedValue([invite("pending", "SUBMITTED"), invite("active", "STARTED"), invite("done", "SUBMITTED")]);
    mocks.attempts.mockResolvedValue([active, done, { ...done, inviteId: "pending", templateId: "pending", applicationId: "pending-app" }]);
    const freshInbox = await Page();
    mocks.badge = 1;
    mocks.path = "/profile/summary";
    const view = render(<Header />);
    mocks.refresh.mockImplementation(() => view.rerender(<><Header />{freshInbox}</>));

    mocks.path = "/assessments";
    view.rerender(<><Header />{cachedInbox}</>);
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Pendientes" })).queryByRole("link", { name: "Iniciar" })).toBeNull());
    expect(within(screen.getByRole("region", { name: "Completadas" })).getAllByText("100%")).toHaveLength(2);
    await screen.findByLabelText("1 evaluaciones pendientes");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    view.rerender(<><Header />{freshInbox}</>);
    expect(mocks.refresh).toHaveBeenCalledOnce();

    mocks.path = "/profile/summary"; view.rerender(<Header />);
    mocks.path = "/assessments"; view.rerender(<><Header />{cachedInbox}</>);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    expect(within(screen.getByRole("region", { name: "Pendientes" })).queryByRole("link", { name: "Iniciar" })).toBeNull();
  });
  it("does not refresh again on a full inbox load, rerender or header remount", () => {
    const view = render(<Header />);
    view.rerender(<Header />); view.unmount(); render(<Header />);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("refreshes the real header badge after completion and navigation, without waiting 60 seconds", async () => {
    const view = render(<Header />); await screen.findByLabelText("2 evaluaciones pendientes");
    mocks.badge = 0; fireEvent(window, new Event(ASSESSMENTS_UPDATED_EVENT));
    await waitFor(() => expect(screen.queryByLabelText("2 evaluaciones pendientes")).toBeNull());
    mocks.badge = 1; mocks.path = "/profile/summary"; view.rerender(<Header />);
    await screen.findByLabelText("1 evaluaciones pendientes");
    expect(mocks.fetch.mock.calls.every(([, options]) => options.cache === "no-store")).toBe(true);
  });
});

describe("intro and read-only error handling", () => {
  it.each(["CANCELLED", "EXPIRED"] as const)("does not offer start for %s invitations", state => {
    const start = vi.fn(); render(<Intro template={{ title: "Backend" }} accessState={state} onStart={start} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(state === "CANCELLED" ? "Invitación cancelada" : "Invitación expirada");
    expect(start).not.toHaveBeenCalled();
  });
  it("has one focusable start button after the full integrity rules and starts only on click", () => {
    const start = vi.fn(); render(<Intro template={{ title: "Backend", totalQuestions: 10, timeLimit: 30, passingScore: 60 }} onStart={start} />);
    const button = screen.getByRole("button", { name: "Comenzar evaluación" });
    expect(screen.getAllByRole("button")).toHaveLength(1); expect(start).not.toHaveBeenCalled();
    expect(screen.getByText(/El uso de IA/).compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    button.focus(); expect(document.activeElement).toBe(button); fireEvent.click(button); expect(start).toHaveBeenCalledTimes(1);
  });
  it.each([403, 404])("handles HTTP%s identically, without leaking private response details", async status => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: "SECRET other candidate" }), { status }));
    render(<Results />); await screen.findByText("Estos resultados no están disponibles o no tienes acceso a ellos.");
    expect(document.body.textContent).not.toContain("SECRET");
    expect(screen.getByRole("link", { name: "Mis evaluaciones" }).getAttribute("href")).toBe("/assessments");
  });
  it.each([401, 500])("offers a safe retry for HTTP%s", async status => {
    mocks.fetch.mockResolvedValueOnce(new Response("private", { status })).mockResolvedValueOnce(new Response(JSON.stringify(result)));
    render(<Results />); const retry = await screen.findByRole("button", { name: "Reintentar" });
    fireEvent.click(retry); await screen.findByText("Aprobaste con 100%");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch.mock.calls.every(([, options]) => !options.method || options.method === "GET")).toBe(true);
  });
  it("distinguishes connectivity problems without displaying exception text", async () => {
    mocks.fetch.mockRejectedValue(new TypeError("SECRET network"));
    render(<Results />); await screen.findByText(/Comprueba tu conexión e inténtalo/); expect(document.body.textContent).not.toContain("SECRET");
  });
  it("loads authorized results and provides a direct inbox return", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify(result))); render(<Results />);
    await screen.findByText("Aprobaste con 100%"); expect(screen.getByRole("link", { name: /Mis evaluaciones/ })).toBeTruthy();
  });
  it("renders loading and recoverable inbox errors with accessible status and focus", () => {
    const reset = vi.fn(); const view = render(<InboxLoading />); expect(screen.getByRole("status")).toBeTruthy();
    view.rerender(<InboxError reset={reset} />); expect(screen.getByRole("alert")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Reintentar" }); button.focus(); expect(document.activeElement).toBe(button);
    fireEvent.click(button); expect(reset).toHaveBeenCalledOnce();
  });
});
