// app/api/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId, getSessionOrThrow } from '@/lib/server/session';
import { InvoiceStatus } from "@prisma/client";

/**
 * GET /api/invoices
 * Lista las facturas de la empresa actual (con paginación simple)
 */
export async function GET(req: NextRequest) {
  try {
    const companyId = await getSessionCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const take = Math.min(parseInt(searchParams.get("take") || "20", 10), 50);
    const cursor = searchParams.get("cursor") || undefined;

    const page = await prisma.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        customerName: true,
        customerRfc: true,
        customerEmail: true,
        subtotal: true,
        tax: true,
        total: true,
        currency: true,
        status: true,
        uuid: true,
        series: true,
        folio: true,
        pdfUrl: true,
        xmlUrl: true,
        createdAt: true,
        issuedAt: true,
      },
    });

    const items = page.slice(0, take);
    const nextCursor = page.length > take ? page[take].id : null;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    console.error("[GET /api/invoices]", err);
    return NextResponse.json(
      { error: "Error al obtener facturas" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices
 * Crea una factura en estado PENDING (aún sin timbrar).
 * Esto luego lo usarás para mandar a timbrar a Factura.com.
 */
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

    const {
      customerName,
      customerRfc,
      customerEmail,
      cfdiUse,
      paymentMethod,
      paymentForm,
      currency = "MXN",
      subtotal,
      tax,
      total,
    } = body ?? {};

    // Validaciones básicas
    if (!customerName || typeof customerName !== "string") {
      return NextResponse.json(
        { error: "Falta el nombre del cliente (customerName)." },
        { status: 400 }
      );
    }
    if (!customerRfc || typeof customerRfc !== "string") {
      return NextResponse.json(
        { error: "Falta el RFC del cliente (customerRfc)." },
        { status: 400 }
      );
    }
    if (
      typeof subtotal !== "number" ||
      typeof tax !== "number" ||
      typeof total !== "number"
    ) {
      return NextResponse.json(
        { error: "subtotal, tax y total deben ser numéricos." },
        { status: 400 }
      );
    }

    // Crear factura en estado PENDING (todavía sin timbrar)
    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        customerName,
        customerRfc,
        customerEmail: customerEmail || null,
        cfdiUse: cfdiUse || null,
        paymentMethod: paymentMethod || null,
        paymentForm: paymentForm || null,
        currency: currency || "MXN",
        subtotal,
        tax,
        total,
        status: InvoiceStatus.PENDING,
      },
      select: {
        id: true,
        customerName: true,
        customerRfc: true,
        subtotal: true,
        tax: true,
        total: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (err) {
    console.error("[POST /api/invoices]", err);
    return NextResponse.json(
      { error: "Error al crear la factura" },
      { status: 500 }
    );
  }
}
