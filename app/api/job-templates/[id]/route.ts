// app/api/job-templates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tpl = await prisma.jobTemplate.findFirst({
      where: { id: params.id, companyId },
      select: { id: true, title: true, payload: true, createdAt: true, updatedAt: true },
    });

    if (!tpl) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json(tpl);
  } catch (err) {
    console.error("[GET /api/job-templates/:id]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getSessionOrThrow();
    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const title = body?.title?.toString()?.trim();
    const payload = body?.payload;

    const data: any = {};
    if (title) data.title = title;
    if (payload && typeof payload === "object") data.payload = payload;

    const updated = await prisma.jobTemplate.updateMany({
      where: { id: params.id, companyId },
      data,
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "No encontrada o sin permisos" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/job-templates/:id]", err);
    return NextResponse.json({ error: "Error al actualizar plantilla" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getSessionOrThrow();
    const companyId = await getSessionCompanyId();
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const deleted = await prisma.jobTemplate.deleteMany({
      where: { id: params.id, companyId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "No encontrada o sin permisos" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/job-templates/:id]", err);
    return NextResponse.json({ error: "Error al borrar plantilla" }, { status: 500 });
  }
}
