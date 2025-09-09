// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Recruiter123!", 10);
  const recruiter = await prisma.user.upsert({
    where: { email: "recruiter@example.com" },
    update: {},
    create: {
      email: "recruiter@example.com",
      name: "Recruiter Demo",
      passwordHash: password,
      role: "RECRUITER"
    }
  });

  const jobs = [
    {
      title: "Backend Developer (Node.js)",
      company: "TechMX",
      location: "Monterrey, NL",
      employmentType: "FULL_TIME",
      seniority: "MID",
      description: "Desarrollo de APIs en Node.js con PostgreSQL y Prisma.",
      skills: ["Node.js", "PostgreSQL", "Prisma", "REST"],
      salaryMin: 45000, salaryMax: 65000, remote: true
    },
    {
      title: "Frontend React/Next.js",
      company: "InnovIT",
      location: "CDMX",
      employmentType: "FULL_TIME",
      seniority: "SENIOR",
      description: "Construcción de interfaces con Next.js y Tailwind.",
      skills: ["React", "Next.js", "Tailwind", "TypeScript"],
      salaryMin: 60000, salaryMax: 90000, remote: true
    }
  ];

  for (const j of jobs) {
    await prisma.job.create({ data: { ...j, recruiterId: recruiter.id } });
  }

  console.log("Seed complete.");
}

main().finally(async () => {
  await prisma.$disconnect();
});
