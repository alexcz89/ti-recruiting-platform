import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getAssessmentTemplateManagementWhere,
  getAssessmentTemplateVisibilityWhere,
} from "@/lib/assessments/access";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getSessionCompanyId: vi.fn(),
  getSessionOrThrow: vi.fn(),
  templateFindMany: vi.fn(),
  templateFindFirst: vi.fn(),
  jobFindUnique: vi.fn(),
  jobFindFirst: vi.fn(),
  jobAssessmentFindFirst: vi.fn(),
  jobAssessmentFindMany: vi.fn(),
  jobAssessmentFindUnique: vi.fn(),
  jobAssessmentUpdate: vi.fn(),
  jobAssessmentCreate: vi.fn(),
}));

const prismaMock = {
  assessmentTemplate: {
    findMany: mocks.templateFindMany,
    findFirst: mocks.templateFindFirst,
  },
  job: { findUnique: mocks.jobFindUnique, findFirst: mocks.jobFindFirst },
  jobAssessment: {
    findFirst: mocks.jobAssessmentFindFirst,
    findMany: mocks.jobAssessmentFindMany,
    findUnique: mocks.jobAssessmentFindUnique,
    update: mocks.jobAssessmentUpdate,
    create: mocks.jobAssessmentCreate,
  },
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/server/session", () => ({
  getSessionCompanyId: mocks.getSessionCompanyId,
  getSessionOrThrow: mocks.getSessionOrThrow,
}));
vi.mock("@/lib/assessments/pricing", () => ({
  getAssessmentCost: vi.fn(() => ({ reserve: 1, complete: 1, total: 2 })),
}));

let catalogGET: typeof import("@/app/api/assessments/route")["GET"];
let assignPOST: typeof import("@/app/api/jobs/[id]/assessments/route")["POST"];
let assignedAssessmentsGET: typeof import("@/app/api/jobs/[id]/assessments/route")["GET"];
let jobsPOST: typeof import("@/app/api/jobs/route")["POST"];
let jobPUT: typeof import("@/app/api/jobs/[id]/route")["PUT"];
let dashboardTemplatesGET: typeof import("@/app/api/dashboard/assessments/templates/route")["GET"];
let dashboardTemplateGET: typeof import("@/app/api/dashboard/assessments/templates/[id]/route")["GET"];
let dashboardTemplatePUT: typeof import("@/app/api/dashboard/assessments/templates/[id]/route")["PUT"];
let dashboardTemplateDELETE: typeof import("@/app/api/dashboard/assessments/templates/[id]/route")["DELETE"];
let dashboardAssignPOST: typeof import("@/app/api/dashboard/jobs/[id]/assign-template/route")["POST"];

beforeAll(async () => {
  ({ GET: catalogGET } = await import("@/app/api/assessments/route"));
  ({ POST: assignPOST, GET: assignedAssessmentsGET } = await import(
    "@/app/api/jobs/[id]/assessments/route"
  ));
  ({ POST: jobsPOST } = await import("@/app/api/jobs/route"));
  ({ PUT: jobPUT } = await import("@/app/api/jobs/[id]/route"));
  ({ GET: dashboardTemplatesGET } = await import(
    "@/app/api/dashboard/assessments/templates/route"
  ));
  ({
    GET: dashboardTemplateGET,
    PUT: dashboardTemplatePUT,
    DELETE: dashboardTemplateDELETE,
  } = await import(
    "@/app/api/dashboard/assessments/templates/[id]/route"
  ));
  ({ POST: dashboardAssignPOST } = await import(
    "@/app/api/dashboard/jobs/[id]/assign-template/route"
  ));
});

function recruiterSession() {
  return { user: { id: "recruiter-a", role: "RECRUITER" } };
}

function catalogRequest() {
  return new Request("http://localhost/api/assessments");
}

function assignmentRequest(templateId = "template-a") {
  return new Request("http://localhost/api/jobs/job-a/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId }),
  });
}

function jobFormRequest(url: string, method: "POST" | "PUT", templateId: string) {
  const formData = new FormData();
  formData.set("title", "Platform Engineer");
  formData.set("description", "Build and operate the platform");
  formData.set("assessmentTemplateIds", JSON.stringify([templateId]));
  return new NextRequest(url, { method, body: formData });
}

