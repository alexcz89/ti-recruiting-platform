// app/api/profile/skills/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from '@/lib/server/prisma';

// Permitimos más campos en el body, pero en la DB solo se guarda `certifications`
type SkillsPayload = {
  certifications?: string[];
  [key: string]: unknown;
};

export async function PATCH(req: Request) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SkillsPayload;

  // Solo actualizamos campos que realmente existan en el modelo User
  const updateData: Record<string, any> = {};

  // En tu esquema Prisma solo está `certifications` (string[])
  if (Array.isArray(body.certifications)) {
    updateData.certifications = body.certifications;
  }

  // Si no hay nada que actualizar, respondemos OK sin tocar la DB
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: true, user: null });
  }

  try {
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
  } catch (err: any) {
    console.error("[PATCH /api/profile/skills] error", err);
    return NextResponse.json(
      { error: "Update failed", detail: err?.message },
      { status: 500 }
    );
  }
}
