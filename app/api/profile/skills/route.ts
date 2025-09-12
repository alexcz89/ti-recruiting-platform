// app/api/profile/skills/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

type SkillsPayload = Partial<{
  frontend: string[];
  backend: string[];
  mobile: string[];
  cloud: string[];
  database: string[];
  cybersecurity: string[];
  testing: string[];
  ai: string[];
  certifications: string[];
}>;

export async function PATCH(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SkillsPayload;

  // Construimos el objeto de update dinámicamente
  const updateData: Record<string, any> = {};
  const allowedKeys = [
    "frontend",
    "backend",
    "mobile",
    "cloud",
    "database",
    "cybersecurity",
    "testing",
    "ai",
    "certifications",
  ] as const;

  for (const key of allowedKeys) {
    if (key in body && Array.isArray(body[key])) {
      updateData[key] = body[key];
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { email },
      data: updateData,
      select: {
        id: true,
        email: true,
        frontend: true,
        backend: true,
        mobile: true,
        cloud: true,
        database: true,
        cybersecurity: true,
        testing: true,
        ai: true,
        certifications: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Update failed", detail: err?.message },
      { status: 500 }
    );
  }
}
