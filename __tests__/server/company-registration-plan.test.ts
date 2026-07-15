import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingPlan } from "@prisma/client";

const companyMocks = vi.hoisted(() => ({
  upsert: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    company: companyMocks,
  },
}));

import { getOrCreateCompanyFromEmail } from "@/lib/company";

describe("company registration plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    companyMocks.upsert.mockResolvedValue({
      id: "company-1",
      name: "Acme",
      domain: "acme.com",
    });
  });

  it("assigns PRO and its credits only in the create branch", async () => {
    await getOrCreateCompanyFromEmail({
      email: "recruiter@acme.com",
      suggestedName: "Acme",
    });

    expect(companyMocks.upsert).toHaveBeenCalledOnce();
    const call = companyMocks.upsert.mock.calls[0][0];

    expect(call.create).toEqual(
      expect.objectContaining({
        billingPlan: BillingPlan.PRO,
        assessmentPlan: BillingPlan.PRO,
        assessmentCredits: 750,
        assessmentPlanCreditsPerMonth: 750,
      })
    );
    expect(call.update).not.toHaveProperty("billingPlan");
    expect(call.update).not.toHaveProperty("assessmentCredits");
  });
});
