// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

type ProfilePayload = Partial<{
  location: string;
  phone: string;
  birthdate: string;  // ISO date string
  linkedin: string;
  github: string;
  resumeUrl: string;
}>;

export async function PATCH(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as ProfilePayload;

  const data: any = {};
  if (typeof body.location === "string") data.location = body.location;
  if (typeof body.phone === "string") data.phone = body.phone;
  if (typeof body.linkedin === "string") data.linkedin = body.linkedin;
  if (typeof body.github === "string") data.github = body.github;
  if (typeof body.resumeUrl === "string") data.resumeUrl = body.resumeUrl;
  if (typeof body.birthdate === "string") data.birthdate = new Date(body.birthdate);

  try {
    const updated = await prisma.user.update({
      where: { email },
      data,
      select: {
        id: true, email: true, location: true, phone: true,
        birthdate: true, linkedin: true, github: true, resumeUrl: true,
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
