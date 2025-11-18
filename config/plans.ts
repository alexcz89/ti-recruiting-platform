// config/plans.ts

export type PlanId = "FREE" | "PRO" | "BUSINESS" | "AGENCY";

export type PlanConfig = {
  id: PlanId;
  name: string;
  slug: string;
  priceMonthly: number;
  currency: "MXN" | "USD";
  periodLabel: string; // ej. "/mes"
  tagline: string;
  highlight?: boolean;
  popularLabel?: string;
  features: string[];
  ctaLabel: string;
  /** Límites que usaremos después en el backend */
  limits: {
    maxActiveJobs: number | null; // null = ilimitadas
    maxCandidatesPerMonth: number | null;
    maxRecruiters: number | null;
    maxClients: number | null;
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
    tagline: "Perfecto para probar la plataforma",
    highlight: false,
    features: [
      "1 vacante activa",
      "Hasta 20 candidatos al mes",
      "ATS básico (pipeline simple)",
      "Publicación en la bolsa de TI",
      "Correo semanal con candidatos nuevos",
    ],
    ctaLabel: "Crear cuenta gratis",
    limits: {
      maxActiveJobs: 1,
      maxCandidatesPerMonth: 20,
      maxRecruiters: 1,
      maxClients: 1,
    },
  },
  {
    id: "PRO",
    name: "Pro",
    slug: "pro",
    priceMonthly: 999,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Para empresas que contratan de forma constante",
    highlight: true,
    popularLabel: "Más popular",
    features: [
      "Hasta 5 vacantes activas",
      "Candidatos ilimitados por vacante",
      "ATS completo con etapas personalizables",
      "Vacantes destacadas en resultados de búsqueda",
      "Acceso a base de talento TI (búsqueda avanzada)",
      "Soporte por WhatsApp / correo",
    ],
    ctaLabel: "Empezar con Pro",
    limits: {
      maxActiveJobs: 5,
      maxCandidatesPerMonth: null, // ilimitado
      maxRecruiters: 3,
      maxClients: 3,
    },
  },
  {
    id: "BUSINESS",
    name: "Business",
    slug: "business",
    priceMonthly: 2499,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Para equipos de reclutamiento en crecimiento",
    highlight: false,
    features: [
      "Hasta 15 vacantes activas",
      "Multiusuario (hasta 5 reclutadores)",
      "Branding de empresa (logo y colores)",
      "Matching con IA para candidatos",
      "Reportes de métricas de reclutamiento",
      "Soporte prioritario",
    ],
    ctaLabel: "Hablar con ventas",
    limits: {
      maxActiveJobs: 15,
      maxCandidatesPerMonth: null,
      maxRecruiters: 5,
      maxClients: 10,
    },
  },
  {
    id: "AGENCY",
    name: "Agency",
    slug: "agency",
    priceMonthly: 4999,
    currency: "MXN",
    periodLabel: "/mes",
    tagline: "Hecho para agencias y headhunters",
    highlight: false,
    features: [
      "Vacantes ilimitadas",
      "Multi-cliente (carteras por empresa)",
      "Exportación de datos (CSV/Excel)",
      "Portal de clientes con acceso a candidatos",
      "API / Webhooks (futuro)",
      "Onboarding acompañado",
    ],
    ctaLabel: "Agendar demo",
    limits: {
      maxActiveJobs: null,
      maxCandidatesPerMonth: null,
      maxRecruiters: null,
      maxClients: 50,
    },
  },
];
