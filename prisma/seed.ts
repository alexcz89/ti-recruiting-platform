// prisma/seed.ts
import {
  PrismaClient,
  Role,
  RecruiterStatus,
  ApplicationStatus,
  EmploymentType,
  Seniority,
  TaxonomyKind,
} from '@prisma/client'

const prisma = new PrismaClient()

const LANGUAGES: string[] = [
  'Inglés',
  'Mandarín (Chino estándar)',
  'Hindi',
  'Español',
  'Francés',
  'Árabe (variedades)',
  'Bengalí',
  'Ruso',
  'Portugués',
  'Urdu',
  'Indonesio/Malayo',
  'Alemán',
  'Japonés',
  'Nigerian Pidgin',
  'Maratí',
  'Telugu',
  'Turco',
  'Tamil',
  'Yue (Cantonés)',
  'Italiano',
  'Persa (Farsi/Dari/Tayiko)',
  'Vietnamita',
  'Hausa',
  'Egipcio árabe',
  'Javanés',
  'Coreano',
  'Punjabi occidental (Lahnda)',
  'Wu (Shanghainés)',
  'Gujarati',
  'Bhojpuri',
]

function slugifyLabel(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function seedLanguages() {
  const rows = LANGUAGES.map((label) => ({
    kind: TaxonomyKind.LANGUAGE,
    slug: slugifyLabel(label),
    label,
    aliases: [] as string[],
  }))
  // Usamos createMany con skipDuplicates — respeta @@unique([kind, slug])
  await prisma.taxonomyTerm.createMany({
    data: rows,
    skipDuplicates: true,
  })
}

async function main() {
  // 1) Company
  let company = await prisma.company.findFirst({ where: { name: 'Task Consultores' } })
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'Task Consultores', country: 'MX', city: 'Monterrey', domain: 'task.com.mx' },
    })
  }

  // 2) Recruiter
  let recruiter = await prisma.user.findUnique({ where: { email: 'alejandro@task.com.mx' } })
  if (!recruiter) {
    recruiter = await prisma.user.create({
      data: {
        email: 'alejandro@task.com.mx',
        name: 'Alejandro Cerda',
        role: Role.RECRUITER,
        companyId: company.id,
        recruiterProfile: {
          create: {
            company: company.name,
            website: 'https://task.com.mx',
            phone: '+52 81 8162 2482',
            status: RecruiterStatus.APPROVED,
          },
        },
      },
    })
  }

  // 3) Candidate
  let candidate = await prisma.user.findUnique({ where: { email: 'carolina@example.com' } })
  if (!candidate) {
    candidate = await prisma.user.create({
      data: {
        email: 'carolina@example.com',
        name: 'Carolina Torres',
        role: Role.CANDIDATE,
        location: 'Monterrey, NL, Mexico',
        phone: '+528111111111',
        linkedin: 'https://linkedin.com/in/carolinatorres',
        github: 'https://github.com/carolinatorres',
        resumeUrl: '/resumes/carolina.pdf',
        // Usa arrays simples existentes en tu schema actual
        skills: ['JavaScript', 'React', 'Node.js'],
        certifications: ['CompTIA'],
      },
    })
  }

  // 4) Job
  let job = await prisma.job.findFirst({
    where: { title: 'Frontend Developer', companyId: company.id },
  })
  if (!job) {
    job = await prisma.job.create({
      data: {
        title: 'Frontend Developer',
        description: 'React + Tailwind para plataforma TI',
        location: 'CDMX (Híbrido)',
        employmentType: EmploymentType.FULL_TIME,
        seniority: Seniority.MID,
        skills: ['React', 'JavaScript', 'Node.js'],
        salaryMin: 45000,
        salaryMax: 65000,
        companyId: company.id,
        recruiterId: recruiter.id,
      },
    })
  }

  // 5) Application
  const existingApp = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
  })
  if (!existingApp) {
    await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        status: ApplicationStatus.SUBMITTED,
        resumeUrl: candidate.resumeUrl ?? undefined,
        coverLetter: 'Me interesa la vacante de Frontend Developer.',
      },
    })
  }

  // 6) Languages (TaxonomyTerm)
  await seedLanguages()

  console.log('✅ Seed completado: Company, Recruiter, Candidate, Job, Application y Languages listos.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
