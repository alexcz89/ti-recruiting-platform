// app/api/profile/personal/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

const PersonalSchema = z.object({
  firstName:     z.string().min(1, "Nombre requerido"),
  lastName1:     z.string().min(1, "Apellido paterno requerido"),
  lastName2:     z.string().optional().or(z.literal("")),
  phone:         z.string().optional().or(z.literal("")).nullable(),
  location:      z.string().optional().or(z.literal("")),
  birthdate:     z.string().optional().or(z.literal("")),
  linkedin:      z.string().optional().or(z.literal("")),
  github:        z.string().optional().or(z.literal("")),
  certifications: z.array(z.string()).optional(),
  // ✅ Salario deseado — MXN mensual bruto
  desiredSalary: z.coerce.number().int().min(0).max(999999).optional().nullable(),
  // ✅ Modalidad de trabajo
  seekingRemote: z.boolean().optional(),
  seekingHybrid: z.boolean().optional(),
  seekingOnsite: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (!me) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (me.role !== "CANDIDATE") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const data = PersonalSchema.parse(body);

    const fullName = [data.firstName, data.lastName1, data.lastName2]
      .map((x) => (x || "").trim())
      .filter(Boolean)
      .join(" ");

    const parseBirthdate = (iso?: string | null): Date | null => {
      if (!iso || iso === "") return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      if (!m) return null;
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
      return isNaN(d.getTime()) ? null : d;
    };

    await prisma.user.update({
      where: { id: me.id },
      data: {
        name:            fullName,
        firstName:       data.firstName,
        lastName:        data.lastName1,
        maternalSurname: data.lastName2 || null,
        phone:           data.phone || null,
        location:        data.location || null,
        birthdate:       parseBirthdate(data.birthdate),
        linkedin:        data.linkedin || null,
        github:          data.github || null,
        profileLastUpdated: new Date(),
        // ✅ Salario deseado
        ...(data.desiredSalary !== undefined
          ? { desiredSalaryMin: data.desiredSalary || null, desiredCurrency: "MXN" }
          : {}),
        // ✅ Modalidad de trabajo
        ...(data.seekingRemote !== undefined ? { seekingRemote: data.seekingRemote } : {}),
        ...(data.seekingHybrid !== undefined ? { seekingHybrid: data.seekingHybrid } : {}),
        ...(data.seekingOnsite !== undefined ? { seekingOnsite: data.seekingOnsite } : {}),
        // ✅ Certificaciones
        ...(data.certifications !== undefined
          ? { certifications: data.certifications }
          : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    console.error("[PATCH /api/profile/personal]", e);
    return NextResponse.json({ error: "Error al guardar datos personales" }, { status: 500 });
  }
}