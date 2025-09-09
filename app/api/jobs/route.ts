import { NextRequest } from "next/server";
import { prisma } from "lib/prisma";

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
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { skills: { hasSome: [q] } }, // si q coincide exactamente con un skill
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

// Mantén tu POST como ya lo tienes
