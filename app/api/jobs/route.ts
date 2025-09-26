// app/api/jobs/route.ts
import { NextRequest } from "next/server";
import { prisma } from "lib/prisma";
import { z } from "zod";

const EMPLOYMENT_TYPES = ["FULL_TIME","PART_TIME","CONTRACT","INTERNSHIP"] as const;
const SENIORITIES = ["JUNIOR","MID","SENIOR","LEAD"] as const;

const JobServerSchema = z.object({
  title: z.string().min(3, "Título requerido"),
  company: z.string().min(2, "Empresa requerida"),
  location: z.string().min(2, "Ubicación requerida"),
  employmentType: z.enum(EMPLOYMENT_TYPES, { required_error: "Tipo de contrato requerido" }),
  seniority: z.enum(SENIORITIES, { required_error: "Seniority requerido" }),
  description: z.string().min(10, "Descripción muy corta"),
  skillsCsv: z.string().optional().default(""),
  salaryMin: z.coerce.number().nonnegative().optional().nullable(),
  salaryMax: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().optional().default("MXN"),
  remote: z
    .union([z.literal("true"), z.literal("false"), z.string(), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id");
  if (id) {
    const job = await prisma.job.findUnique({ where: { id } });
    return Response.json({ job });
  }

  // Filtros
  const q = searchParams.get("q")?.trim() || ""; // busca en title/company/skills
  const location = searchParams.get("location")?.trim() || "";
  const remote = searchParams.get("remote"); // "true" | "false" | null
  const seniority = searchParams.get("seniority") as
    | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | null;
  const employmentType = searchParams.get("employmentType") as
    | "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | null;

  const where: any = {};

  if (q) {
    // NOTA: hasSome con [q] busca coincidencia exacta en el array skills.
    // Si quieres "icontains" por cada skill, habría que usar un where OR adicional vía JSON filter (depende de tu proveedor).
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { skills: { hasSome: [q] } },
    ];
  }
  if (location) where.location = { contains: location, mode: "insensitive" };
  if (remote === "true") where.remote = true;
  if (remote === "false") where.remote = false;
  if (seniority) where.seniority = seniority;
  if (employmentType) where.employmentType = employmentType;

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ jobs });
}

// ✅ Nuevo POST con Zod + FormData
export async function POST(req: Request) {
  try {
    const ctype = req.headers.get("content-type") || "";
    if (!ctype.includes("multipart/form-data")) {
      // En tu JobForm ya enviamos FormData; si algún cliente manda JSON, puedes soportarlo aquí si lo deseas.
      // Por simplicidad, exigimos FormData:
      return Response.json({ message: "Content-Type must be multipart/form-data" }, { status: 415 });
    }

    const form = await req.formData();

    const payload = {
      title: String(form.get("title") ?? ""),
      company: String(form.get("company") ?? ""),
      location: String(form.get("location") ?? ""),
      employmentType: String(form.get("employmentType") ?? "FULL_TIME"),
      seniority: String(form.get("seniority") ?? "MID"),
      description: String(form.get("description") ?? ""),
      skillsCsv: String(form.get("skills") ?? ""),
      salaryMin: form.get("salaryMin") ?? null,
      salaryMax: form.get("salaryMax") ?? null,
      currency: String(form.get("currency") ?? "MXN"),
      remote: form.get("remote") ?? "false",
    };

    const data = JobServerSchema.parse(payload);

    // Validación adicional de rango salarial
    if (
      data.salaryMin != null &&
      data.salaryMax != null &&
      !Number.isNaN(data.salaryMin) &&
      !Number.isNaN(data.salaryMax) &&
      data.salaryMin > data.salaryMax
    ) {
      return Response.json(
        { message: "El salario mínimo no puede ser mayor que el máximo" },
        { status: 400 }
      );
    }

    const skills = (data.skillsCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Persistencia
    const created = await prisma.job.create({
      data: {
        title: data.title,
        company: data.company,
        location: data.location,
        employmentType: data.employmentType,
        seniority: data.seniority,
        description: data.description,
        skills,
        salaryMin: data.salaryMin ?? null,
        salaryMax: data.salaryMax ?? null,
        currency: data.currency || "MXN",
        remote: data.remote,
        // postedById / companyId: agrega aquí si tu schema lo requiere
      },
      select: { id: true },
    });

    return Response.json({ ok: true, id: created.id }, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return Response.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return Response.json({ message: "Internal error" }, { status: 500 });
  }
}
