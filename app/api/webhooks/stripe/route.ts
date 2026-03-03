// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/server/prisma";
import Stripe from "stripe";

export const runtime = "nodejs";

// Mapeo de Price ID → plan interno
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1T70fj1xbuY0ledyXNl3x7Nc": "STARTER",
  "price_1T70gQ1xbuY0ledyv9Tv3h2G": "PRO",
};

// Mapeo de Price ID → créditos
const PRICE_TO_CREDITS: Record<string, number> = {
  "price_1T70lC1xbuY0ledy16xKrkqx": 10,
  "price_1T70lQ1xbuY0ledyNG8842LL": 25,
  "price_1T70lx1xbuY0ledy6UEr9igh": 50,
  "price_1T70o51xbuY0ledymTNKMxWf": 100,
};

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Firma inválida:", err.message);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Checkout completado ──────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.companyId;
        if (!companyId) break;

        if (session.mode === "payment" && session.metadata?.type === "credits") {
          // Sumar créditos de coding
          const credits = Number(session.metadata.credits ?? 0);
          if (credits > 0) {
            await prisma.company.update({
              where: { id: companyId },
              data: { assessmentCredits: { increment: credits } },
            });
            console.log(`[Stripe] +${credits} créditos → company ${companyId}`);
          }
        }
        break;
      }

      // ── Suscripción creada o actualizada ────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const companyId = sub.metadata?.companyId;
        if (!companyId) break;

        const priceId = sub.items.data[0]?.price?.id;
        const plan    = PRICE_TO_PLAN[priceId] ?? null;
        const active  = sub.status === "active" || sub.status === "trialing";

        if (plan && active) {
          await prisma.company.update({
            where: { id: companyId },
            data: { billingPlan: plan as any },
          });
          console.log(`[Stripe] Plan ${plan} activado → company ${companyId}`);
        }
        break;
      }

      // ── Suscripción cancelada ────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const companyId = sub.metadata?.companyId;
        if (!companyId) break;

        await prisma.company.update({
          where: { id: companyId },
          data: { billingPlan: "FREE" as any },
        });
        console.log(`[Stripe] Plan degradado a FREE → company ${companyId}`);
        break;
      }

      // ── Pago de factura fallido ──────────────────────────────
      case "invoice.payment_failed": {
        const invoice   = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const company = await prisma.company.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true, name: true },
        });
        if (!company) break;

        // TODO: enviar email de aviso al reclutador
        console.warn(`[Stripe] Pago fallido para company ${company.id} (${company.name})`);
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error procesando ${event.type}:`, err.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}