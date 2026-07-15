import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const sessionMocks = vi.hoisted(() => ({
  getSessionOrThrow: vi.fn(),
  getSessionCompanyId: vi.fn(),
}));

const jobMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/server/session", () => sessionMocks);
vi.mock("@/lib/server/prisma", () => ({
  prisma: { job: jobMocks },
}));

import { PATCH } from "@/app/api/jobs/[id]/route";

function request(status: string) {
  return new NextRequest("http://localhost/api/jobs/job-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

describe("PATCH /api/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.getSessionOrThrow.mockResolvedValue({
      user: { id: "recruiter-1", role: "RECRUITER" },
    });
    sessionMocks.getSessionCompanyId.mockResolvedValue("company-1");
  });

  it("updates only a job owned by the session company", async () => {
    jobMocks.findFirst.mockResolvedValue({ id: "job-1" });
    jobMocks.update.mockResolvedValue({
      id: "job-1",
      status: "PAUSED",
      updatedAt: new Date("2026-07-15T12:00:00.000Z"),
    });

    const response = await PATCH(request("PAUSED"), {
      params: { id: "job-1" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(jobMocks.findFirst).toHaveBeenCalledWith({
      where: { id: "job-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(jobMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: { status: "PAUSED" },
      })
    );
  });

  it("rejects unsupported status values", async () => {
    const response = await PATCH(request("ACTIVE"), {
      params: { id: "job-1" },
    });

    expect(response.status).toBe(400);
    expect(jobMocks.findFirst).not.toHaveBeenCalled();
    expect(jobMocks.update).not.toHaveBeenCalled();
  });

  it("does not update a job outside the session company", async () => {
    jobMocks.findFirst.mockResolvedValue(null);

    const response = await PATCH(request("CLOSED"), {
      params: { id: "job-1" },
    });

    expect(response.status).toBe(404);
    expect(jobMocks.update).not.toHaveBeenCalled();
  });

  it("returns unauthorized when there is no authenticated session", async () => {
    sessionMocks.getSessionOrThrow.mockRejectedValue(new Error("Unauthorized"));

    const response = await PATCH(request("PAUSED"), {
      params: { id: "job-1" },
    });

    expect(response.status).toBe(401);
    expect(sessionMocks.getSessionCompanyId).not.toHaveBeenCalled();
    expect(jobMocks.findFirst).not.toHaveBeenCalled();
    expect(jobMocks.update).not.toHaveBeenCalled();
  });
});
