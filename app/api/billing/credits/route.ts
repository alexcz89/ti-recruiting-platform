// app/api/billing/credits/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";
import { getCreditBalance, getCreditHistory } from "@/lib/assessments/credits";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/credits
 * Obtener balance y historial de créditos de la empresa
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const role = String(user?.role || "");

    // Solo reclutadores y admins pueden ver créditos
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only recruiters can access credits" },
        { status: 403 }
      );
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) {
      return NextResponse.json(
        { error: "No company associated" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const includeHistory = searchParams.get("history") === "true";
    const historyLimit = parseInt(searchParams.get("limit") || "50");

    // Obtener balance
    const balance = await getCreditBalance(companyId);
    if (!balance) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Obtener historial si se solicita
    let history = null;
    if (includeHistory) {
      history = await getCreditHistory(companyId, historyLimit);
    }

    return NextResponse.json({
      balance,
      history,
    });
  } catch (error) {
    console.error("[GET /api/billing/credits] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}