import { describe, expect, it } from "vitest";
import { BillingPlan } from "@prisma/client";
import { getPlan } from "@/config/plans";
import {
  DEFAULT_NEW_COMPANY_PLAN,
  getDefaultNewCompanyPlanData,
} from "@/lib/company-plan";

describe("default plan for new companies", () => {
  it("assigns PRO with its complete monthly assessment allowance", () => {
    const startedAt = new Date("2026-07-15T12:00:00.000Z");
    const proPlan = getPlan("PRO");

    expect(DEFAULT_NEW_COMPANY_PLAN).toBe(BillingPlan.PRO);
    expect(getDefaultNewCompanyPlanData(startedAt)).toEqual({
      billingPlan: BillingPlan.PRO,
      assessmentPlan: BillingPlan.PRO,
      assessmentCredits: proPlan.assessments.monthlyCredits,
      assessmentPlanCreditsPerMonth: proPlan.assessments.monthlyCredits,
      assessmentPlanStartedAt: startedAt,
      lastCreditRefill: startedAt,
    });
  });

  it("does not mutate the configured PRO allowance", () => {
    const first = getDefaultNewCompanyPlanData();
    const second = getDefaultNewCompanyPlanData();

    expect(first.assessmentCredits).toBe(750);
    expect(second.assessmentCredits).toBe(750);
    expect(getPlan("PRO").assessments.monthlyCredits).toBe(750);
  });
});
