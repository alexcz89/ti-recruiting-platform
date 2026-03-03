// app/api/billing/create-checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { stripe, STRIPE_PRICES, CREDIT_PACKAGES } from "@/lib/stripe";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const role = String((session.user as any).role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") return json(403, { error: "Sin permisos" });

    const companyId = (session.user as any).companyId as string | undefined;
    if (!companyId) return json(400, { error: "Sin empresa asociada" });

    const { type, priceId } = await req.json();
    // type: "subscription" | "credits"

    if (!type || !priceId) return json(400, { error: "Faltan parámetros" });

    // Obtener o crear Stripe Customer
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, stripeCustomerId: true },
    });
    if (!company) return json(404, { error: "Empresa no encontrada" });

    let customerId = company.stripeCustomerId;
    if (!customerId) {
      const user = session.user as any;
      const customer = await stripe.customers.create({
        name: company.name,
        email: user.email ?? undefined,
        metadata: { companyId },
      });
      customerId = customer.id;
      await prisma.company.update({
        where: { id: companyId },
        data: { stripeCustomerId: customerId },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

    if (type === "subscription") {
      // Validar que sea un price de suscripción
      const validPrices = [STRIPE_PRICES.STARTER, STRIPE_PRICES.PRO];
      if (!validPrices.includes(priceId as any)) return json(400, { error: "Plan inválido" });

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/dashboard/billing?success=plan`,
        cancel_url:  `${baseUrl}/dashboard/billing?canceled=1`,
        metadata: { companyId, type: "subscription" },
        subscription_data: { metadata: { companyId } },
        locale: "es",
      });

      return json(200, { url: checkoutSession.url });
    }

    if (type === "credits") {
      // Validar que sea un price de créditos válido
      const pkg = CREDIT_PACKAGES.find(p => p.priceId === priceId);
      if (!pkg) return json(400, { error: "Paquete de créditos inválido" });

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/dashboard/billing/credits?success=1`,
        cancel_url:  `${baseUrl}/dashboard/billing/credits?canceled=1`,
        metadata: { companyId, type: "credits", credits: String(pkg.credits) },
        locale: "es",
      });

      return json(200, { url: checkoutSession.url });
    }

    return json(400, { error: "Tipo inválido" });
  } catch (e: any) {
    console.error("[POST /api/billing/create-checkout]", e);
    return json(500, { error: "Error interno" });
  }
}