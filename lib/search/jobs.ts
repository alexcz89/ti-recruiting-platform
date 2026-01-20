// lib/search/jobs.ts
import { prisma } from '@/lib/server/prisma';
import Fuse from "fuse.js";

type SearchParams = {
  q?: string;
  location?: string;
  remote?: "true" | "false";
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
  seniority?: "JUNIOR" | "MID" | "SENIOR" | "LEAD";
  take?: number; // límite final tras ranking
};

export async function searchJobs(params: SearchParams) {
  const {
    q = "",
    location = "",
    remote,
    employmentType,
    seniority,
    take = 50,
  } = params;

  // 1) Prefiltro en DB (barato) para reducir dataset
  const where: any = {
    ...(employmentType ? { employmentType } : {}),
    ...(seniority ? { seniority } : {}),
    ...(typeof remote === "string"
      ? { remote: remote === "true" }
      : {}),
    ...(location
      ? { location: { contains: location, mode: "insensitive" } }
      : {}),
  };

  const rows = await prisma.job.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      company: { select: { name: true } },
    },
    take: 400, // traemos lotes razonables, luego rankeamos con Fuse
  });

  // 2) Si no hay q => devolvemos los primeros "take" ya ordenados por updatedAt
  const mapped = rows.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company?.name || "",
    location: j.location,
    employmentType: j.employmentType,
    seniority: j.seniority,
    remote: j.remote,
    description: j.description,
    skills: j.skills || [],
    updatedAt: j.updatedAt,
  }));

  if (!q.trim()) {
    return mapped.slice(0, take);
  }

  // 3) Rankeamos con Fuse en servidor
  const fuse = new Fuse(mapped, {
    includeScore: true,
    threshold: 0.32,           // sensibilidad (0 exacto, 1 muy laxa)
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: "title", weight: 0.45 },
      { name: "company", weight: 0.25 },
      { name: "skills", weight: 0.18 },
      { name: "description", weight: 0.10 },
      { name: "location", weight: 0.02 },
    ],
  });

  const results = fuse.search(q.trim());

  // 4) Reordenamos por score y desempate por updatedAt
  const ranked = results
    .sort((a, b) => {
      if ((a.score ?? 0) !== (b.score ?? 0)) return (a.score ?? 0) - (b.score ?? 0);
      return b.item.updatedAt.getTime() - a.item.updatedAt.getTime();
    })
    .slice(0, take)
    .map((r) => r.item);

  return ranked;
}
