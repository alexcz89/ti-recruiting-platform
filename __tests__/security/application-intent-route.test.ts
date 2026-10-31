import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), companyId: vi.fn(), execute: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/session", () => ({ getSessionCompanyId: mocks.companyId }));
vi.mock("@/lib/hiring-process/application-intents", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/hiring-process/application-intents")>(),
  executeApplicationIntent: mocks.execute,
}));

import { ApplicationNotFoundError, ConcurrentApplicationTransitionError } from "@/lib/hiring-process/transition-application";

let POST: typeof import("@/app/api/applications/[id]/intent/route")["POST"];
beforeAll(async () => { ({ POST } = await import("@/app/api/applications/[id]/intent/route")); });

function request(body: unknown) {
  return new Request("http://localhost/api/applications/application-a/intent", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

const reopen = { intent: "REOPEN_REJECTED", expectedVersion: 8, commandId: "reopen-once", reasonCode: "RECONSIDERED" };

describe("application intent route contract and permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ user: { id: "recruiter-a", role: "RECRUITER" } });
    mocks.companyId.mockResolvedValue("company-a");
    mocks.execute.mockResolvedValue({
      state: { stage: "REVIEW", disposition: "ACTIVE" },
      legacy: { stateVersion: 9, status: "REVIEWING", recruiterInterest: "REVIEW" },
      timestamps: { offerAt: null, hiredAt: null }, replayed: false,
    });
  });

  it("rejects unauthenticated, candidate and unapproved recruiter requests before the writer", async () => {
    mocks.session.mockResolvedValueOnce(null).mockResolvedValueOnce({ user: { id: "candidate", role: "CANDIDATE" } });
    expect((await POST(request(reopen), { params: { id: "application-a" } })).status).toBe(401);
    expect((await POST(request(reopen), { params: { id: "application-a" } })).status).toBe(403);
    mocks.companyId.mockResolvedValueOnce(null);
    expect((await POST(request(reopen), { params: { id: "application-a" } })).status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("uses server-derived company scope and forwards the validated reason and version", async () => {
    const response = await POST(request({ ...reopen, companyId: "company-b" }), { params: { id: "application-a" } });
    expect(response.status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
    const valid = await POST(request(reopen), { params: { id: "application-a" } });
    expect(valid.status).toBe(200);
    expect(valid.headers.get("cache-control")).toContain("no-store");
    expect(mocks.execute).toHaveBeenCalledWith({
      applicationId: "application-a", command: reopen,
      actor: { type: "RECRUITER", id: "recruiter-a", companyId: "company-a" },
    });
    expect((await valid.json()).application).toMatchObject({ stage: "REVIEW", stateVersion: 9 });
  });

  it("requires an explicit reason for a backward move and an OTHER note", async () => {
    const backward = { intent: "MOVE_BACKWARD", targetStage: "INTERVIEW", expectedVersion: 6, commandId: "backward-once" };
    expect((await POST(request(backward), { params: { id: "application-a" } })).status).toBe(400);
    expect((await POST(request({ ...backward, reasonCode: "OTHER" }), { params: { id: "application-a" } })).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect((await POST(request({ ...backward, reasonCode: "CORRECTION" }), { params: { id: "application-a" } })).status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ command: { ...backward, reasonCode: "CORRECTION" } }));
  });

  it("preserves non-disclosing not-found and version conflict responses", async () => {
    mocks.execute.mockRejectedValueOnce(new ApplicationNotFoundError()).mockRejectedValueOnce(new ConcurrentApplicationTransitionError());
    const missing = await POST(request(reopen), { params: { id: "foreign-application" } });
    expect(missing.status).toBe(404);
    expect(JSON.stringify(await missing.json())).not.toContain("company");
    const conflict = await POST(request(reopen), { params: { id: "application-a" } });
    expect(conflict.status).toBe(409);
    expect(conflict.headers.get("cache-control")).toContain("no-store");
  });

  it("allows an administrator explicitly without trusting a client company", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    const response = await POST(request({ intent: "HIRE_CANDIDATE", expectedVersion: 6, commandId: "hire-once" }), { params: { id: "application-a" } });
    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ actor: { type: "ADMIN", id: "admin", companyId: null } }));
    expect(mocks.companyId).not.toHaveBeenCalled();
  });
});
