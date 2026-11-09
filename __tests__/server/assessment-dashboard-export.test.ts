import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), company: vi.fn(), select: vi.fn(), invites: vi.fn(), attempts: vi.fn(), transaction: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/session", () => ({ getSessionCompanyId: mocks.company }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/assessments/dashboard-page-query", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/assessments/dashboard-page-query")>(),
  selectAssessmentPage: mocks.select,
}));
import { GET } from "@/app/api/dashboard/assessments/export/route";
import { parseAssessmentFilters } from "@/lib/assessments/dashboard-page-query";

const tx = { assessmentInvite: { findMany: mocks.invites }, assessmentAttempt: { findMany: mocks.attempts } };
const invite = (id = "a", name = "Candidate QA") => ({ id, updatedAt: new Date("2026-11-01T12:00:00Z"),
  candidate: { name, email: `${id}@example.invalid` }, template: { title: "Technical" }, application: { job: { title: "Backend" } } });
const request = (query = "") => new Request(`http://localhost/api/dashboard/assessments/export?${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { role: "RECRUITER" } });
  mocks.company.mockResolvedValue("company-a");
  mocks.transaction.mockImplementation(callback => callback(tx));
  mocks.select.mockResolvedValue({ total: 1, rows: [{ inviteId: "a", attemptId: "legacy-selected", uiState: "COMPLETED" }] });
  mocks.invites.mockResolvedValue([invite()]);
  mocks.attempts.mockResolvedValue([{ id: "legacy-selected", totalScore: 0, passed: false, timeSpent: 0, severity: "NORMAL", submittedAt: null }]);
});

describe("global assessment CSV export", () => {
  it("prefixes one UTF-8 BOM and preserves accents, special characters and all ten columns", async () => {
    const name = "María — Muñoz 東京";
    const item = invite("a", name);
    mocks.invites.mockResolvedValue([item]);
    mocks.attempts.mockResolvedValue([{ id: "legacy-selected", totalScore: 0, passed: true, timeSpent: 0, severity: "NORMAL", submittedAt: null }]);
    const response = await GET(request());
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    // Response.text() strips the BOM; inspect the actual file bytes instead.
    const csv = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }).decode(bytes);
    expect(csv.startsWith("\uFEFFCandidato,Email,")).toBe(true);
    expect(csv.split("\uFEFF")).toHaveLength(2);
    const [header, row] = csv.slice(1).split("\r\n");
    expect(header.split(",")).toHaveLength(10);
    expect(row.split(",")).toHaveLength(10);
    expect(row).toContain(name);
    expect(row).toContain(",COMPLETED,0,Sí,0,Sin alerta de severidad,");
    expect(item.candidate.name).toBe(name);
  });
  it("uses the dashboard selection, ignores page, preserves 0/false and selects no tokens or secrets", async () => {
    const response = await GET(request("q=+QA+&jobId=job-a&state=completed&hasAttempt=1&sort=score_asc&page=42"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain('filename="evaluaciones.csv"');
    expect(await response.text()).toContain("COMPLETED,0,No,0,Sin alerta de severidad,2026-11-01T12:00:00.000Z");
    expect(mocks.select).toHaveBeenCalledWith(expect.objectContaining({ q: "QA", jobId: "job-a", state: "COMPLETED", hasAttempt: "1", sort: "score_asc", page: 1, take: 2000, companyId: "company-a", isAdmin: false }), tx);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", timeout: 15000 });
    expect(mocks.invites.mock.calls[0][0].where.application.job).toEqual({ companyId: "company-a", id: "job-a" });
    expect(mocks.invites.mock.calls[0][0].select).toEqual({ id: true, updatedAt: true, candidate: { select: { name: true, email: true } }, template: { select: { title: true } }, application: { select: { job: { select: { title: true } } } } });
    expect(mocks.attempts.mock.calls[0][0].where).toEqual({ id: { in: ["legacy-selected"] } });
  });
  it("preserves SQL ordering even if hydration arrives reversed, and retains absent grades", async () => {
    mocks.select.mockResolvedValue({ total: 2, rows: [
      { inviteId: "b", attemptId: null, uiState: "PENDING" }, { inviteId: "a", attemptId: "legacy-selected", uiState: "COMPLETED" },
    ] });
    mocks.invites.mockResolvedValue([invite("a"), invite("b", "First")]);
    const lines = (await (await GET(request())).text()).split("\r\n");
    expect(lines).toHaveLength(3); expect(lines[1]).toContain("First,b@example.invalid,Technical,Backend,PENDING,,-,,Sin datos,");
    expect(lines[2]).toContain("COMPLETED,0,No,0,");
  });
  it.each([2001, 5001])("rejects %s matches before loading details, never producing partial CSV", async total => {
    mocks.select.mockResolvedValue({ total, rows: [{ inviteId: "a" }] });
    const response = await GET(request()); expect(response.status).toBe(422);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: expect.stringMatching(/2000.*Refina/) });
    expect(mocks.invites).not.toHaveBeenCalled(); expect(mocks.attempts).not.toHaveBeenCalled();
  });
  it("accepts exactly 2000 eligible records and does not apply another attempt cap", async () => {
    const invites = Array.from({ length: 2000 }, (_, i) => invite(String(i)));
    mocks.select.mockResolvedValue({ total: 2000, rows: invites.map(inv => ({ inviteId: inv.id, attemptId: null, uiState: "PENDING" })) });
    mocks.invites.mockResolvedValue(invites); mocks.attempts.mockResolvedValue([]);
    const response = await GET(request()); expect(response.status).toBe(200);
    expect((await response.text()).split("\r\n")).toHaveLength(2001);
    expect(mocks.invites.mock.calls[0][0]).not.toHaveProperty("take"); expect(mocks.attempts.mock.calls[0][0]).not.toHaveProperty("take");
  });
  it("returns headers only when no authorized matches exist", async () => {
    mocks.select.mockResolvedValue({ total: 0, rows: [] });
    expect((await (await GET(request("jobId=foreign-job"))).text()).split("\r\n")).toHaveLength(1);
    expect(mocks.invites).not.toHaveBeenCalled();
  });
  it.each(["=1+1", "+SUM(1,2)", "-1+2", "@SUM(1)", " \t=1+1", "\r\n=1+1", "\u0000=1+1"])("neutralizes spreadsheet formulas %j", async text => {
    mocks.invites.mockResolvedValue([invite("a", text)]);
    const csv = await (await GET(request())).text();
    expect(csv).toContain((/[",\r\n]/.test(text) ? `"'${text.replaceAll('"', '""')}"` : `'${text}`) + ",a@example.invalid");
  });
  it("quotes commas, double quotes, CR/LF and preserves Unicode without changing stored values", async () => {
    const item = invite("a", 'Muñoz, "QA"\r\n東京'); mocks.invites.mockResolvedValue([item]);
    const csv = await (await GET(request())).text(); expect(csv).toContain('"Muñoz, ""QA""\r\n東京"'); expect(item.candidate.name).toBe('Muñoz, "QA"\r\n東京');
  });
  it.each([null, "CANDIDATE", "UNKNOWN"])("rejects unauthorized role %s before querying", async role => {
    mocks.session.mockResolvedValue(role ? { user: { role } } : null);
    const response = await GET(request()); expect(response.status).toBe(role ? 403 : 401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("requires an approved company and does not trust a client companyId", async () => {
    mocks.company.mockResolvedValue(null); expect((await GET(request("companyId=company-b"))).status).toBe(403); expect(mocks.select).not.toHaveBeenCalled();
    mocks.company.mockResolvedValue("company-a"); await GET(request("companyId=company-b"));
    expect(mocks.select).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-a", isAdmin: false }), tx);
  });
  it("preserves explicit admin access without a recruiter company", async () => {
    mocks.session.mockResolvedValue({ user: { role: "ADMIN" } }); mocks.company.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(200);
    expect(mocks.select).toHaveBeenCalledWith(expect.objectContaining({ companyId: null, isAdmin: true }), tx);
    expect(mocks.invites.mock.calls[0][0].where.application.job).toEqual({});
  });
  it.each(["query", "missing-invite", "missing-attempt"])("fails closed without partial CSV or raw errors: %s", async mode => {
    if (mode === "query") mocks.select.mockRejectedValue(new Error("DATABASE_CREDENTIAL_SECRET"));
    if (mode === "missing-invite") mocks.invites.mockResolvedValue([]);
    if (mode === "missing-attempt") mocks.attempts.mockResolvedValue([]);
    const response = await GET(request()); expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/SECRET|Candidate|Incomplete/);
  });
  it("normalizes invalid filters just like the dashboard", () => {
    expect(parseAssessmentFilters(new URLSearchParams("q=+literal%25_+&state=INVALID&hasAttempt=invalid&sort=invalid")))
      .toEqual({ q: "literal%_", state: "ALL", jobId: "", hasAttempt: "invalid", sort: "invalid" });
  });
  it("preserves severity and multiple-session evidence in CSV", async () => {
    mocks.attempts.mockResolvedValue([{
      id: "legacy-selected",
      totalScore: 80,
      passed: true,
      timeSpent: 60,
      severity: "NORMAL",
      severityScore: 30,
      multiSession: true,
      submittedAt: null,
    }]);

    const response = await GET(request());
    expect(response.status).toBe(200);

    const csv = await response.text();

    expect(csv).toContain("Revisar señales:");
    expect(csv).toContain("Varias sesiones registradas");
    expect(csv).toContain("Indicador: 30");
    expect(csv).not.toContain(",NORMAL,");
  });
});
