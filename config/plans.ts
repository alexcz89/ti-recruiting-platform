// config/plans.ts
//
// ── Modelo de créditos para assessments ──────────────────────────────────────
//
// Cada plan incluye créditos mensuales que se renuevan el primer día del ciclo.
// Los créditos incluidos NO se acumulan al siguiente mes (use-it-or-lose-it).
// Los créditos comprados en packs SÍ persisten hasta agotarse.
//
// Costos fijos:
//   MCQ assessment    → 1 crédito   (bajo costo de cómputo, sin Judge0)
//   Coding assessment → 5 créditos  (ejecución en Judge0 + sandbox overhead)
//
// Motivación CEO/CTO:
//   - FREE:     cuota mínima de degustación → conversión obvia a STARTER
//   - STARTER:  cuota cómoda para una PyME contratando 1-3 posiciones/mes
//   - PRO:      cuota amplia para equipos de reclutamiento activos
//   - BUSINESS: cuota grande para agencias / empresas con múltiples clientes
//   - Packs:    revenue adicional no lineal, créditos no-expirables = cash up front
//               y NRR > 100% conforme crece el volumen de contratación
// ─────────────────────────────────────────────────────────────────────────────

export type PlanId = "FREE" | "STARTER" | "PRO" | "BUSINESS";

// ── Credit cost constants ────────────────────────────────────────────────────
/** Créditos que consume un assessment de opción múltiple */
export const MCQ_CREDIT_COST = 1;

/** Créditos que consume un assessment de código (Judge0 execution) */
export const CODING_CREDIT_COST = 5;

// ── Credit pack add-ons ──────────────────────────────────────────────────────
// Los créditos de pack NO expiran mensualmente: se descuentan después de agotar
// los créditos incluidos en la suscripción.
// Los planes superiores obtienen mejor precio por crédito → incentivo de upgrade.

export type CreditPack = {
  id: string;
  /** Créditos que añade al balance del reclutador */
  credits: number;
  label: string;
  /** Precio en MXN según el plan activo de la empresa */
  priceByPlan: Record<PlanId, number>;
  /** Precio sugerido (sin descuento de plan) — sirve para mostrar ahorro */
  basePriceMxn: number;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack_50",
    credits: 50,
    label: "Pack Básico — 50 créditos",
    basePriceMxn: 299,
    priceByPlan: {
      FREE:     299, // $5.98/créd — sin descuento, el dolor ayuda a convertir
      STARTER:  249, // $4.98/créd
      PRO:      199, // $3.98/créd — 33% más barato que en FREE
      BUSINESS: 149, // $2.98/créd — 50% más barato que en FREE
    },
  },
  {
    id: "pack_200",
    credits: 200,
    label: "Pack Pro — 200 créditos",
    basePriceMxn: 999,
    priceByPlan: {
      FREE:     999, // $4.99/créd
      STARTER:  849, // $4.25/créd — ahorro vs pack pequeño en FREE
      PRO:      699, // $3.50/créd
      BUSINESS: 549, // $2.75/créd
    },
  },
  {
    id: "pack_600",
    credits: 600,
    label: "Pack Enterprise — 600 créditos",
    basePriceMxn: 2699,
    priceByPlan: {
      FREE:     2699, // $4.50/créd — libre solo si de verdad lo necesita
      STARTER:  2299, // $3.83/créd
      PRO:      1799, // $3.00/créd — 33% de descuento vs FREE
      BUSINESS: 1399, // $2.33/créd — mejor deal para volumen alto
    },
  },
];

// ── Plan config type ─────────────────────────────────────────────────────────

export type PlanConfig = {
  id: PlanId;
  name: string;
  slug: string;
  priceMonthly: number;
  currency: "MXN" | "USD";
  periodLabel: string;
  tagline: string;
  highlight?: boolean;
  popularLabel?: string;
  features: string[];
  ctaLabel: string;
  limits: {
    maxActiveJobs: number | null;          // null = ilimitado
    maxCandidatesPerMonth: number | null;  // null = ilimitado
    maxRecruiters: number | null;          // null = ilimitado
    maxClients: number | null;             // null = ilimitado (modo agencia)
  };
  /**
   * Cuantos candidatos por vacante reciben AI Match score.
   * null = sin limite (Pro y Business)
   * 0 = no disponible (Free)
   */
  aiMatchLimit: number | null;
  assessments: {
    /**
     * Créditos incluidos en el plan cada mes (renuevan el 1ro del ciclo).
     * Estos NO se acumulan: los no usados se pierden al renovar.
     */
    monthlyCredits: number;
    /**
     * ¿Puede el reclutador usar assessments de código?
     * FREE = false (sin Judge0, reduce costos en capa gratuita)
     */
    codingEnabled: boolean;
    /**
     * ¿Puede comprar packs de créditos adicionales?
     */
    packsAvailable: boolean;
    /**
     * % de descuento sobre el precio base de cada pack.
     * Se aplica al seleccionar el pack correspondiente al plan activo.
     */
    packDiscountPct: number;
  };
};

// ── Plans ────────────────────────────────────────────────────────────────────

