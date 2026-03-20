// app/api/profile/skills/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/server/prisma";

type SkillsPayload = {
  certifications?: unknown;
  [key: string]: unknown;
};

export async function PATCH(req: Request) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as SkillsPayload;

    const updateData: { certifications?: string[] } = {};

    if (Array.isArray(body.certifications)) {
      const certifications = body.certifications
        .filter((v): v is string => typeof v === "string")
        .map((s) => s.trim())
        .filter(Boolean);

      updateData.certifications = certifications;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: true, user: null });
    }

    const updated = await prisma.user.update({
      where: { email },
      data: updateData,
      select: {
        id: true,
        email: true,
        certifications: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    console.error("[PATCH /api/profile/skills] error", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}