// lib/stripe.ts
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY no está definida");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

// ── Price IDs ──────────────────────────────────────────────
export const STRIPE_PRICES = {
  // Suscripciones
  STARTER: "price_1T70fj1xbuY0ledyXNl3x7Nc",
  PRO:     "price_1T70gQ1xbuY0ledyv9Tv3h2G",

  // Créditos one-time (1 coding test = 5 créditos internos)
  CREDITS_10_TESTS:  "price_1T70lC1xbuY0ledy16xKrkqx",  // $499 MXN — 10 coding tests (50 créditos)
  CREDITS_25_TESTS:  "price_1T70lQ1xbuY0ledyNG8842LL",  // $999 MXN — 25 coding tests (125 créditos)
  CREDITS_50_TESTS:  "price_1T70lx1xbuY0ledy6UEr9igh",  // $1,799 MXN — 50 coding tests (250 créditos)
  CREDITS_100_TESTS: "price_1T70o51xbuY0ledymTNKMxWf",  // $2,999 MXN — 100 coding tests (500 créditos)
} as const;

export const CREDIT_PACKAGES = [
  { priceId: STRIPE_PRICES.CREDITS_10_TESTS,  credits: 50,  codingTests: 10,  price: 499,  label: "Básico"     },
  { priceId: STRIPE_PRICES.CREDITS_25_TESTS,  credits: 125, codingTests: 25,  price: 999,  label: "Popular"    },
  { priceId: STRIPE_PRICES.CREDITS_50_TESTS,  credits: 250, codingTests: 50,  price: 1799, label: "Pro"        },
  { priceId: STRIPE_PRICES.CREDITS_100_TESTS, credits: 500, codingTests: 100, price: 2999, label: "Enterprise" },
] as const;

export const PLAN_PRICES: Record<string, string> = {
  STARTER: STRIPE_PRICES.STARTER,
  PRO:     STRIPE_PRICES.PRO,
};