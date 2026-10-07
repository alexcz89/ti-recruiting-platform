// app/dashboard/jobs/delete/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from '@/lib/server/prisma';
import { getSessionCompanyId } from '@/lib/server/session';
import { revalidatePath } from "next/cache";
import { APPLICATION_HIRED_FOOTPRINT_WHERE } from "@/lib/hiring-process/hired-footprint";

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

    const outcome = await prisma.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { id: jobId, companyId },
        select: { id: true },
      });
      if (!job) return "NOT_FOUND" as const;

      const hiredApplication = await tx.application.findFirst({
        where: {
          AND: [{ jobId: job.id }, APPLICATION_HIRED_FOOTPRINT_WHERE],
        },
        select: { id: true },
      });
      if (hiredApplication) return "HIRED" as const;

      await tx.application.deleteMany({ where: { jobId: job.id } });
      await tx.job.delete({ where: { id: job.id } });
      return "DELETED" as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (outcome === "NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (outcome === "HIRED") {
      return NextResponse.json(
        { error: "No se puede eliminar una vacante con candidatos contratados" },
        { status: 409 },
      );
    }

    // 3) Revalidar la lista
    revalidatePath("/dashboard/jobs");
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: unknown }).code === "P2034"
    ) {
      return NextResponse.json(
        { error: "La vacante cambió durante el borrado" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ERROR" },
      { status: 500 }
    );
  }
}
