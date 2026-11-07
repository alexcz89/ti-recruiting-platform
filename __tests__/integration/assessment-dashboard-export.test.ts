import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const enabled = process.env.RUN_ASSESSMENT_EXPORT_DB_TESTS === "true";
function safeDatabase(value: string) {
  try {
    const url = new URL(value);
    const disposable = url.pathname === "/taskio_assessments_csv_qa";
    const ciService = process.env.CI === "true" && url.hostname === "127.0.0.1" &&
      url.port === "55433" && url.pathname === "/taskio_canonical_hiring_qa" && url.username === "taskio_ci";
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost"].includes(url.hostname) && (disposable || ciService);
  } catch { return false; }
}
if (enabled && (!safeDatabase(process.env.DATABASE_URL ?? "") || process.env.DIRECT_URL !== process.env.DATABASE_URL)) {
  throw new Error("CSV integration tests require the disposable local or CI service database and matching DIRECT_URL.");
}
const database = enabled ? describe : describe.skip;
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
// Prisma, the company guard, SQL selection and endpoint hydration are all real.
const prefix = "qa-csv-" + randomUUID();
const id = (suffix: string | number) => `${prefix}-${suffix}`;
const now = new Date();
const future = new Date(now.getTime() + 86400_000);
const past = new Date(now.getTime() - 86400_000);
let db: PrismaClient;
let dashboard: typeof import("@/app/api/dashboard/assessments/route")["GET"];
let exportCsv: typeof import("@/app/api/dashboard/assessments/export/route")["GET"];
let selectPage: typeof import("@/lib/assessments/dashboard-page-query")["selectAssessmentPage"];
const actor = (suffix = "recruiter-a", role = "RECRUITER") => mocks.session.mockResolvedValue({ user: { id: id(suffix), role } });
const request = (query = "") => new Request(`http://localhost/api/dashboard/assessments/export?${query}`);
// Independent RFC 4180 reader: handles optional UTF-8 BOM, CR/LF and escaped quotes.
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = text.startsWith("\uFEFF") ? 1 : 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if (char === "\r" && text[index + 1] === "\n" && !quoted) { row.push(cell); rows.push(row); row = []; cell = ""; index++; }
    else cell += char;
  }
  row.push(cell); rows.push(row); return rows;
}

