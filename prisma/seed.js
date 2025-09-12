// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // === Usuarios demo ===
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.local' },
    update: {},
    create: {
      email: 'admin@demo.local',
      name: 'Admin Demo',
      passwordHash: 'demo',
      role: 'ADMIN',
    },
  });

  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@demo.local' },
    update: {},
    create: {
      email: 'recruiter@demo.local',
      name: 'Recruiter Demo',
      passwordHash: 'demo',
      role: 'RECRUITER',
    },
  });

  const candidate = await prisma.user.upsert({
    where: { email: 'candidate@demo.local' },
    update: {},
    create: {
      email: 'candidate@demo.local',
      name: 'Candidate Demo',
      passwordHash: 'demo',
      role: 'CANDIDATE',
      location: 'Monterrey, NL, México',
      linkedin: 'https://linkedin.com/in/candidate-demo',
      github: 'https://github.com/candidate-demo',
      // ✅ skills por categoría (según tu schema extendido)
      frontend: ['React', 'Next.js'],
      backend: ['Node.js', 'Prisma'],
      mobile: ['React Native'],
      cloud: ['AWS'],
      database: ['PostgreSQL'],
      cybersecurity: [],
      testing: ['Jest'],
      ai: [],
      // ✅ certificaciones sigue existiendo
      certifications: ['AWS Fundamentals'],
    },
  });

  // === Vacante demo ===
  await prisma.job.upsert({
    where: { id: 'seed-job-1' }, // id fijo para evitar duplicados al reseed
    update: {},
    create: {
      id: 'seed-job-1',
      title: 'Desarrollador Full Stack',
      company: 'Acme Corp',
      location: 'Remoto',
      employmentType: 'FULL_TIME',
      seniority: 'MID',
      description: 'Stack: Next.js, Node.js, PostgreSQL. Trabajo 100% remoto.',
      skills: ['next.js', 'node.js', 'postgresql'],
      salaryMin: 40000,
      salaryMax: 60000,
      currency: 'MXN',
      remote: true,
      recruiterId: recruiter.id,
    },
  });

  // === Codex demo ===
  await prisma.codexEntry.upsert({
    where: { slug: 'next-auth-troubleshooting' },
    update: {},
    create: {
      title: 'NextAuth: troubleshooting 500 en /api/auth/providers',
      slug: 'next-auth-troubleshooting',
      excerpt: 'Errores comunes, diagnóstico y checklist de variables.',
      tech: 'Next.js',
      tags: ['next-auth','debug','auth'],
      published: true,
      content: `# Diagnóstico rápido

1. **Variables** en \`.env\`
   - \`NEXTAUTH_URL\`
   - \`NEXTAUTH_SECRET\`
   - Credenciales del provider (Google/GitHub)

2. **Rutas** en App Router
   - \`app/api/auth/[...nextauth]/route.ts\` configurada con \`authOptions\`

3. **Versión**
   - v4 → \`getServerSession\`
   - v5 → \`auth()\` desde \`@/auth\``,
    },
  });

  await prisma.codexEntry.upsert({
    where: { slug: 'prisma-migrate-checklist' },
    update: {},
    create: {
      title: 'Prisma Migrate: checklist local',
      slug: 'prisma-migrate-checklist',
      excerpt: 'Comandos útiles y buenas prácticas con Docker.',
      tech: 'PostgreSQL',
      tags: ['prisma','db','migrations'],
      published: true,
      content: `# Checklist de migraciones

- \`docker ps\` (DB arriba)
- \`npx prisma validate\`
- \`npx prisma migrate dev -n "mensaje"\`
- \`npx prisma studio\` para verificar`,
    },
  });

  console.log('✅ Seed listo: admin, recruiter, candidate (perfil extendido), 1 vacante y 2 artículos de Codex.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