describe("assessment template access rules", () => {
  it("allows an approved recruiter to see global and own-company templates", () => {
    expect(
      getAssessmentTemplateVisibilityWhere({ role: "RECRUITER", companyId: "company-a" })
    ).toEqual({ OR: [{ isGlobal: true }, { companyId: "company-a" }] });
  });

  it("fails closed for candidates and recruiters without an approved company", () => {
    expect(
      getAssessmentTemplateVisibilityWhere({ role: "CANDIDATE", companyId: null })
    ).toBeNull();
    expect(
      getAssessmentTemplateVisibilityWhere({ role: "RECRUITER", companyId: null })
    ).toBeNull();
  });

  it("lets recruiters manage only private templates owned by their company", () => {
    expect(
      getAssessmentTemplateManagementWhere({ role: "RECRUITER", companyId: "company-a" })
    ).toEqual({ companyId: "company-a", isGlobal: false });
    expect(getAssessmentTemplateManagementWhere({ role: "ADMIN", companyId: null })).toEqual({});
  });
});

describe("GET /api/assessments tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(recruiterSession());
    mocks.getSessionCompanyId.mockResolvedValue("company-a");
    mocks.getSessionOrThrow.mockResolvedValue(recruiterSession());
    mocks.templateFindMany.mockResolvedValue([]);
  });

  it("rejects unauthenticated and candidate requests without querying templates", async () => {
    mocks.getServerSession.mockResolvedValueOnce(null);
    const unauthenticated = await catalogGET(catalogRequest());
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get("cache-control")).toBe("no-store");

    mocks.getServerSession.mockResolvedValueOnce({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
    const candidate = await catalogGET(catalogRequest());
    expect(candidate.status).toBe(403);
    expect(mocks.templateFindMany).not.toHaveBeenCalled();
  });

  it("scopes recruiter listings to active global and own-company templates", async () => {
    const response = await catalogGET(catalogRequest());

    expect(response.status).toBe(200);
    expect(mocks.templateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [{ isGlobal: true }, { companyId: "company-a" }],
        },
      })
    );
  });

  it("rejects a recruiter without an approved company", async () => {
    mocks.getSessionCompanyId.mockResolvedValue(null);
    const response = await catalogGET(catalogRequest());
    expect(response.status).toBe(403);
    expect(mocks.templateFindMany).not.toHaveBeenCalled();
  });

  it("keeps explicit admin catalog access", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "admin-a", role: "ADMIN" } });
    const response = await catalogGET(catalogRequest());
    expect(response.status).toBe(200);
    expect(mocks.templateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    );
  });
});

describe("bulk job assessment assignment paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionOrThrow.mockResolvedValue(recruiterSession());
    mocks.getSessionCompanyId.mockResolvedValue("company-a");
    mocks.jobFindFirst.mockResolvedValue({ id: "job-a" });
    mocks.templateFindMany.mockResolvedValue([]);
  });

  it("rejects an invisible template while creating a job", async () => {
    const response = await jobsPOST(
      jobFormRequest("http://localhost/api/jobs", "POST", "template-b")
    );
    expect(response.status).toBe(400);
    expect(mocks.templateFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["template-b"] },
        OR: [{ isGlobal: true }, { companyId: "company-a" }],
      },
      select: { id: true, title: true },
    });
  });

  it("rejects an invisible template while editing a job through the API", async () => {
    const response = await jobPUT(
      jobFormRequest("http://localhost/api/jobs/job-a", "PUT", "template-b"),
      { params: { id: "job-a" } }
    );
    expect(response.status).toBe(400);
    expect(mocks.templateFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["template-b"] },
        OR: [{ isGlobal: true }, { companyId: "company-a" }],
      },
      select: { id: true },
    });
  });

  it("keeps the server-action assignment writer on the centralized rule", () => {
    const source = readFileSync(
      join(process.cwd(), "app/dashboard/jobs/[id]/edit/page.tsx"),
      "utf8"
    );
    expect(source).toContain("getAssessmentTemplateVisibilityWhere");
    expect(source).toContain("...templateVisibilityWhere");
    expect(source).toContain("visibleTemplates");
  });
});