export const PLANS: PlanConfig[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // FREE — Degustación
  // Objetivo: que el reclutador pruebe la plataforma, vea el valor, y convierta.
  // Restricciones deliberadas: sin coding, sin packs baratos, 1 vacante.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "FREE",
    name: "Gratis",
    slug: "free",
    priceMonthly: 0,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Publica tu primera vacante sin costo",
    highlight: false,
    features: [
      "1 vacante activa",
      "Hasta 10 candidatos por vacante",
      "20 tests de opción múltiple al mes",
      "Portal público de empleo TI",
      "Pipeline básico de candidatos",
      "AI Match no incluido",
    ],
    ctaLabel: "Crear cuenta gratis",
    limits: {
      maxActiveJobs:          1,
      maxCandidatesPerMonth:  10,
      maxRecruiters:          1,
      maxClients:             1,
    },
    aiMatchLimit: 0,
    assessments: {
      monthlyCredits:  20,  // ~20 MCQ — suficiente para evaluar 1 posición
      codingEnabled:   false,
      packsAvailable:  true, // sí puede comprar, pero al precio más alto → dolor
      packDiscountPct: 0,
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // STARTER — PyMEs contratando 1-5 posiciones al mes
  // 150 créditos/mes = ~150 MCQ o ~30 evaluaciones de código o mezcla.
  // Ejemplo real: 3 vacantes × 10 candidatos × 1 MCQ = 30 créditos usados.
  // Un filtro técnico básico con 5 coding exams = 25 créditos adicionales.
  // Total típico: ~55 créditos → cómodo dentro del plan.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "STARTER",
    name: "Starter",
    slug: "starter",
    priceMonthly: 999,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "5 vacantes + ATS + evaluaciones técnicas",
    highlight: true,
    popularLabel: "Más popular",
    features: [
      "5 vacantes activas",
      "Candidatos ilimitados",
      "ATS completo con pipeline Kanban",
      "150 evaluaciones al mes (tests de opción múltiple + código)",
      "AI Match — top 10 candidatos rankeados por vacante",
      "Soporte por email",
    ],
    ctaLabel: "Empezar con Starter",
    limits: {
      maxActiveJobs:          5,
      maxCandidatesPerMonth:  null,
      maxRecruiters:          2,
      maxClients:             1,
    },
    aiMatchLimit: 10,
    assessments: {
      monthlyCredits:  150, // ~150 MCQ o ~30 coding o mix
      codingEnabled:   true,
      packsAvailable:  true,
      packDiscountPct: 17,  // ~17% vs precio FREE (pack_50: $299→$249)
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PRO — Equipos de reclutamiento en crecimiento
  // 500 créditos/mes = ~500 MCQ o ~100 coding o mezcla.
  // Ejemplo real: 8 vacantes × 15 candidatos × 1 MCQ + 8 × 5 coding
  //             = 120 + 200 = 320 créditos → margen cómodo, upsell de packs
  //               si el equipo empieza a escalar sin cambiar de plan.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "PRO",
    name: "Pro",
    slug: "pro",
    priceMonthly: 2499,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Para equipos TI en crecimiento",
    highlight: false,
    features: [
      "15 vacantes activas",
      "Candidatos ilimitados",
      "ATS completo + analytics de reclutamiento",
      "500 evaluaciones al mes (tests de opción múltiple + código)",
      "AI Match ilimitado — todos tus candidatos rankeados",
      "Soporte prioritario por WhatsApp",
    ],
    ctaLabel: "Empezar con Pro",
    limits: {
      maxActiveJobs:          15,
      maxCandidatesPerMonth:  null,
      maxRecruiters:          5,
      maxClients:             5,
    },
    aiMatchLimit: null,
    assessments: {
      monthlyCredits:  500, // ~500 MCQ o ~100 coding o mix
      codingEnabled:   true,
      packsAvailable:  true,
      packDiscountPct: 33,  // pack_50: $299→$199
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BUSINESS — Agencias de reclutamiento TI y empresas enterprise
  // 2,000 créditos/mes = ~2,000 MCQ o ~400 coding o mezcla.
  // Vacantes y candidatos ilimitados; hasta 10 clientes (modelo agencia).
  // Packs con el mayor descuento → NRR > 100% conforme crece el volumen.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "BUSINESS",
    name: "Business",
    slug: "business",
    priceMonthly: 4999,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Para agencias y equipos enterprise",
    highlight: false,
    features: [
      "Vacantes ilimitadas",
      "Candidatos ilimitados",
      "ATS enterprise + analytics avanzados",
      "2,000 evaluaciones técnicas al mes",
      "Hasta 10 clientes (modo agencia multi-empresa)",
      "15 reclutadores incluidos",
      "AI Match ilimitado + explicacion detallada del match",
      "Cuenta dedicada — SLA garantizado por WhatsApp",
    ],
    ctaLabel: "Hablar con ventas",
    limits: {
      maxActiveJobs:          null, // ilimitado
      maxCandidatesPerMonth:  null,
      maxRecruiters:          15,
      maxClients:             10,
    },
    aiMatchLimit: null,
    assessments: {
      monthlyCredits:  2000, // ~2,000 MCQ o ~400 coding o mix
      codingEnabled:   true,
      packsAvailable:  true,
      packDiscountPct: 50,  // pack_50: $299→$149
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve el PlanConfig dado un PlanId. Siempre retorna al menos FREE. */
export function getPlan(id: PlanId | string | undefined | null): PlanConfig {
  return (
    PLANS.find((p) => p.id === id) ??
    PLANS.find((p) => p.id === "FREE")!
  );
}

/**
 * Precio de un pack de créditos para el plan activo de la empresa.
 * Útil en componentes de billing y en la API de creación de checkout.
 */
export function packPrice(pack: CreditPack, planId: PlanId): number {
  return pack.priceByPlan[planId] ?? pack.basePriceMxn;
}
