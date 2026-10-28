import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  companyId: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findFirstOrThrow: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/session", () => ({
  getSessionOrThrow: mocks.session,
  getSessionCompanyId: mocks.companyId,
}));
vi.mock("@/lib/server/prisma", () => ({ prisma: { application: {
  findFirst: mocks.findFirst,
  findUnique: mocks.findUnique,
  findFirstOrThrow: mocks.findFirstOrThrow,
  updateMany: mocks.updateMany,
} } }));

let patchStatus: typeof import("@/app/api/applications/[id]/status/route")["PATCH"];
let patchInterest: typeof import("@/app/api/applications/[id]/interest/route")["PATCH"];
let patchGeneric: typeof import("@/app/api/applications/[id]/route")["PATCH"];

const row = (kind: "LEGACY" | "CANONICAL" | "NONE") => ({
  id: "application-a",
  stage: kind === "LEGACY" ? null : "REVIEW",
  disposition: kind === "CANONICAL" ? "ACTIVE" : null,
  stateVersion: kind === "LEGACY" ? 0 : 1,
  status: "REVIEWING",
  recruiterInterest: "REVIEW",
  rejectedAt: null,
  rejectionEmailSent: false,
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  job: { companyId: "company-a" },
  candidate: { id: "candidate-a", name: "Candidate" },
});