describe("POST /api/jobs/[id]/assessments tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(recruiterSession());
    mocks.getSessionCompanyId.mockResolvedValue("company-a");
    mocks.jobFindUnique.mockResolvedValue({ id: "job-a", companyId: "company-a" });
    mocks.templateFindFirst.mockResolvedValue({ id: "template-a", isActive: true });
    mocks.jobAssessmentFindFirst.mockResolvedValue(null);
    mocks.jobAssessmentCreate.mockResolvedValue({ id: "assignment-a" });
  });

  it("does not reveal or assign another company's private template", async () => {
    mocks.templateFindFirst.mockResolvedValue(null);
    const response = await assignPOST(assignmentRequest("template-b"), {
      params: { id: "job-a" },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Assessment no encontrado" });
    expect(mocks.templateFindFirst).toHaveBeenCalledWith({
      where: {
        id: "template-b",
        OR: [{ isGlobal: true }, { companyId: "company-a" }],
      },
      select: { id: true, isActive: true },
    });
    expect(mocks.jobAssessmentCreate).not.toHaveBeenCalled();
  });

  it.each(["template-a", "global-template"])(
    "allows a visible own/global template (%s)",
    async (templateId) => {
      mocks.templateFindFirst.mockResolvedValue({ id: templateId, isActive: true });
      const response = await assignPOST(assignmentRequest(templateId), {
        params: { id: "job-a" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.jobAssessmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ templateId }) })
      );
    }
  );

  it("validates job ownership before template access", async () => {
    mocks.jobFindUnique.mockResolvedValue({ id: "job-b", companyId: "company-b" });
    const response = await assignPOST(assignmentRequest(), { params: { id: "job-b" } });
    expect(response.status).toBe(403);
    expect(mocks.templateFindFirst).not.toHaveBeenCalled();
  });

  it("preserves duplicate-assignment conflicts, including the concurrent race", async () => {
    mocks.jobAssessmentFindFirst.mockResolvedValueOnce({ id: "existing" });
    const existingResponse = await assignPOST(assignmentRequest(), {
      params: { id: "job-a" },
    });
    expect(existingResponse.status).toBe(409);

    mocks.jobAssessmentFindFirst.mockResolvedValueOnce(null);
    mocks.jobAssessmentCreate.mockRejectedValueOnce({ code: "P2002" });
    const raceResponse = await assignPOST(assignmentRequest(), {
      params: { id: "job-a" },
    });
    expect(raceResponse.status).toBe(409);
    expect(raceResponse.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps explicit admin assignment access", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "admin-a", role: "ADMIN" } });
    mocks.getSessionCompanyId.mockResolvedValue(null);
    mocks.jobFindUnique.mockResolvedValue({ id: "job-b", companyId: "company-b" });
    const response = await assignPOST(assignmentRequest(), { params: { id: "job-b" } });
    expect(response.status).toBe(200);
    expect(mocks.templateFindFirst).toHaveBeenCalledWith({
      where: { id: "template-a" },
      select: { id: true, isActive: true },
    });
  });
});

