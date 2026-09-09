// app/api/applications/[id]/notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { applicationWhereForActor } from "@/lib/server/candidate-access";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json({ error: "Unauthorized" }, 401);
    const role = String(session.user.role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return json({ error: "Forbidden" }, 403);
    }
    const companyId = role === "RECRUITER"
      ? await getSessionCompanyId().catch(() => null)
      : null;
    const scopedWhere = applicationWhereForActor(
      { role, companyId },
      { applicationId: params.id }
    );
    if (!scopedWhere) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    const app = await prisma.application.findFirst({
      where: scopedWhere,
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
