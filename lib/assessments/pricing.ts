// lib/assessments/pricing.ts
import type { AssessmentType, AssessmentDifficulty } from "@prisma/client";

/**
 * Estructura de precios para evaluaciones
 * - reserve: Créditos que se reservan al enviar la invitación
 * - complete: Créditos adicionales que se cobran al completar
 * - total: Costo total si se completa
 */
export interface AssessmentPricing {
  reserve: number;
  complete: number;
  total: number;
}

export const ASSESSMENT_PRICING: Record<
  AssessmentType,
  Record<AssessmentDifficulty, AssessmentPricing>
> = {
  MCQ: {
    JUNIOR: { reserve: 0.5, complete: 0.5, total: 1.0 },
    MID:    { reserve: 0.5, complete: 0.5, total: 1.0 },
    SENIOR: { reserve: 0.5, complete: 0.5, total: 1.0 },
  },
  CODING: {
    JUNIOR: { reserve: 0.5, complete: 2.0, total: 2.5 },
    MID:    { reserve: 0.5, complete: 2.5, total: 3.0 },
    SENIOR: { reserve: 0.5, complete: 3.5, total: 4.0 },
  },
  MIXED: {
    JUNIOR: { reserve: 0.5, complete: 2.5, total: 3.0 },
    MID:    { reserve: 0.5, complete: 3.0, total: 3.5 },
    SENIOR: { reserve: 0.5, complete: 4.0, total: 4.5 },
  },
} as const;

export function getAssessmentCost(
  type: AssessmentType,
  difficulty: AssessmentDifficulty
): AssessmentPricing {
  return ASSESSMENT_PRICING[type][difficulty];
}

export function calculateTotalCost(
  assessments: Array<{ type: AssessmentType; difficulty: AssessmentDifficulty }>
): number {
  return assessments.reduce((total, assessment) => {
    const pricing = getAssessmentCost(assessment.type, assessment.difficulty);
    return total + pricing.total;
  }, 0);
}

export function formatCredits(credits: number): string {
  return Number.isInteger(credits) ? String(credits) : credits.toFixed(1);
}

export function getCurrentBillingCycle(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

/**
 * Paquetes de créditos prepagados — sincronizados con Stripe (MXN)
 */
export const CREDIT_PACKAGES = [
  {
    id:             "basic",
    name:           "Básico",
    credits:        10,
    price:          149,       // MXN
    pricePerCredit: 14.9,
    recommended:    false,
    stripePriceId:  "price_1T70lC1xbuY0ledy16xKrkqx",
  },
  {
    id:             "popular",
    name:           "Popular",
    credits:        25,
    price:          299,       // MXN
    pricePerCredit: 11.96,
    recommended:    true,
    stripePriceId:  "price_1T70lQ1xbuY0ledyNG8842LL",
  },
  {
    id:             "pro",
    name:           "Pro",
    credits:        50,
    price:          499,       // MXN
    pricePerCredit: 9.98,
    recommended:    false,
    stripePriceId:  "price_1T70lx1xbuY0ledy6UEr9igh",
  },
  {
    id:             "enterprise",
    name:           "Enterprise",
    credits:        100,
    price:          799,       // MXN
    pricePerCredit: 7.99,
    recommended:    false,
    stripePriceId:  "price_1T70o51xbuY0ledymTNKMxWf",
  },
] as const;

export type CreditPackage = typeof CREDIT_PACKAGES[number];

export const CREDIT_ADDON_PRICE = 14.9; // MXN por crédito individual

export interface CreditUsageStats {
  available: number;
  reserved: number;
  used: number;
  total: number;
  percentUsed: number;
}

export function calculateCreditStats(company: {
  assessmentCredits: number;
  assessmentCreditsReserved: number;
  assessmentCreditsUsed: number;
}): CreditUsageStats {
  const available = company.assessmentCredits;
  const reserved  = company.assessmentCreditsReserved;
  const used      = company.assessmentCreditsUsed;
  const total     = available + reserved + used;
  return {
    available,
    reserved,
    used,
    total,
    percentUsed: total > 0 ? (used / total) * 100 : 0,
  };
}

export function needsMoreCredits(
  available: number,
  reserved: number,
  threshold: number = 5
): boolean {
  return (available - reserved) < threshold;
}

export function estimateCreditsNeeded(
  candidateCount: number,
  assessmentType: AssessmentType,
  difficulty: AssessmentDifficulty
): number {
  const pricing = getAssessmentCost(assessmentType, difficulty);
  return candidateCount * pricing.total;
}