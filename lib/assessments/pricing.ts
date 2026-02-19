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

/**
 * Tabla de precios por tipo de evaluación y nivel de dificultad
 * 
 * MCQ (Opción Múltiple):
 * - Sin costo de infraestructura
 * - Auto-evaluable
 * - Costo fijo de 1 crédito
 * 
 * CODING (Desafíos de Código):
 * - Costo de ejecución de código (Judge0/Piston)
 * - Requiere más recursos
 * - Costo variable según dificultad: 2.5-4.0 créditos
 * 
 * MIXED (Mixto):
 * - Combina ambos tipos
 * - Costo intermedio: 3.0-4.5 créditos
 */
export const ASSESSMENT_PRICING: Record<
  AssessmentType,
  Record<AssessmentDifficulty, AssessmentPricing>
> = {
  MCQ: {
    JUNIOR: { reserve: 0.5, complete: 0.5, total: 1.0 },
    MID: { reserve: 0.5, complete: 0.5, total: 1.0 },
    SENIOR: { reserve: 0.5, complete: 0.5, total: 1.0 },
  },
  CODING: {
    JUNIOR: { reserve: 0.5, complete: 2.0, total: 2.5 },
    MID: { reserve: 0.5, complete: 2.5, total: 3.0 },
    SENIOR: { reserve: 0.5, complete: 3.5, total: 4.0 },
  },
  MIXED: {
    JUNIOR: { reserve: 0.5, complete: 2.5, total: 3.0 },
    MID: { reserve: 0.5, complete: 3.0, total: 3.5 },
    SENIOR: { reserve: 0.5, complete: 4.0, total: 4.5 },
  },
} as const;

/**
 * Obtener el costo de una evaluación según su tipo y dificultad
 */
export function getAssessmentCost(
  type: AssessmentType,
  difficulty: AssessmentDifficulty
): AssessmentPricing {
  return ASSESSMENT_PRICING[type][difficulty];
}

/**
 * Calcular el costo total de múltiples evaluaciones
 */
export function calculateTotalCost(
  assessments: Array<{ type: AssessmentType; difficulty: AssessmentDifficulty }>
): number {
  return assessments.reduce((total, assessment) => {
    const pricing = getAssessmentCost(assessment.type, assessment.difficulty);
    return total + pricing.total;
  }, 0);
}

/**
 * Formatear créditos con 1 decimal (ej: 3.5)
 */
export function formatCredits(credits: number): string {
  return credits.toFixed(1);
}

/**
 * Obtener el ciclo de facturación actual (YYYYMM)
 * Usado para agrupar cargos por mes
 */
export function getCurrentBillingCycle(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

/**
 * Paquetes de créditos prepagados
 */
export const CREDIT_PACKAGES = [
  {
    id: "basic",
    name: "Básico",
    credits: 20,
    price: 79,
    pricePerCredit: 3.95,
    recommended: false,
  },
  {
    id: "pro",
    name: "Profesional",
    credits: 75,
    price: 249,
    pricePerCredit: 3.32,
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Empresa",
    credits: 250,
    price: 699,
    pricePerCredit: 2.8,
    recommended: false,
  },
] as const;

/**
 * Precio de créditos adicionales (pay-as-you-go)
 */
export const CREDIT_ADDON_PRICE = 4.99;

/**
 * Obtener estadísticas de uso de créditos
 */
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
  const reserved = company.assessmentCreditsReserved;
  const used = company.assessmentCreditsUsed;
  const total = available + reserved + used;
  const percentUsed = total > 0 ? (used / total) * 100 : 0;

  return {
    available,
    reserved,
    used,
    total,
    percentUsed,
  };
}

/**
 * Verificar si una empresa necesita más créditos
 */
export function needsMoreCredits(
  available: number,
  reserved: number,
  threshold: number = 5
): boolean {
  const effectiveBalance = available - reserved;
  return effectiveBalance < threshold;
}

/**
 * Estimar cuántos créditos se necesitan para X candidatos
 */
export function estimateCreditsNeeded(
  candidateCount: number,
  assessmentType: AssessmentType,
  difficulty: AssessmentDifficulty
): number {
  const pricing = getAssessmentCost(assessmentType, difficulty);
  return candidateCount * pricing.total;
}