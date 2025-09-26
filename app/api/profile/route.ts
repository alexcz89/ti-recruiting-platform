// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/** Zod: valida solo los campos que realmente persistimos en tu tabla User */
const ProfilePayloadSchema = z.object({
  location: z.string().min(2).optional(),
  phone: z.string().optional().or(z.literal("")),            // ya en E.164 si viene de tu formulario nuevo
  birthdate: z.string().optional().or(z.literal("")),        // ISO string (yyyy-mm-dd)
  linkedin: z.string().url().optional().or(z.literal("")),
  github: z.string().url().optional().or(z.literal("")),
  resumeUrl: z.string().url().optional().or(z.literal("")),
});

/** Convierte strings vacíos a null para guardar más limpio en DB */
function nullIfEmpty(v: unknown) {
  return typeof v === "string" && v.trim() === "" ? null : v;
}

function parseBirthdate(iso?: string | null) {
  if (!iso) return null;
  // Acepta "YYYY-MM-DD" o ISO completo
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Lee el body como JSON o como FormData y regresa un objeto plano de strings */
async function readPayload(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    return {
      location: form.get("location")?.toString(),
      phone: form.get("phone")?.toString(),
      birthdate: form.get("birthdate")?.toString(),
      linkedin: form.get("linkedin")?.toString(),
      github: form.get("github")?.toString(),
      resumeUrl: form.get("resumeUrl")?.toString(),
      // Nota: si viene archivo "resume", aquí podrías subirlo a S3/Uploadthing y setear resumeUrl
      // const resume = form.get("resume") as File | null;
      // if (resume && resume.size > 0) { const url = await upload(resume); resumeUrl = url; }
    };
  }

  // JSON por compat (tu handler anterior)
  const json = await req.json().catch(() => ({}));
  return {
    location: typeof json.location === "string" ? json.location : undefined,
    phone: typeof json.phone === "string" ? json.phone : undefined,
    birthdate: typeof json.birthdate === "string" ? json.birthdate : undefined,
    linkedin: typeof json.linkedin === "string" ? json.linkedin : undefined,
    github: typeof json.github === "string" ? json.github : undefined,
    resumeUrl: typeof json.resumeUrl === "string" ? json.resumeUrl : undefined,
  };
}

export async function PATCH(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await readPayload(req);

    // Valida con Zod (solo los campos que manejamos aquí)
    const parsed = ProfilePayloadSchema.parse(raw);

    // Arma el objeto de update normalizando vacíos a null
    const data: any = {};
    if (parsed.location !== undefined) data.location = parsed.location;
    if (parsed.phone !== undefined) data.phone = nullIfEmpty(parsed.phone);
    if (parsed.linkedin !== undefined) data.linkedin = nullIfEmpty(parsed.linkedin);
    if (parsed.github !== undefined) data.github = nullIfEmpty(parsed.github);
    if (parsed.resumeUrl !== undefined) data.resumeUrl = nullIfEmpty(parsed.resumeUrl);

    // birthdate seguro
    if (parsed.birthdate !== undefined) {
      const bd = parseBirthdate(parsed.birthdate || null);
      data.birthdate = bd; // guarda null si es inválida o vacía
    }

    const updated = await prisma.user.update({
      where: { email },
      data,
      select: {
        id: true,
        email: true,
        location: true,
        phone: true,
        birthdate: true,
        linkedin: true,
        github: true,
        resumeUrl: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Update failed", detail: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