describe("dashboard assessment template routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(recruiterSession());
    mocks.getSessionCompanyId.mockResolvedValue("company-a");
    mocks.templateFindMany.mockResolvedValue([]);
    mocks.templateFindFirst.mockResolvedValue(null);
  });

  it("uses the approved company rather than an untrusted session company", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: "recruiter-a", role: "RECRUITER", companyId: "company-b" },
    });
    const response = await dashboardTemplatesGET(
      new NextRequest("http://localhost/api/dashboard/assessments/templates")
    );

    expect(response.status).toBe(200);
    expect(mocks.templateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [{ isGlobal: true }, { companyId: "company-a" }],
        },
      })
    );
  });

  it("returns the same not-found response for an invisible or missing template", async () => {
    const response = await dashboardTemplateGET(
      new NextRequest("http://localhost/api/dashboard/assessments/templates/template-b"),
      { params: { id: "template-b" } }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Template no encontrado" });
    expect(mocks.templateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "template-b",
          isActive: true,
          OR: [{ isGlobal: true }, { companyId: "company-a" }],
        },
      })
    );
  });

  it("rejects candidates and preserves explicit admin detail access", async () => {
    mocks.getServerSession.mockResolvedValueOnce({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
    const candidateResponse = await dashboardTemplateGET(
      new NextRequest("http://localhost/api/dashboard/assessments/templates/template-a"),
      { params: { id: "template-a" } }
    );
    expect(candidateResponse.status).toBe(403);
    expect(mocks.templateFindFirst).not.toHaveBeenCalled();

    mocks.getServerSession.mockResolvedValueOnce({ user: { id: "admin-a", role: "ADMIN" } });
    mocks.templateFindFirst.mockResolvedValueOnce({ id: "template-a", questions: [] });
    const adminResponse = await dashboardTemplateGET(
      new NextRequest("http://localhost/api/dashboard/assessments/templates/template-a"),
      { params: { id: "template-a" } }
    );
    expect(adminResponse.status).toBe(200);
    expect(mocks.templateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "template-a", isActive: true } })
    );
  });

  it("prevents a recruiter from updating or deleting another company's template", async () => {
    const updateResponse = await dashboardTemplatePUT(
      new NextRequest("http://localhost/api/dashboard/assessments/templates/template-b", {
        method: "PUT",
      }),
      { params: { id: "template-b" } }
    );
    expect(updateResponse.status).toBe(404);
    expect(mocks.templateFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: "template-b",
          isActive: true,
          companyId: "company-a",
          isGlobal: false,
        },
      })
    );

    const deleteResponse = await dashboardTemplateDELETE(
      new NextRequest("http://localhost/api/dashboard/assessments/templates/template-b", {
        method: "DELETE",
      }),
      { params: { id: "template-b" } }
    );
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.headers.get("cache-control")).toBe("no-store");
  });
});

describe("historical cross-tenant assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(recruiterSession());
    mocks.getSessionCompanyId.mockResolvedValue("company-a");
    mocks.jobFindUnique.mockResolvedValue({ id: "job-a", companyId: "company-a" });
    mocks.jobAssessmentFindMany.mockResolvedValue([]);
  });

  it("filters assigned-template reads through current visibility", async () => {
    const response = await assignedAssessmentsGET(
      new Request("http://localhost/api/jobs/job-a/assessments"),
      { params: { id: "job-a" } }
    );
    expect(response.status).toBe(200);
    expect(mocks.jobAssessmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jobId: "job-a",
          template: {
            OR: [{ isGlobal: true }, { companyId: "company-a" }],
          },
        },
      })
    );
  });
});

describe("POST /api/dashboard/jobs/[id]/assign-template tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(recruiterSession());
    mocks.getSessionCompanyId.mockResolvedValue("company-a");
    mocks.jobFindFirst.mockResolvedValue({
      id: "job-a",
      title: "Job A",
      companyId: "company-a",
    });
    mocks.templateFindFirst.mockResolvedValue({
      id: "template-a",
      title: "Template A",
      isActive: true,
    });
    mocks.jobAssessmentFindUnique.mockResolvedValue(null);
    mocks.jobAssessmentCreate.mockResolvedValue({ id: "assignment-a" });
  });

  it("applies the same visibility boundary before assigning", async () => {
    mocks.templateFindFirst.mockResolvedValue(null);
    const response = await dashboardAssignPOST(assignmentRequest("template-b"), {
      params: { id: "job-a" },
    });

    expect(response.status).toBe(404);
    expect(mocks.templateFindFirst).toHaveBeenCalledWith({
      where: {
        id: "template-b",
        OR: [{ isGlobal: true }, { companyId: "company-a" }],
      },
      select: { id: true, title: true, isActive: true },
    });
    expect(mocks.jobAssessmentCreate).not.toHaveBeenCalled();
  });

  it("returns a stable conflict for a concurrent duplicate assignment", async () => {
    mocks.jobAssessmentCreate.mockRejectedValueOnce({ code: "P2002" });
    const response = await dashboardAssignPOST(assignmentRequest(), {
      params: { id: "job-a" },
    });
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
