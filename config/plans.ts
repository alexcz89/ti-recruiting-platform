// config/plans.ts

export type PlanId = "FREE" | "STARTER" | "PRO";

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
    maxActiveJobs: number | null;        // null = ilimitadas
    maxCandidatesPerMonth: number | null;
    maxRecruiters: number | null;
    maxClients: number | null;
    maxMultipleChoiceAssessments: number | null; // null = ilimitadas
    maxCodeAssessmentsPerMonth: number;         // siempre número
  };
};

export const PLANS: PlanConfig[] = [
  {
    id: "FREE",
    name: "Gratis",
    slug: "free",
    priceMonthly: 0,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Para probar la plataforma sin costo",
    highlight: false,
    features: [
      "1 vacante activa",
      "Hasta 10 candidatos por vacante",
      "3 evaluaciones de opción múltiple por vacante",
      "Publicación en la bolsa TI",
      "Sin evaluaciones de código",
    ],
    ctaLabel: "Crear cuenta gratis",
    limits: {
      maxActiveJobs: 1,
      maxCandidatesPerMonth: 10,
      maxRecruiters: 1,
      maxClients: 1,
      maxMultipleChoiceAssessments: 3,
      maxCodeAssessmentsPerMonth: 0,
    },
  },
  {
    id: "STARTER",
    name: "Starter",
    slug: "starter",
    priceMonthly: 499,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Para PyMEs que contratan talento TI",
    highlight: true,
    popularLabel: "Más popular",
    features: [
      "5 vacantes activas",
      "Candidatos ilimitados",
      "Evaluaciones de opción múltiple ilimitadas",
      "10 evaluaciones de código por mes",
      "ATS con pipeline de candidatos",
      "Soporte por email",
    ],
    ctaLabel: "Empezar con Starter",
    limits: {
      maxActiveJobs: 5,
      maxCandidatesPerMonth: null,
      maxRecruiters: 2,
      maxClients: 1,
      maxMultipleChoiceAssessments: null,
      maxCodeAssessmentsPerMonth: 10,
    },
  },
  {
    id: "PRO",
    name: "Pro",
    slug: "pro",
    priceMonthly: 1299,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Para equipos de reclutamiento en crecimiento",
    highlight: false,
    features: [
      "15 vacantes activas",
      "Candidatos ilimitados",
      "Evaluaciones de opción múltiple ilimitadas",
      "50 evaluaciones de código por mes",
      "Branding de empresa (logo)",
      "Soporte prioritario por WhatsApp",
    ],
    ctaLabel: "Empezar con Pro",
    limits: {
      maxActiveJobs: 15,
      maxCandidatesPerMonth: null,
      maxRecruiters: 5,
      maxClients: 5,
      maxMultipleChoiceAssessments: null,
      maxCodeAssessmentsPerMonth: 50,
    },
  },
];