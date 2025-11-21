// app/api/billing/taxdata/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionOrThrow();
    const role = (session.user as any)?.role as string | undefined;

    if (role !== "RECRUITER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));

    const taxLegalName = (body.taxLegalName || "").trim();
    const taxRfc = (body.taxRfc || "").trim().toUpperCase();
    const taxRegime = (body.taxRegime || "").trim() || null;
    const taxZip = (body.taxZip || "").trim();
    const taxAddressLine1 = (body.taxAddressLine1 || "").trim();
    const taxAddressLine2 = (body.taxAddressLine2 || "").trim() || null;
    const taxEmail = (body.taxEmail || "").trim() || null;
    const cfdiUseDefault = (body.cfdiUseDefault || "").trim() || null;

    if (!taxLegalName || !taxRfc || !taxZip) {
      return NextResponse.json(
        { error: "Razón social, RFC y C.P. son obligatorios." },
        { status: 400 }
      );
    }

    if (taxRfc.length < 12) {
      return NextResponse.json(
        { error: "El RFC parece incompleto." },
        { status: 400 }
      );
    }

    const taxDataCompleted =
      !!taxLegalName && !!taxRfc && !!taxZip && !!taxAddressLine1;

    await prisma.company.update({
      where: { id: companyId },
      data: {
        taxLegalName,
        taxRfc,
        taxRegime,
        taxZip,
        taxAddressLine1,
        taxAddressLine2,
        taxEmail,
        cfdiUseDefault,
        taxDataCompleted,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/taxdata]", err);
    return NextResponse.json(
      { error: "Error al guardar los datos fiscales" },
      { status: 500 }
    );
  }
}
