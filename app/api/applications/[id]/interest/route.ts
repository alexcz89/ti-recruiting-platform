// app/api/applications/[id]/interest/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";

type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";
const ALLOWED: InterestKey[] = ["REVIEW", "MAYBE", "ACCEPTED", "REJECTED"];

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const next: InterestKey = String(body?.recruiterInterest || "").toUpperCase() as InterestKey;

    if (!ALLOWED.includes(next)) {
      return NextResponse.json({ error: "Valor de estado inválido" }, { status: 400 });
    }

    // Verifica que la aplicación pertenezca a una vacante de esta empresa
    const app = await prisma.application.findFirst({
      where: { id: params.id, job: { companyId } },
      select: { id: true },
    });
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Actualiza el estado del reclutador
    const updated = await prisma.application.update({
      where: { id: params.id },
      data: { recruiterInterest: next },
      select: { id: true, recruiterInterest: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
