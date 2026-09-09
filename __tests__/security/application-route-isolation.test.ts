import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  companyId: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/session", () => ({
  getSessionOrThrow: async () => mocks.session(),
  getSessionCompanyId: mocks.companyId,
}));
vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    application: {
      findFirst: mocks.findFirst,
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

let GET: typeof import("@/app/api/applications/[id]/route")["GET"];

beforeAll(async () => {
  ({ GET } = await import("@/app/api/applications/[id]/route"));
});

describe("application route tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({
      user: { id: "recruiter-a", role: "RECRUITER" },
    });
    mocks.companyId.mockResolvedValue("company-a");
    mocks.findFirst.mockImplementation(async ({ where }) => {
      if (where.id === "application-a" && where.job?.companyId === "company-a") {
        return {
          id: "application-a",
          job: { id: "job-a", title: "Job A", companyId: "company-a" },
          candidate: { id: "candidate-a", name: "A", email: "a@example.test" },
          messages: [],
        };
      }
      return null;
    });
  });

  it("allows recruiter A to read application/candidate A", async () => {
    const response = await GET(
      new Request("http://localhost/api/applications/application-a") as never,
      { params: { id: "application-a" } }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cache-control")).not.toContain("public");
  });

  it("blocks recruiter A when applicationId is manipulated to company B", async () => {
    const response = await GET(
      new Request("http://localhost/api/applications/application-b") as never,
      { params: { id: "application-b" } }
    );
    expect(response.status).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "application-b", job: { companyId: "company-a" } },
    }));
  });
});
