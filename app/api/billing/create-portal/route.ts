// app/api/billing/create-portal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { stripe } from "@/lib/stripe";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const companyId = (session.user as any).companyId as string | undefined;
    if (!companyId) return json(400, { error: "Sin empresa asociada" });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { stripeCustomerId: true },
    });

    if (!company?.stripeCustomerId) {
      return json(400, { error: "No tienes suscripción activa" });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: `${baseUrl}/dashboard/billing`,
    });

    return json(200, { url: portalSession.url });
  } catch (e: any) {
    console.error("[POST /api/billing/create-portal]", e);
    return json(500, { error: "Error interno" });
  }
}