// prisma/seed.ts
import {
  PrismaClient,
  Role,
  RecruiterStatus,
  ApplicationStatus,
  EmploymentType,
  Seniority,
  TaxonomyKind,
} from "@prisma/client";

// ⬇ Importa el catálogo único desde lib/skills.ts
import {
  ALL_SKILLS,
  CERTIFICATIONS,
  LANGUAGES_FALLBACK,
} from "../lib/skills";

const prisma = new PrismaClient();

/** Cambia a `true` si quieres borrar términos que no estén en el catálogo de lib/skills.ts */
const CLEAN_UNLISTED = true;

function slugifyLabel(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedTaxonomy(kind: TaxonomyKind, labels: readonly string[]) {
  const rows = labels.map((label) => ({
    kind,
    slug: slugifyLabel(label),
    label,
    aliases: [] as string[],
  }));

  // Crea los que falten (respeta @@unique([kind, slug]) con skipDuplicates)
  await prisma.taxonomyTerm.createMany({
    data: rows,
    skipDuplicates: true,
  });

  if (CLEAN_UNLISTED) {
    // Borra términos del mismo kind que NO estén en el catálogo
    const allowedSlugs = new Set(rows.map((r) => r.slug));
    await prisma.taxonomyTerm.deleteMany({
      where: {
        kind,
        slug: { notIn: Array.from(allowedSlugs) },
      },
    });
  }

  // Devuelve lo que quedó en DB (útil para depurar)
  const final = await prisma.taxonomyTerm.findMany({
    where: { kind },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });
  return final;
}

async function seedLanguages() {
  return seedTaxonomy(TaxonomyKind.LANGUAGE, LANGUAGES_FALLBACK);
}

async function seedSkills() {
  return seedTaxonomy(TaxonomyKind.SKILL, ALL_SKILLS);
}

async function seedCertifications() {
  return seedTaxonomy(TaxonomyKind.CERTIFICATION, CERTIFICATIONS);
}

async function seedDemoData() {
  // 1) Company
  let company = await prisma.company.findFirst({ where: { name: "Task Consultores" } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: "Task Consultores", country: "MX", city: "Monterrey", domain: "task.com.mx" },
    });
  }

  // 2) Recruiter
  let recruiter = await prisma.user.findUnique({ where: { email: "alejandro@task.com.mx" } });
  if (!recruiter) {
    recruiter = await prisma.user.create({
      data: {
        email: "alejandro@task.com.mx",
        name: "Alejandro Cerda",
        role: Role.RECRUITER,
        companyId: company.id,
        recruiterProfile: {
          create: {
            company: company.name,
            website: "https://task.com.mx",
            phone: "+52 81 8162 2482",
            status: RecruiterStatus.APPROVED,
          },
        },
      },
    });
  }

  // 3) Candidate
  let candidate = await prisma.user.findUnique({ where: { email: "carolina@example.com" } });
  if (!candidate) {
    candidate = await prisma.user.create({
      data: {
        email: "carolina@example.com",
        name: "Carolina Torres",
        role: Role.CANDIDATE,
        location: "Monterrey, NL, Mexico",
        phone: "+528111111111",
        linkedin: "https://linkedin.com/in/carolinatorres",
        github: "https://github.com/carolinatorres",
        resumeUrl: "/resumes/carolina.pdf",
        // Estos arrays legacy siguen siendo strings en tu schema
        skills: ["React", "Node.js", "AWS"],
        certifications: ["CompTIA"],
      },
    });
  }

  // 4) Job
  let job = await prisma.job.findFirst({
    where: { title: "Frontend Developer", companyId: company.id },
  });
  if (!job) {
    job = await prisma.job.create({
      data: {
        title: "Frontend Developer",
        description: "React + Tailwind para plataforma TI",
        location: "CDMX (Híbrido)",
        employmentType: EmploymentType.FULL_TIME,
        seniority: Seniority.MID,
        skills: ["React", "JavaScript", "Node.js"],
        salaryMin: 45000,
        salaryMax: 65000,
        companyId: company.id,
        recruiterId: recruiter.id,
      },
    });
  }

  // 5) Application
  const existingApp = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
  });
  if (!existingApp) {
    await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        status: ApplicationStatus.SUBMITTED,
        resumeUrl: candidate.resumeUrl ?? undefined,
        coverLetter: "Me interesa la vacante de Frontend Developer.",
      },
    });
  }
}

async function main() {
  // Semillas de catálogos
  const [langs, skills, certs] = await Promise.all([
    seedLanguages(),
    seedSkills(),
    seedCertifications(),
  ]);

  console.log(`✅ Idiomas en DB: ${langs.length}`);
  console.log(`✅ Skills en DB: ${skills.length}`);
  console.log(`✅ Certificaciones en DB: ${certs.length}`);

  // (Opcional) datos demo
  await seedDemoData();

  console.log("✅ Seed completado: catálogos (LANGUAGE/SKILL/CERTIFICATION) y demo listos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
