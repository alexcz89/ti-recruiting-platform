// scripts/assign-assessment-to-job.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔗 Asignando assessment a job...\n');

  // Buscar el job "Desarrollador FullStack" (o el primero)
  const job = await prisma.job.findFirst({
    where: {
      OR: [
        { title: { contains: 'FullStack', mode: 'insensitive' } },
        { title: { contains: 'Full Stack', mode: 'insensitive' } },
      ]
    },
    select: { id: true, title: true }
  });

  if (!job) {
    console.error('❌ No se encontró el job "Desarrollador FullStack"');
    console.log('💡 Buscando el primer job disponible...\n');
    
    const firstJob = await prisma.job.findFirst({
      select: { id: true, title: true }
    });

    if (!firstJob) {
      console.error('❌ No hay jobs en la BD');
      process.exit(1);
    }

    console.log(`✅ Usando job: ${firstJob.title}\n`);
    await assignAssessment(firstJob.id, firstJob.title);
    return;
  }

  console.log(`✅ Job encontrado: ${job.title}\n`);
  await assignAssessment(job.id, job.title);
}

async function assignAssessment(jobId: string, jobTitle: string) {
  // Buscar el assessment "FullStack Developer - Complete"
  const template = await prisma.assessmentTemplate.findFirst({
    where: {
      OR: [
        { id: 'fullstack-complete-2024' },
        { title: { contains: 'FullStack', mode: 'insensitive' } },
      ]
    },
    select: { id: true, title: true }
  });

  if (!template) {
    console.error('❌ No se encontró ningún assessment template');
    console.log('💡 Ejecuta primero: npx tsx scripts/seed-assessment-templates.ts');
    process.exit(1);
  }

  console.log(`✅ Assessment encontrado: ${template.title}\n`);

  // Verificar si ya está asignado
  const existing = await prisma.jobAssessment.findFirst({
    where: {
      jobId,
      templateId: template.id
    }
  });

  if (existing) {
    console.log('⚠️  Este assessment ya está asignado a este job');
    return;
  }

  // Asignar assessment al job
  const jobAssessment = await prisma.jobAssessment.create({
    data: {
      jobId,
      templateId: template.id,
      isRequired: true,
      minScore: 70,
    }
  });

  console.log('✅ Assessment asignado exitosamente!\n');
  console.log('📊 Detalles:');
  console.log(`  Job: ${jobTitle}`);
  console.log(`  Assessment: ${template.title}`);
  console.log(`  Required: Sí`);
  console.log(`  Puntuación mínima: 70%`);
  console.log('\n💡 Ahora puedes enviar este assessment a candidatos desde el menú de acciones\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });