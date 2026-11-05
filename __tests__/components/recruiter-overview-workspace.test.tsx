// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const db = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), profile: vi.fn(), company: vi.fn(), jobCount: vi.fn(), appCount: vi.fn(), attemptCount: vi.fn(), inviteCount: vi.fn(), groups: vi.fn(), jobs: vi.fn(), recent: vi.fn(), events: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: db.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  user: { findUnique: db.user }, recruiterProfile: { findUnique: db.profile }, company: { findUnique: db.company },
  job: { count: db.jobCount, findMany: db.jobs }, application: { count: db.appCount, groupBy: db.groups, findMany: db.recent },
  assessmentAttempt: { count: db.attemptCount }, assessmentInvite: { count: db.inviteCount }, applicationEvent: { findMany: db.events },
} }));
vi.mock("@/app/dashboard/components/actions", () => ({ resendVerificationAction: vi.fn() }));
vi.mock("@/app/dashboard/components/BannerEmailUnverified", () => ({ default: () => <p>Verifica tu correo</p> }));
vi.mock("@/app/dashboard/overview/QuickActionButtons", () => ({ default: ({ applicationId }: { applicationId: string }) => <button data-application={applicationId}>Acción existente</button> }));
import Overview from "@/app/dashboard/overview/page";
import Loading from "@/app/dashboard/overview/loading";
import ErrorBoundary from "@/app/dashboard/overview/error";
import SetupChecklist from "@/app/dashboard/components/SetupChecklist";

const now = new Date("2026-11-05T12:00:00Z");
const job = { id: "job-a", title: "Frontend", status: "OPEN", createdAt: now, _count: { applications: 3 }, applications: [], skills: [], requiredSkills: [], seniority: null, minYearsExperience: null };
const applied = { jobId: "job-a", stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW", stateVersion: 1, _count: { _all: 2 } };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("React", React);
  vi.stubEnv("CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED", "true");
  db.session.mockResolvedValue({ user: { id: "recruiter-a", role: "RECRUITER", companyId: "company-a" } });
  db.user.mockResolvedValue({ id: "recruiter-a", name: "Equipo", emailVerified: now });
  db.profile.mockResolvedValue({ status: "APPROVED", phone: "5555555555" });
  db.company.mockResolvedValue({ id: "company-a", name: "Empresa A", size: "ONE_TO_TEN", website: "https://example.invalid", billingPlan: "PRO" });
  db.jobCount.mockResolvedValue(0); db.appCount.mockResolvedValue(0); db.attemptCount.mockResolvedValue(0); db.inviteCount.mockResolvedValue(0);
  db.groups.mockResolvedValue([]); db.jobs.mockResolvedValue([]); db.recent.mockResolvedValue([]); db.events.mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function openWithJobs() {
  db.jobCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0); db.jobs.mockResolvedValue([job]);
  render(await Overview());
}

