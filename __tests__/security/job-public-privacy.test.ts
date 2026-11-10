import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    job: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
  },
}));

// Permite inspeccionar la imagen OG sin renderizar un PNG.
vi.mock("next/og", () => ({
  ImageResponse: function MockImageResponse(element: unknown) {
    return new Response(JSON.stringify(element), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
}));

import { GET as getJobs } from "@/app/api/jobs/route";
import { GET as getJobImage } from "@/app/api/og/job/route";
import {
  generateJobKeywords,
  generateJobMetaDescription,
} from "@/lib/seo/keywords";

const secretSalaryMin = 98765431;
const secretSalaryMax = 98765432;
const secretCompany = "EMPRESA_ULTRA_CONFIDENCIAL";

const job = {
  id: "privacy-test-job",
  slug: "privacy-test-job",
  title: "Desarrollador de software",
  location: "Monterrey",
  locationType: "ONSITE",
  country: "MX",
  city: "Monterrey",
  admin1: "Nuevo Leon",
  remote: false,
  employmentType: "FULL_TIME",
  description: "Desarrollo de aplicaciones",
  descriptionHtml: null,
  skills: ["TypeScript"],
  salaryMin: secretSalaryMin,
  salaryMax: secretSalaryMax,
  showSalary: false,
  currency: "MXN",
  companyConfidential: true,
  company: {
    name: secretCompany,
    logoUrl: "https://example.com/secret-logo.png",
  },
  createdAt: new Date("2026-11-01T12:00:00Z"),
  updatedAt: new Date("2026-11-01T12:00:00Z"),
};

describe("Public job privacy regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not expose hidden salary or employer in public job detail", async () => {
    mocks.findFirst.mockResolvedValue(job);

    const response = await getJobs(
      new NextRequest("http://localhost:3000/api/jobs?id=privacy-test-job")
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.job.salaryMin).toBeNull();
    expect(body.job.salaryMax).toBeNull();
    expect(body.job.company).toBe("Confidencial");

    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain(secretCompany);
    expect(serialized).not.toContain(String(secretSalaryMin));
    expect(serialized).not.toContain(String(secretSalaryMax));
    expect(serialized).not.toContain("secret-logo.png");
  });

  it("does not expose hidden salary or employer in public job list", async () => {
    mocks.findMany.mockResolvedValue([job]);

    const response = await getJobs(
      new NextRequest("http://localhost:3000/api/jobs?limit=10")
    );

    expect(response.status).toBe(200);

    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toContain(secretCompany);
    expect(serialized).not.toContain(String(secretSalaryMin));
    expect(serialized).not.toContain(String(secretSalaryMax));
    expect(serialized).not.toContain("secret-logo.png");
  });

  it("preserves explicitly public salaries and employer names", async () => {
    mocks.findFirst.mockResolvedValue({
      ...job,
      showSalary: true,
      companyConfidential: false,
    });

    const response = await getJobs(
      new NextRequest("http://localhost:3000/api/jobs?id=privacy-test-job")
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.job.salaryMin).toBe(secretSalaryMin);
    expect(body.job.salaryMax).toBe(secretSalaryMax);
    expect(body.job.company).toBe(secretCompany);
  });

  it("does not include confidential information in OG content", async () => {
    mocks.findFirst.mockResolvedValue(job);

    const response = await getJobImage(
      new Request("http://localhost:3000/api/og/job?jobId=privacy-test-job")
    );

    expect(response.status).toBe(200);

    const serialized = await response.text();

    expect(serialized).not.toContain(secretCompany);
    expect(serialized).not.toContain(String(secretSalaryMin));
    expect(serialized).not.toContain(String(secretSalaryMax));
  });

  it("restricts OG images to OPEN jobs", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const response = await getJobImage(
      new Request("http://localhost:3000/api/og/job?jobId=privacy-test-job")
    );

    expect(response.status).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "privacy-test-job",
          status: "OPEN",
        },
      })
    );
  });

  it("does not place confidential values in SEO metadata", () => {
    const keywords = generateJobKeywords(job);
    const description = generateJobMetaDescription(job);

    expect(keywords).not.toContain(String(secretSalaryMin));
    expect(keywords).not.toContain(String(secretSalaryMax));
    expect(description).not.toContain(secretCompany);
    expect(description).not.toContain(String(secretSalaryMin));
  });
});