const request = (path: string, body: object) => new Request(
  `http://localhost/api/applications/application-a${path}`,
  { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
);
const params = { params: { id: "application-a" } };

beforeAll(async () => {
  ({ PATCH: patchStatus } = await import("@/app/api/applications/[id]/status/route"));
  ({ PATCH: patchInterest } = await import("@/app/api/applications/[id]/interest/route"));
  ({ PATCH: patchGeneric } = await import("@/app/api/applications/[id]/route"));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "recruiter-a", email: "a@example.test", role: "RECRUITER" } });
  mocks.companyId.mockResolvedValue("company-a");
  mocks.findFirst.mockResolvedValue(row("LEGACY"));
  mocks.findUnique.mockResolvedValue(row("LEGACY"));
  mocks.findFirstOrThrow.mockResolvedValue(row("LEGACY"));
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("legacy Application writer boundary", () => {
  it.each(["CANONICAL", "NONE"] as const)("rejects %s status and interest writes", async (kind) => {
    mocks.findUnique.mockResolvedValue(row(kind));
    mocks.findFirst.mockResolvedValue(row(kind));
    expect((await patchStatus(request("/status", { status: "INTERVIEW" }) as never, params)).status).toBe(409);
    expect((await patchInterest(request("/interest", { recruiterInterest: "ACCEPTED" }), params)).status).toBe(409);
    expect((await patchGeneric(request("", { status: "INTERVIEW" }) as never, params)).status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a null/null application whose stateVersion is not legacy", async () => {
    const inconsistent = { ...row("LEGACY"), stateVersion: 1 };
    mocks.findFirst.mockResolvedValue(inconsistent);
    mocks.findUnique.mockResolvedValue(inconsistent);
    expect((await patchStatus(request("/status", { status: "INTERVIEW" }) as never, params)).status).toBe(409);
    expect((await patchInterest(request("/interest", { recruiterInterest: "ACCEPTED" }), params)).status).toBe(409);
    expect((await patchGeneric(request("", { status: "INTERVIEW" }) as never, params)).status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it.each(["LEGACY", "CANONICAL", "NONE"] as const)(
    "does not silently ignore recruiterInterest in generic PATCH for %s",
    async (kind) => {
      mocks.findFirst.mockResolvedValue(row(kind));
      const response = await patchGeneric(request("", { recruiterInterest: "ACCEPTED" }) as never, params);
      expect(response.status).toBe(kind === "LEGACY" ? 400 : 409);
      const both = await patchGeneric(request("", { status: "INTERVIEW", recruiterInterest: "ACCEPTED" }) as never, params);
      expect(both.status).toBe(kind === "LEGACY" ? 400 : 409);
      expect(mocks.updateMany).not.toHaveBeenCalled();
    },
  );

  it("retains the atomic legacy state guard in all three writers", async () => {
    expect((await patchStatus(request("/status", { status: "INTERVIEW" }) as never, params)).status).toBe(200);
    expect((await patchInterest(request("/interest", { recruiterInterest: "ACCEPTED" }), params)).status).toBe(200);
    expect((await patchGeneric(request("", { status: "INTERVIEW" }) as never, params)).status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledTimes(3);
    for (const [argument] of mocks.updateMany.mock.calls) {
      expect(argument.where.AND).toContainEqual({ stage: null, disposition: null, stateVersion: 0 });
      expect(argument.where.AND[0]).toMatchObject({ id: "application-a", job: { companyId: "company-a" } });
    }
  });

  it("returns conflict when a concurrent conversion defeats the atomic guard", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await patchStatus(request("/status", { status: "INTERVIEW" }) as never, params)).status).toBe(409);
    expect((await patchInterest(request("/interest", { recruiterInterest: "ACCEPTED" }), params)).status).toBe(409);
    expect((await patchGeneric(request("", { status: "INTERVIEW" }) as never, params)).status).toBe(409);
    expect(mocks.findFirstOrThrow).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledTimes(3);
  });

  it("keeps canonical no-ops read-only and permits unrelated fields", async () => {
    mocks.findUnique.mockResolvedValue(row("CANONICAL"));
    mocks.findFirst.mockResolvedValue(row("CANONICAL"));
    const status = await patchStatus(request("/status", { status: "REVIEWING" }) as never, params);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ ok: true, application: { status: "REVIEWING" } });
    expect((await patchInterest(request("/interest", { recruiterInterest: "REVIEW" }), params)).status).toBe(200);
    expect((await patchGeneric(request("", { status: "REVIEWING" }) as never, params)).status).toBe(200);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect((await patchGeneric(request("", { coverLetter: "updated" }) as never, params)).status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "application-a", job: { companyId: "company-a" } },
      data: expect.objectContaining({ status: undefined, coverLetter: "updated" }),
    }));
    expect((await patchGeneric(request("", { status: "REVIEWING", resumeUrl: "https://example.invalid/resume.pdf" }) as never, params)).status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: undefined, resumeUrl: "https://example.invalid/resume.pdf" }),
    }));
  });

  it("preserves recruiter role and company isolation", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await patchGeneric(request("", { status: "INTERVIEW" }) as never, params)).status).toBe(404);
    expect((await patchInterest(request("/interest", { recruiterInterest: "ACCEPTED" }), params)).status).toBe(404);
    mocks.findUnique.mockResolvedValue({ ...row("LEGACY"), job: { companyId: "company-b" } });
    expect((await patchStatus(request("/status", { status: "INTERVIEW" }) as never, params)).status).toBe(403);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ user: { id: "candidate", email: "c@example.test", role: "CANDIDATE" } });
    expect((await patchStatus(request("/status", { status: "INTERVIEW" }) as never, params)).status).toBe(403);
    expect((await patchInterest(request("/interest", { recruiterInterest: "ACCEPTED" }), params)).status).toBe(403);
    expect((await patchGeneric(request("", { status: "INTERVIEW" }) as never, params)).status).toBe(403);
  });

  it("keeps existing administrator access explicit", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin", email: "admin@example.test", role: "ADMIN" } });
    mocks.companyId.mockResolvedValue(null);
    expect((await patchStatus(request("/status", { status: "INTERVIEW" }) as never, params)).status).toBe(200);
    expect((await patchInterest(request("/interest", { recruiterInterest: "ACCEPTED" }), params)).status).toBe(200);
    expect((await patchGeneric(request("", { status: "INTERVIEW" }) as never, params)).status).toBe(200);
    for (const [argument] of mocks.updateMany.mock.calls) {
      expect(argument.where.AND).toContainEqual({ stage: null, disposition: null, stateVersion: 0 });
      expect(argument.where.AND[0]).toEqual({ id: "application-a" });
    }
  });
});
