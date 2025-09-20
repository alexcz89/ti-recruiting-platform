import { PrismaClient, Role, RecruiterStatus, ApplicationStatus, EmploymentType, Seniority } from '@prisma/client'
const prisma = new PrismaClient()

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
        companyId: company.id, // requiere schema NUEVO
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
        phone: '81 1111 1111',
        linkedin: 'https://linkedin.com/in/carolinatorres',
        github: 'https://github.com/carolinatorres',
        resumeUrl: '/resumes/carolina.pdf',
        frontend: ['JavaScript', 'React'],
        backend: ['Node.js', 'SQL'],
        certifications: ['CompTIA'],
      },
    })
  }

  // 4) Job (usa findFirst por título y companyId; crea si no existe)
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
        companyId: company.id,   // requiere schema NUEVO
        recruiterId: recruiter.id,
      },
    })
  }

  // 5) Application (usa unique compuesta candidateId+jobId)
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

  console.log('✅ Seed completado: Company, Recruiter, Candidate, Job y Application listos.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
