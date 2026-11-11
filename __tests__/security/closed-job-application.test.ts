import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  findJob: vi.fn(),
  findApplication: vi.fn(),
  findUser: vi.fn(),
  createApplication: vi.fn(),
  sendEmail: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.session,
}));
vi.mock("@/lib/server/auth", () => ({
  authOptions: {},
}));
vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    job: { findUnique: mocks.findJob },
    application: { findFirst: mocks.findApplication },
    user: { findUnique: mocks.findUser },
  },
}));
vi.mock("@/lib/server/session", () => ({
  getSessionCompanyId: vi.fn(),
}));
vi.mock("@/lib/hiring-process/create-application", () => ({
  createApplicationForHiringProcessRollout: mocks.createApplication,
  JobNotOpenForApplicationsError: class JobNotOpenForApplicationsError extends Error {
    constructor() {
      super("Esta vacante ya no recibe postulaciones");
      this.name = "JobNotOpenForApplicationsError";
    }
  },
}));
vi.mock("@/lib/server/mailer", () => ({
  sendApplicationEmail: mocks.sendEmail,
}));
vi.mock("@/lib/notifications/service", () => ({
  NotificationService: { create: mocks.notify },
}));

import { POST } from "@/app/api/applications/route";
import { JobNotOpenForApplicationsError } from "@/lib/hiring-process/create-application";

function request() {
  return new NextRequest("http://localhost:3000/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: "job-a" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.session.mockResolvedValue({
    user: { id: "candidate-a", role: "CANDIDATE" },
  });

  mocks.findJob.mockResolvedValue({
    id: "job-a",
    title: "Desarrollador",
    companyId: "company-a",
    recruiterId: null,
    status: "OPEN",
    company: { name: "Empresa A" },
  });

  mocks.findApplication.mockResolvedValue(null);

  mocks.findUser.mockResolvedValue({
    id: "candidate-a",
    name: "Candidato",
    firstName: "Candidato",
    lastName: null,
    email: null,
    resumeUrl: null,
  });

  mocks.createApplication.mockResolvedValue({
    id: "application-a",
  });
});

describe("Public application job status boundary", () => {
  it.each(["PAUSED", "CLOSED"])(
    "rejects applications when job is %s",
    async (status) => {
      mocks.findJob.mockResolvedValue({
        id: "job-a",
        title: "Desarrollador",
        companyId: "company-a",
        recruiterId: null,
        company: { name: "Empresa A" },
        status,
      });

      const response = await POST(request());

      expect(response.status).toBe(409);
      expect(mocks.createApplication).not.toHaveBeenCalled();
      expect(mocks.findApplication).not.toHaveBeenCalled();
    }
  );

  it("allows applications to OPEN jobs", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(mocks.createApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-a",
        candidateId: "candidate-a",
      })
    );
  });

  it("returns 409 when writer detects concurrent closure", async () => {
    mocks.createApplication.mockRejectedValue(
      new JobNotOpenForApplicationsError()
    );

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Esta vacante ya no recibe postulaciones",
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("rejects missing jobs", async () => {
    mocks.findJob.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(mocks.createApplication).not.toHaveBeenCalled();
  });

  it("rejects non-candidate roles", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "recruiter-a", role: "RECRUITER" },
    });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.createApplication).not.toHaveBeenCalled();
  });
});
