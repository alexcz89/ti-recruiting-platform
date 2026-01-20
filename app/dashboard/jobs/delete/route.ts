// app/dashboard/jobs/delete/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  try {
    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const form = await request.formData();
    const jobId = String(form.get("jobId") || "");
    if (!jobId) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    // 1) Verificar que la vacante pertenece a la empresa de la sesión
    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // 2) Borrar primero postulaciones y luego la vacante, en transacción
    await prisma.$transaction([
      prisma.application.deleteMany({ where: { jobId } }),
      prisma.job.delete({ where: { id: jobId } }),
    ]);

    // 3) Revalidar la lista
    revalidatePath("/dashboard/jobs");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "ERROR" },
      { status: 500 }
    );
  }
}
