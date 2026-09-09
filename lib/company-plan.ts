import { BillingPlan } from "@prisma/client";
import { getPlan } from "@/config/plans";

export const DEFAULT_NEW_COMPANY_PLAN = BillingPlan.PRO;

/**
 * Keeps the commercial plan and assessment allowance aligned for new companies.
 * Purchased/subscription changes continue to be handled by Stripe webhooks.
 */
export function getDefaultNewCompanyPlanData(now = new Date()) {
  const plan = getPlan(DEFAULT_NEW_COMPANY_PLAN);
  const monthlyCredits = plan.assessments.monthlyCredits;

  return {
    billingPlan: DEFAULT_NEW_COMPANY_PLAN,
    assessmentPlan: DEFAULT_NEW_COMPANY_PLAN,
    assessmentCredits: monthlyCredits,
    assessmentPlanCreditsPerMonth: monthlyCredits,
    assessmentPlanStartedAt: now,
    lastCreditRefill: now,
  };
}
