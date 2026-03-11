// lib/server/syncJobSkills.ts
import type { PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient;

interface RawSkill {
  name?: string;
  required?: boolean;
  weight?: number;
}

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function syncJobSkills(
  prisma: PrismaLike,
  jobId: string,
  skillsJson: RawSkill[] | null | undefined
): Promise<void> {
  await prisma.jobRequiredSkill.deleteMany({
    where: { jobId },
  });

  if (!Array.isArray(skillsJson) || skillsJson.length === 0) return;

  const cleaned = skillsJson
    .map((s) => ({
      name: String(s?.name ?? "").trim(),
      required: s?.required === true,
      weight:
        typeof s?.weight === "number" && Number.isFinite(s.weight)
          ? s.weight
          : s?.required
          ? 5
          : 2,
    }))
    .filter((s) => s.name.length > 0);

  if (cleaned.length === 0) return;

  const uniqueNames = Array.from(new Set(cleaned.map((s) => norm(s.name))));
  const allTerms = await prisma.taxonomyTerm.findMany({
    select: { id: true, label: true },
  });

  const termMap = new Map(
    allTerms.map((t) => [norm(t.label), t.id] as const)
  );

  const seen = new Set<string>();
  const toCreate: Array<{
    jobId: string;
    termId: string;
    must: boolean;
    weight: number;
  }> = [];

  for (const skill of cleaned) {
    const key = norm(skill.name);
    if (!uniqueNames.includes(key)) continue;

    const termId = termMap.get(key);
    if (!termId) continue;

    const dedupeKey = `${jobId}:${termId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    toCreate.push({
      jobId,
      termId,
      must: skill.required,
      weight: skill.weight,
    });
  }

  if (toCreate.length === 0) return;

  await prisma.jobRequiredSkill.createMany({
    data: toCreate,
    skipDuplicates: true,
  });
}