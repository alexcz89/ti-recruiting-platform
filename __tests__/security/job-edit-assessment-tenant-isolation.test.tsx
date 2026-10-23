import * as React from "react";
import type { ReactElement, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getSessionCompanyId: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  revalidatePath: vi.fn(),
  getSkillsFromDB: vi.fn(),
  getCertificationsFromDB: vi.fn(),
  geocodeCityToPoint: vi.fn(),
  jobFindFirst: vi.fn(),
  jobFindUnique: vi.fn(),
  companyFindUnique: vi.fn(),
  companyFindFirst: vi.fn(),
  companyCreate: vi.fn(),
  templateFindMany: vi.fn(),
  transaction: vi.fn(),
  JobWizard: function JobWizard() {
    return null;
  },
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/server/session", () => ({
  getSessionCompanyId: mocks.getSessionCompanyId,
}));
vi.mock("@/lib/server/skills", () => ({
  getSkillsFromDB: mocks.getSkillsFromDB,
  getCertificationsFromDB: mocks.getCertificationsFromDB,
}));
vi.mock("@/lib/geo", () => ({ geocodeCityToPoint: mocks.geocodeCityToPoint }));
vi.mock("@/app/dashboard/jobs/new/JobWizard", () => ({
  default: mocks.JobWizard,
}));
vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    job: {
      findFirst: mocks.jobFindFirst,
      findUnique: mocks.jobFindUnique,
    },
    company: {
      findUnique: mocks.companyFindUnique,
      findFirst: mocks.companyFindFirst,
      create: mocks.companyCreate,
    },
    assessmentTemplate: { findMany: mocks.templateFindMany },
    $transaction: mocks.transaction,
  },
}));

type UpdateAction = (
  formData: FormData
) => Promise<{ error: string } | { ok: true; redirectTo: string }>;

let EditJobPage: typeof import("@/app/dashboard/jobs/[id]/edit/page")["default"];

beforeAll(async () => {
  vi.stubGlobal("React", React);
  ({ default: EditJobPage } = await import("@/app/dashboard/jobs/[id]/edit/page"));
});

function findJobWizard(node: ReactNode): ReactElement<{ onSubmit: UpdateAction }> | null {
  if (!React.isValidElement(node)) return null;
  if (node.type === mocks.JobWizard) {
    return node as ReactElement<{ onSubmit: UpdateAction }>;
  }

  for (const child of React.Children.toArray(node.props.children)) {
    const match = findJobWizard(child);
    if (match) return match;
  }

  return null;
}

describe("job editing server action assessment isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "recruiter-a", role: "RECRUITER" },
    });
    mocks.getSessionCompanyId.mockResolvedValue("company-a");
    mocks.getSkillsFromDB.mockResolvedValue([]);
    mocks.getCertificationsFromDB.mockResolvedValue([]);
    mocks.companyFindUnique.mockResolvedValue({ id: "company-a", name: "Company A" });
    mocks.jobFindFirst
      .mockResolvedValueOnce({
        id: "job-a",
        title: "Platform Engineer",
        description: "Build and operate the platform",
        companyConfidential: false,
        company: { id: "company-a" },
        assessments: [],
        benefitsJson: {},
        salaryMin: null,
        salaryMax: null,
        currency: "MXN",
        schedule: null,
        showBenefits: false,
        employmentType: "FULL_TIME",
        locationType: "REMOTE",
        location: "Remoto",
        city: null,
        remote: true,
        skills: [],
      })
      .mockResolvedValueOnce({ id: "job-a" });
    mocks.templateFindMany.mockResolvedValue([]);
  });

  it("rejects a cross-tenant template before mutating the job", async () => {
    const page = await EditJobPage({ params: { id: "job-a" } });
    const wizard = findJobWizard(page);
    expect(wizard).not.toBeNull();

    const formData = new FormData();
    formData.set("jobId", "job-a");
    formData.set("assessmentTemplateIds", JSON.stringify(["template-b"]));

    const result = await wizard!.props.onSubmit(formData);

    expect(result).toEqual({
      error: "Uno o más assessment templates no existen.",
    });
    expect(mocks.jobFindFirst).toHaveBeenLastCalledWith({
      where: { id: "job-a", companyId: "company-a" },
      select: { id: true },
    });
    expect(mocks.templateFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["template-b"] },
        OR: [{ isGlobal: true }, { companyId: "company-a" }],
      },
      select: { id: true },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
