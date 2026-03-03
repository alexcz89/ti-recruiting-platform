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

  // Créditos one-time
  CREDITS_10:  "price_1T70lC1xbuY0ledy16xKrkqx",  // $149 MXN — 10 créditos
  CREDITS_25:  "price_1T70lQ1xbuY0ledyNG8842LL",  // $299 MXN — 25 créditos
  CREDITS_50:  "price_1T70lx1xbuY0ledy6UEr9igh",  // $499 MXN — 50 créditos
  CREDITS_100: "price_1T70o51xbuY0ledymTNKMxWf",  // $799 MXN — 100 créditos
} as const;

export const CREDIT_PACKAGES = [
  { priceId: STRIPE_PRICES.CREDITS_10,  credits: 10,  price: 149, label: "Básico"     },
  { priceId: STRIPE_PRICES.CREDITS_25,  credits: 25,  price: 299, label: "Popular"    },
  { priceId: STRIPE_PRICES.CREDITS_50,  credits: 50,  price: 499, label: "Pro"        },
  { priceId: STRIPE_PRICES.CREDITS_100, credits: 100, price: 799, label: "Enterprise" },
] as const;

export const PLAN_PRICES: Record<string, string> = {
  STARTER: STRIPE_PRICES.STARTER,
  PRO:     STRIPE_PRICES.PRO,
};