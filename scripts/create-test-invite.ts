// scripts/create-test-invite.ts
/**
 * Script para crear un invite de assessment para testing
 * 
 * Ejecutar con: npx tsx scripts/create-test-invite.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🔗 Creando invite de assessment para testing...\n');

  // 1. Buscar el candidato (Armando Mendez Zertuche)
  const candidate = await prisma.user.findUnique({
    where: { email: 'amendez@gmail.com' },
  });

  if (!candidate) {
    console.error('❌ Candidato no encontrado: amendez@gmail.com');
    console.log('\n💡 Usa el email correcto del candidato o crea uno nuevo');
    process.exit(1);
  }

  console.log(`✅ Candidato encontrado: ${candidate.name} (${candidate.email})`);

  // 2. Buscar el template creado
  const template = await prisma.assessmentTemplate.findFirst({
    where: { 
      OR: [
        { slug: 'fullstack-coding-test' },
        { title: { contains: 'Full-Stack' } },
      ]
    },
  });

  if (!template) {
    console.error('❌ Template no encontrado');
    console.log('\n💡 Ejecuta primero: npx tsx scripts/seed-coding-question.ts');
    process.exit(1);
  }

  console.log(`✅ Template encontrado: ${template.title}`);

  // 3. Crear o buscar un job (necesario para application)
  let job = await prisma.job.findFirst({
    where: { status: 'OPEN' },
  });

  if (!job) {
    console.log('📝 Creando job de prueba...');
    
    // Buscar una company
    const company = await prisma.company.findFirst();
    
    if (!company) {
      console.error('❌ No hay companies en la base de datos');
      process.exit(1);
    }

    job = await prisma.job.create({
      data: {
        title: 'Full-Stack Developer - Test Job',
        companyId: company.id,
        location: 'Remote',
        employmentType: 'FULL_TIME',
        description: 'Job de prueba para testing de assessments',
        status: 'OPEN',
      },
    });
    
    console.log(`✅ Job creado: ${job.title}`);
  } else {
    console.log(`✅ Usando job existente: ${job.title}`);
  }

  // 4. Crear o buscar application
  let application = await prisma.application.findUnique({
    where: {
      candidateId_jobId: {
        candidateId: candidate.id,
        jobId: job.id,
      },
    },
  });

  if (!application) {
    console.log('📝 Creando application...');
    application = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        status: 'REVIEWING',
      },
    });
    console.log(`✅ Application creada`);
  } else {
    console.log(`✅ Usando application existente`);
  }

  // 5. Vincular template al job (JobAssessment)
  let jobAssessment = await prisma.jobAssessment.findUnique({
    where: {
      jobId_templateId: {
        jobId: job.id,
        templateId: template.id,
      },
    },
  });

  if (!jobAssessment) {
    console.log('📝 Vinculando assessment al job...');
    jobAssessment = await prisma.jobAssessment.create({
      data: {
        jobId: job.id,
        templateId: template.id,
        isRequired: true,
        minScore: 70,
        triggerAt: 'AFTER_APPLY',
      },
    });
    console.log(`✅ Assessment vinculado al job`);
  } else {
    console.log(`✅ Assessment ya estaba vinculado al job`);
  }

  // 6. Crear invite
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días

  // Verificar si ya existe un invite para este template y application
  const existingInvite = await prisma.assessmentInvite.findUnique({
    where: {
      applicationId_templateId: {
        applicationId: application.id,
        templateId: template.id,
      },
    },
  });

  let invite;
  if (existingInvite) {
    console.log('⚠️  Ya existe un invite para esta combinación, actualizando...');
    invite = await prisma.assessmentInvite.update({
      where: { id: existingInvite.id },
      data: {
        token,
        status: 'SENT',
        expiresAt,
      },
    });
  } else {
    invite = await prisma.assessmentInvite.create({
      data: {
        token,
        applicationId: application.id,
        jobId: job.id,
        candidateId: candidate.id,
        templateId: template.id,
        status: 'SENT',
        expiresAt,
        sentAt: new Date(),
      },
    });
  }

  console.log(`✅ Invite creado exitosamente\n`);

  // 7. Mostrar URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const assessmentUrl = `${baseUrl}/assessments/${template.id}?token=${token}`;

  console.log('🎉 ¡Listo! Usa esta URL para acceder al assessment:\n');
  console.log(`🔗 ${assessmentUrl}\n`);
  console.log('📋 Detalles:');
  console.log(`   Candidato: ${candidate.name} (${candidate.email})`);
  console.log(`   Template: ${template.title}`);
  console.log(`   Job: ${job.title}`);
  console.log(`   Token: ${token}`);
  console.log(`   Expira: ${expiresAt.toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });