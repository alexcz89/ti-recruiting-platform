// app/dashboard/jobs/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  try {
    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const form = await request.formData();
    const jobId = String(form.get("jobId") || "");
    const status = String(form.get("status") || "");

    if (!jobId || !status) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    await prisma.job.update({
      where: { id: jobId, companyId },
      data: { status: status as any },
    });

    revalidatePath("/dashboard/jobs");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "ERROR" }, { status: 500 });
  }
}
