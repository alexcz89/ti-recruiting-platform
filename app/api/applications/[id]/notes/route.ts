// app/api/applications/[id]/notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    const app = await prisma.application.findFirst({
      where: { id: params.id, job: { companyId } },
      select: { id: true },
    });
    if (!app) return json({ error: "Not found" }, 404);

    const updated = await prisma.application.update({
      where: { id: params.id },
      data: { internalNotes: notes || null },
      select: { id: true, internalNotes: true },
    });

    return json(updated);
  } catch (e) {
    console.error("[PATCH /api/applications/:id/notes]", e);
    return json({ error: "Server error" }, 500);
  }
}