database("dashboard/CSV parity on disposable real PostgreSQL", () => {
  beforeAll(async () => {
    db = (await import("@/lib/server/prisma")).prisma; await db.$connect();
    dashboard = (await import("@/app/api/dashboard/assessments/route")).GET;
    exportCsv = (await import("@/app/api/dashboard/assessments/export/route")).GET;
    selectPage = (await import("@/lib/assessments/dashboard-page-query")).selectAssessmentPage;
    for (const side of ["a", "b"]) {
      await db.company.create({ data: { id: id("company-" + side), name: "Synthetic CSV " + side } });
      await db.user.create({ data: { id: id("recruiter-" + side), email: id("recruiter-" + side) + "@example.invalid", role: "RECRUITER",
        recruiterProfile: { create: { companyId: id("company-" + side), companyName: "Synthetic CSV " + side, status: "APPROVED" } } } });
      await db.job.create({ data: { id: id("job-" + side), companyId: id("company-" + side), title: "Synthetic CSV " + side,
        location: "Remote", employmentType: "FULL_TIME", description: "Synthetic only", skills: [] } });
    }
    await db.user.create({ data: { id: id("pending-recruiter"), role: "RECRUITER", email: id("pending-recruiter") + "@example.invalid",
      recruiterProfile: { create: { companyId: id("company-a"), companyName: "Synthetic CSV a", status: "PENDING" } } } });
    await db.assessmentTemplate.create({ data: { id: id("template"), slug: id("template"), title: 'CSV, "técnica"\r\n東京',
      type: "MCQ", difficulty: "JUNIOR", totalQuestions: 1, passingScore: 70, timeLimit: 30, sections: [] } });
    // 2105 invites: old exporter truncated before the older tail of completed rows.
    for (let start = 0; start < 2106; start += 500) {
      const indexes = Array.from({ length: Math.min(500, 2106 - start) }, (_, offset) => start + offset);
      await db.user.createMany({ data: indexes.map(index => ({ id: id("candidate-" + index), role: "CANDIDATE" as const,
        email: id("candidate-" + index) + "@example.invalid", name: index === 2105 ? "CSV foreign" : `CSV ${index < 2000 ? "bulk" : "tail"} ${index}` })) });
      await db.application.createMany({ data: indexes.map(index => ({ id: id("app-" + index), candidateId: id("candidate-" + index), jobId: id(index === 2105 ? "job-b" : "job-a") })) });
      await db.assessmentInvite.createMany({ data: indexes.map(index => ({ id: id("invite-" + String(index).padStart(4, "0")), token: id("SECRET_TOKEN-" + index),
        candidateId: id("candidate-" + index), applicationId: id("app-" + index), templateId: id("template"), jobId: id(index === 2105 ? "job-b" : "job-a"),
        status: index === 2004 ? "CANCELLED" as const : "SENT" as const,
        expiresAt: index === 2003 ? past : future, updatedAt: index >= 2000 ? past : now })) });
    }
    await db.assessmentAttempt.createMany({ data: [
      { id: id("linked-zero"), inviteId: id("invite-0000"), applicationId: id("app-0"), candidateId: id("candidate-0"), templateId: id("template"), status: "SUBMITTED", totalScore: 0, passed: false, timeSpent: 0 },
      { id: id("legacy-tie-a"), applicationId: id("app-1"), candidateId: id("candidate-1"), templateId: id("template"), status: "SUBMITTED", totalScore: 1, createdAt: now },
      { id: id("legacy-tie-z"), applicationId: id("app-1"), candidateId: id("candidate-1"), templateId: id("template"), status: "SUBMITTED", totalScore: 66, passed: false, createdAt: now },
      { id: id("active"), inviteId: id("invite-2000"), candidateId: id("candidate-2000"), templateId: id("template"), status: "IN_PROGRESS", expiresAt: future },
      { id: id("expired-attempt"), inviteId: id("invite-2001"), candidateId: id("candidate-2001"), templateId: id("template"), status: "IN_PROGRESS", expiresAt: past },
      { id: id("null-grade"), inviteId: id("invite-2002"), candidateId: id("candidate-2002"), templateId: id("template"), status: "SUBMITTED", totalScore: null, passed: null },
      ...Array.from({ length: 100 }, (_, offset) => { const index = offset + 2005; return {
        id: id("final-" + index), inviteId: id("invite-" + index), candidateId: id("candidate-" + index), templateId: id("template"), status: "SUBMITTED" as const,
        totalScore: offset % 2 ? 75 : 90, passed: true,
      }; }),
    ] });
    // >5000 tempting legacy attempts must not displace the linked attempt with score 0.
    for (let start = 0; start < 5001; start += 500) {
      await db.assessmentAttempt.createMany({ data: Array.from({ length: Math.min(500, 5001 - start) }, (_, offset) => ({
        id: id("legacy-history-" + (start + offset)), applicationId: id("app-0"), templateId: id("template"), candidateId: id("candidate-0"),
        status: "SUBMITTED" as const, totalScore: 99, passed: true, createdAt: future,
      })) });
    }
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    try {
      await db.assessmentAttempt.deleteMany({ where: { id: { startsWith: prefix } } });
      await db.assessmentInvite.deleteMany({ where: { id: { startsWith: prefix } } });
      await db.application.deleteMany({ where: { id: { startsWith: prefix } } });
      await db.assessmentTemplate.deleteMany({ where: { id: id("template") } });
      await db.job.deleteMany({ where: { id: { startsWith: prefix } } });
      await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
      await db.company.deleteMany({ where: { id: { startsWith: prefix } } });
    } finally { await db.$disconnect(); }
  });

  it.each(["recent", "score_desc", "score_asc"])("matches every dashboard page globally for %s, with ties, NULL and legacy attempts", async sort => {
    actor(); const query = `state=COMPLETED&hasAttempt=1&sort=${sort}`;
    const emails: string[] = []; let page = 1; let pages = 1;
    do {
      const response = await dashboard(request(query + `&page=${page}`)); expect(response.status).toBe(200);
      const body = await response.json(); pages = body.totalPages;
      expect(body.total).toBe(103);
      emails.push(...body.rows.map((row: { inv: { candidate: { email: string } } }) => row.inv.candidate.email)); page++;
    } while (page <= pages);
    const response = await exportCsv(request(query + "&page=42")); expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }).decode(bytes);
    const csv = parseCsv(text);
    expect(csv[0]).toEqual(["Candidato", "Email", "Assessment", "Vacante", "Estado", "Score (%)", "Aprobado", "Tiempo (seg)", "Anti-cheat", "Fecha"]);
    expect(csv.some(row => row[6] === "Sí")).toBe(true);
    expect(csv).toHaveLength(104); expect(csv.every(row => row.length === 10)).toBe(true);
    expect(csv.slice(1).map(row => row[1])).toEqual(emails);
    const zero = csv.find(row => row[1] === id("candidate-0") + "@example.invalid")!;
    expect(zero.slice(5, 8)).toEqual(["0", "No", "0"]);
    expect(csv.find(row => row[1] === id("candidate-1") + "@example.invalid")?.[5]).toBe("66");
    expect(csv.find(row => row[1] === id("candidate-2002") + "@example.invalid")?.slice(5, 7)).toEqual(["", "-"]);
    if (sort.startsWith("score_")) expect(csv[csv.length - 1][1]).toBe(id("candidate-2002") + "@example.invalid");
    expect(text).not.toContain("SECRET_TOKEN"); expect(text).not.toContain("CSV foreign");
  }, 30_000);

  it.each(["IN_PROGRESS", "EXPIRED", "CANCELLED", "PENDING"])("preserves state %s, search, job and attempt filters", async state => {
    actor(); const query = `q=CSV+tail&jobId=${id("job-a")}&state=${state}`;
    const body = await (await dashboard(request(query))).json();
    const csv = parseCsv(await (await exportCsv(request(query))).text());
    expect(csv.slice(1).map(row => row[1])).toEqual(body.rows.map((row: { inv: { candidate: { email: string } } }) => row.inv.candidate.email));
    expect(csv.slice(1).every(row => row[4] === state)).toBe(true);
  });
  it("rejects 2105 eligible invitations, exports exactly 2000 after refining, and ignores arbitrary page numbers", async () => {
    actor(); expect((await exportCsv(request())).status).toBe(422);
    for (const page of [1, 99]) {
      const response = await exportCsv(request(`q=CSV+bulk&page=${page}`)); expect(response.status).toBe(200);
      const csv = parseCsv(await response.text()); expect(csv).toHaveLength(2001);
      expect(csv[1][1]).toBe(id("candidate-0") + "@example.invalid"); expect(csv[2000][1]).toBe(id("candidate-1999") + "@example.invalid");
    }
  }, 30_000);
  it("uses literal search, not SQL LIKE wildcards, with the same invalid-filter defaults", async () => {
    actor(); expect(parseCsv(await (await exportCsv(request("q=%25_&state=INVALID&sort=INVALID"))).text())).toHaveLength(1);
  });
  it("enforces actual approved-profile company scope even for foreign jobId or client companyId", async () => {
    actor(); const response = await exportCsv(request(`jobId=${id("job-b")}&companyId=${id("company-b")}`));
    expect(response.status).toBe(200); expect(parseCsv(await response.text())).toHaveLength(1);
    actor("recruiter-b"); const csv = parseCsv(await (await exportCsv(request())).text()); expect(csv).toHaveLength(2); expect(csv[1][0]).toBe("CSV foreign");
    actor("pending-recruiter"); expect((await exportCsv(request())).status).toBe(403);
  });
  it("allows ADMIN across companies, but denies candidates and unauthenticated users before any export", async () => {
    actor("admin", "ADMIN"); const csv = parseCsv(await (await exportCsv(request("q=CSV+foreign"))).text()); expect(csv[1][0]).toBe("CSV foreign");
    actor("candidate-0", "CANDIDATE"); expect((await exportCsv(request())).status).toBe(403);
    mocks.session.mockResolvedValue(null); expect((await exportCsv(request())).status).toBe(401);
  });
  it("matches the no-attempt filter without losing records beyond the first page", async () => {
    actor();
    const query = "q=CSV+bulk&hasAttempt=0&sort=score_desc";
    const body = await (await dashboard(request(query))).json();
    const csv = parseCsv(await (await exportCsv(request(query))).text());
    expect(body.total).toBe(1998); expect(csv).toHaveLength(1999);
    expect(csv.slice(1, 51).map(row => row[1])).toEqual(body.rows.map((row: { inv: { candidate: { email: string } } }) => row.inv.candidate.email));
    expect(csv.slice(1).every(row => row[5] === "" && row[6] === "-")).toBe(true);
  });
  it("escapes formula cells and quoted Unicode without modifying original database values", async () => {
    actor("recruiter-b");
    const name = ' \t=HYPERLINK("https://example.invalid","QA")';
    const email = "+csv@example.invalid";
    const title = '@SUM(1,2)\r\n"Vacante"';
    await db.user.update({ where: { id: id("candidate-2105") }, data: { name, email } });
    await db.job.update({ where: { id: id("job-b") }, data: { title } });
    const csv = parseCsv(await (await exportCsv(request())).text());
    expect(csv).toHaveLength(2);
    expect(csv[1].slice(0, 4)).toEqual(["'" + name, "'" + email, 'CSV, "técnica"\r\n東京', "'" + title]);
    expect((await db.user.findUniqueOrThrow({ where: { id: id("candidate-2105") } })).name).toBe(name);
    expect((await db.job.findUniqueOrThrow({ where: { id: id("job-b") } })).title).toBe(title);
  });
  it("keeps the selected score stable within the export snapshot during a concurrent commit", async () => {
    await db.$transaction(async tx => {
      const selection = await selectPage({ companyId: id("company-a"), isAdmin: false, q: "CSV bulk 0", jobId: "", state: "ALL", hasAttempt: "", sort: "recent", page: 1, take: 2000, now }, tx);
      expect(selection.rows[0].attemptId).toBe(id("linked-zero"));
      await db.assessmentAttempt.update({ where: { id: id("linked-zero") }, data: { totalScore: 12 } });
      expect((await tx.assessmentAttempt.findUniqueOrThrow({ where: { id: id("linked-zero") } })).totalScore).toBe(0);
    }, { isolationLevel: "RepeatableRead" });
    await db.assessmentAttempt.update({ where: { id: id("linked-zero") }, data: { totalScore: 0 } });
  });
});
