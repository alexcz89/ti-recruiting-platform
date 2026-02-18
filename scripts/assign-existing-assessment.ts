// scripts/assign-existing-assessment.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔗 Asignando assessment existente a job FullStack...\n');

  // Buscar el job "Desarrollador FullStack"
  const job = await prisma.job.findFirst({
    where: {
      title: { contains: 'FullStack', mode: 'insensitive' }
    },
    select: { id: true, title: true }
  });

  if (!job) {
    console.error('❌ No se encontró el job "Desarrollador FullStack"');
    process.exit(1);
  }

  console.log(`✅ Job encontrado: ${job.title}`);
  console.log(`   ID: ${job.id}\n`);

  // Buscar el assessment más reciente (el que acabas de crear)
  const template = await prisma.assessmentTemplate.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, createdAt: true }
  });

  if (!template) {
    console.error('❌ No se encontró ningún assessment template');
    console.log('💡 Ejecuta: npx tsx scripts/full-test-coding-system.ts');
    process.exit(1);
  }

  console.log(`✅ Assessment encontrado: ${template.title}`);
  console.log(`   ID: ${template.id}`);
  console.log(`   Creado: ${template.createdAt}\n`);

  // Verificar si ya está asignado
  const existing = await prisma.jobAssessment.findFirst({
    where: {
      jobId: job.id,
      templateId: template.id
    }
  });

  if (existing) {
    console.log('⚠️  Este assessment ya está asignado a este job');
    console.log('✅ No se necesita hacer nada más\n');
    return;
  }

  // Asignar assessment al job
  await prisma.jobAssessment.create({
    data: {
      jobId: job.id,
      templateId: template.id,
      isRequired: true,
      minScore: 70,
    }
  });

  console.log('🎉 ¡Assessment asignado exitosamente!\n');
  console.log('📊 Detalles:');
  console.log(`  Job: ${job.title}`);
  console.log(`  Assessment: ${template.title}`);
  console.log(`  Required: Sí`);
  console.log(`  Puntuación mínima: 70%`);
  console.log('\n✅ Ahora recarga la página de applications y verás "Enviar assessment"\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });