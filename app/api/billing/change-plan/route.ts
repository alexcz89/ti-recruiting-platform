// app/api/billing/change-plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/session";
import { PLANS, type PlanId } from "@/config/plans";
import { JobStatus, InvoiceStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionOrThrow();
    // @ts-ignore
    const role = session.user?.role as "RECRUITER" | "ADMIN" | string | undefined;

    if (role !== "RECRUITER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const planId = body?.planId as PlanId | undefined;

    if (!planId) {
      return NextResponse.json(
        { error: "Falta el planId en el cuerpo de la petición." },
        { status: 400 }
      );
    }

    const targetPlan = PLANS.find((p) => p.id === planId);
    if (!targetPlan) {
      return NextResponse.json(
        { error: "Plan destino no válido." },
        { status: 400 }
      );
    }

    // Traemos la empresa para saber:
    // - Plan actual
    // - Datos fiscales (para la factura)
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        billingPlan: true,
        taxLegalName: true,
        taxRfc: true,
        taxRegime: true,
        taxZip: true,
        taxAddressLine1: true,
        taxAddressLine2: true,
        taxEmail: true,
        cfdiUseDefault: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
    }

    const currentPlanId = (company.billingPlan as PlanId) ?? "FREE";
    const currentPlan =
      PLANS.find((p) => p.id === currentPlanId) ??
      PLANS.find((p) => p.id === "FREE") ??
      PLANS[0];

    // Si es el mismo plan, no hacemos nada
    if (currentPlan.id === targetPlan.id) {
      return NextResponse.json(
        { ok: true, planId: targetPlan.id, message: "Ya estás en este plan." },
        { status: 200 }
      );
    }

    // Cuántas vacantes activas tiene hoy la empresa
    const activeJobsCount = await prisma.job.count({
      where: { companyId, status: JobStatus.OPEN },
    });

    const maxActiveJobs = targetPlan.limits.maxActiveJobs; // puede ser null

    // Evitar bajar a un plan cuyo límite es menor que las vacantes activas actuales
    if (maxActiveJobs !== null && activeJobsCount > maxActiveJobs) {
      return NextResponse.json(
        {
          error: `No puedes cambiar a ${targetPlan.name} porque tienes ${activeJobsCount} vacantes activas y el límite de ese plan es ${maxActiveJobs}. Cierra algunas vacantes o elige un plan superior.`,
          code: "PLAN_TOO_SMALL",
          activeJobsCount,
          maxActiveJobs,
        },
        { status: 409 }
      );
    }

    // Vamos a actualizar plan + (opcionalmente) crear la factura dentro de una transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1) Actualizamos el plan de la empresa
      const updatedCompany = await tx.company.update({
        where: { id: companyId },
        data: { billingPlan: targetPlan.id },
      });

      // 2) Decidimos si creamos factura:
      //    - Solo si el nuevo plan tiene precio mensual > 0
      //    - Y si es diferente del plan anterior (ya validado arriba)
      let createdInvoice: { id: string } | null = null;

      if (targetPlan.priceMonthly > 0) {
        const currency = targetPlan.currency ?? "MXN";
        const total = targetPlan.priceMonthly; // Precio mensual como total
        // IVA 16% aprox
        const subtotalRaw = total / 1.16;
        const subtotal = Math.round(subtotalRaw * 100) / 100;
        const tax = Math.round((total - subtotal) * 100) / 100;

        createdInvoice = await tx.invoice.create({
          data: {
            companyId: updatedCompany.id,
            customerName: company.taxLegalName || company.name,
            customerRfc: company.taxRfc || "XAXX010101000",
            customerEmail: company.taxEmail || null,
            cfdiUse: company.cfdiUseDefault || "G03",
            paymentMethod: "PUE", // pago en una sola exhibición
            paymentForm: "03", // transferencia electrónica (ajustable después)
            currency,

            subtotal,
            tax,
            total,

            externalId: null,
            uuid: null,
            series: null,
            folio: null,
            pdfUrl: null,
            xmlUrl: null,

            status: InvoiceStatus.PENDING,
          },
          select: { id: true },
        });
      }

      return {
        company: updatedCompany,
        invoiceId: createdInvoice?.id ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      planId: targetPlan.id,
      previousPlanId: currentPlan.id,
      invoiceId: result.invoiceId,
    });
  } catch (err) {
    console.error("[POST /api/billing/change-plan]", err);
    return NextResponse.json(
      { error: "Error al cambiar de plan" },
      { status: 500 }
    );
  }
}