describe("recruiter operational overview", () => {
  it("gives an empty company a real publishing destination without zero KPIs or fictitious activity", async () => {
    render(await Overview());
    expect(screen.getByRole("heading", { name: "Aún no tienes vacantes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Publicar vacante" })).toHaveAttribute("href", "/dashboard/jobs/new");
    for (const label of ["Todo al día", "Sin alertas", "Actividad reciente", "Vacantes abiertas", "Pipeline activo", "Tu trabajo pendiente"]) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
  it("distinguishes jobs without candidates from completed work", async () => {
    await openWithJobs();
    expect(screen.getByText(/Todavía no recibes postulaciones/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mis vacantes" })).toBeInTheDocument();
    expect(screen.queryByText(/Todo al día/)).not.toBeInTheDocument();
    expect(screen.queryByText("Actividad reciente")).not.toBeInTheDocument();
  });
  it.each(["RECRUITER", "ADMIN"])("keeps the four real tasks, destinations and company scope for %s", async role => {
    db.session.mockResolvedValue({ user: { id: "actor-a", role, companyId: "company-a" } });
    db.appCount.mockResolvedValue(3); db.groups.mockResolvedValue([applied]);
    db.jobCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1); db.jobs.mockResolvedValue([job]);
    db.attemptCount.mockResolvedValue(2); db.inviteCount.mockResolvedValue(1);
    render(await Overview());
    for (const [name, href] of [["Revisar", "/dashboard/candidates/pending"], ["Ver resultados", "/dashboard/assessments?state=COMPLETED&sort=recent"], ["Dar seguimiento", "/dashboard/assessments?state=PENDING"], ["Ajustar", "/dashboard/jobs"]]) expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    expect(db.jobs).toHaveBeenCalledOnce(); expect(db.groups).toHaveBeenCalledOnce();
    expect(db.jobs.mock.calls[0][0]).toMatchObject({ where: { companyId: "company-a" }, take: 5 });
    expect(db.groups.mock.calls[0][0].where).toEqual({ job: { companyId: "company-a" } });
    expect(db.attemptCount.mock.calls[0][0].where).toEqual({ status: "SUBMITTED", OR: [{ invite: { job: { companyId: "company-a" } } }, { application: { job: { companyId: "company-a" } } }] });
  });
  it.each(["true", "false"])("uses the existing grouped reader globally and per job with reads=%s", async flag => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED", flag);
    db.appCount.mockResolvedValue(4);
    db.groups.mockResolvedValue([applied, { ...applied, jobId: "job-b", _count: { _all: 1 } }, { ...applied, stage: "REVIEW", status: "REVIEWING", _count: { _all: 1 } }]);
    db.jobs.mockResolvedValue([job, { ...job, id: "job-b", title: "Backend", status: "PAUSED", _count: { applications: 1 } }]);
    render(await Overview());
    const jobs = screen.getByRole("region", { name: "Mis vacantes" });
    const rows = within(jobs).getAllByRole("listitem");
    expect(within(rows[0]).getByText("2 por revisar")).toBeInTheDocument();
    expect(within(rows[1]).getByText("1 por revisar")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tu trabajo pendiente" })).toHaveTextContent("3 candidatos por revisar");
    expect(db.groups.mock.calls[0][0].by).toContain("jobId");
    expect(db.groups).toHaveBeenCalledOnce();
  });
  it("shows only real event fields and double-scopes the event/application tenant relationship", async () => {
    db.events.mockResolvedValue([{ id: "event-a", type: "APPLICATION_STAGE_CHANGED", happenedAt: now, application: { id: "app-a", candidate: { name: "Ana Demo" }, job: { id: "job-a", title: "Frontend" } } }]);
    await openWithJobs();
    const activity = screen.getByRole("region", { name: "Actividad reciente" });
    expect(within(activity).getByText(/Etapa actualizada/)).toBeInTheDocument();
    expect(within(activity).getByRole("link")).toHaveAttribute("href", "/dashboard/jobs/job-a/applications");
    const query = db.events.mock.calls[0][0];
    expect(query.where).toEqual({ companyId: "company-a", application: { job: { companyId: "company-a" } }, visibility: { in: ["INTERNAL", "BOTH"] }, type: { not: "LEGACY_STATE_IMPORTED" } });
    expect(query.take).toBe(5); expect(query.select).not.toHaveProperty("metadata"); expect(query.select).not.toHaveProperty("reasonCode"); expect(query.select).not.toHaveProperty("actorId");
    expect(db.recent.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
    expect(db.recent).toHaveBeenCalledOnce();
  });
  it("preserves recent application links and existing quick actions without inventing events", async () => {
    db.appCount.mockResolvedValue(1); db.recent.mockResolvedValue([{ ...applied, id: "app-a", createdAt: now, updatedAt: now, job: { id: "job-a", title: "Frontend" }, candidate: { name: "Ana Demo" } }]);
    await openWithJobs();
    expect(screen.getByRole("link", { name: /Ana Demo/ })).toHaveAttribute("href", "/dashboard/jobs/job-a/applications");
    expect(screen.getByRole("button", { name: "Acción existente", hidden: true })).toHaveAttribute("data-application", "app-a");
    expect(screen.queryByRole("heading", { name: "Actividad reciente" })).not.toBeInTheDocument();
  });
  it("does not query tenant data without a session company, including ADMIN", async () => {
    db.session.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    render(await Overview());
    expect(screen.getByText("Sin empresa asociada")).toBeInTheDocument();
    expect(db.company).not.toHaveBeenCalled(); expect(db.jobs).not.toHaveBeenCalled(); expect(db.events).not.toHaveBeenCalled();
  });
  it("lets query failures reach the scoped boundary instead of showing invented empty data", async () => {
    db.events.mockRejectedValue(new Error("internal database detail"));
    await expect(Overview()).rejects.toThrow("internal database detail");
  });
  it("exposes loading status and a safe retry boundary", () => {
    const { unmount } = render(<Loading />); expect(screen.getByRole("status")).toHaveTextContent("Cargando panel"); unmount();
    const reset = vi.fn(); render(<ErrorBoundary error={new Error("PRIVATE SQL SECRET")} reset={reset} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("PRIVATE SQL SECRET");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); expect(reset).toHaveBeenCalledOnce();
  });
  it("retains onboarding destinations and only shows unfinished tasks in compact mode", () => {
    render(<SetupChecklist compact user={{ emailVerified: now }} profile={{ status: "APPROVED", phone: "5555555555" }} company={{ id: "company-a", name: "Empresa A" }} />);
    expect(screen.queryByText("Verificar tu correo")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Agregar sitio web/ })).toHaveAttribute("href", "/dashboard/profile");
    expect(screen.getByRole("link", { name: /Elegir tamaño/ })).toHaveAttribute("href", "/dashboard/company");
  });
  it("keeps email verification available and omits a completed checklist", () => {
    const { unmount } = render(<SetupChecklist compact />);
    expect(screen.getByRole("button", { name: "Reenviar verificación" })).toHaveAttribute("type", "submit");
    unmount();
    const { container } = render(<SetupChecklist compact user={{ emailVerified: now }} profile={{ status: "APPROVED", phone: "5555555555" }} company={{ id: "company-a", name: "Empresa A", website: "https://example.invalid", size: "ONE_TO_TEN" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
