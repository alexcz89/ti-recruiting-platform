/**
 * seed-job-required-skills.ts
 *
 * Vincula las skills requeridas de la vacante Salesforce Developer
 * a la tabla JobRequiredSkill usando TaxonomyTerm.
 *
 * Uso: npx tsx prisma/seed-job-required-skills.ts
 *
 * Esto habilita el AI Match score en la lista de candidatos.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const JOB_ID = "cmohxbgve000m30lb9w7togzs";

// Skills requeridas y deseables de la vacante (confirmadas desde la UI)
// must: true = Requerida | must: false = Deseable
const JOB_SKILLS = [
  { slug: "apex",                       must: true,  weight: 3 },
  { slug: "salesforce-visualforce",     must: true,  weight: 3 },
  { slug: "salesforce-lightning-platform", must: true,  weight: 3 },
  { slug: "rest-apis",                  must: true,  weight: 2 },
  { slug: "heroku",                     must: false, weight: 1 },
  { slug: "java",                       must: false, weight: 1 },
  { slug: "oracle-apex",                must: false, weight: 1 },
];

async function main() {
  console.log("🔧 Seeding JobRequiredSkill para vacante Salesforce Developer...\n");

  // Verificar que el job existe
  const job = await prisma.job.findUnique({
    where: { id: JOB_ID },
    select: { id: true, title: true, requiredSkills: { select: { id: true } } },
  });

  if (!job) throw new Error(`❌ No se encontró la vacante: ${JOB_ID}`);
  console.log(`✅ Vacante: "${job.title}"`);
  console.log(`   JobRequiredSkills actuales: ${job.requiredSkills.length}\n`);

  let linked = 0;
  let skipped = 0;

  for (const skill of JOB_SKILLS) {
    // Buscar el TaxonomyTerm
    const term = await prisma.taxonomyTerm.findFirst({
      where: {
        kind: "SKILL",
        OR: [
          { slug: { contains: skill.slug, mode: "insensitive" } },
          { label: { contains: skill.slug, mode: "insensitive" } },
        ],
      },
      select: { id: true, slug: true, label: true },
    });

    if (!term) {
      console.log(`   ⚠️  Term no encontrado para slug: "${skill.slug}" — omitido`);
      skipped++;
      continue;
    }

    // Upsert en JobRequiredSkill
    await prisma.jobRequiredSkill.upsert({
      where: { jobId_termId: { jobId: JOB_ID, termId: term.id } },
      update: { must: skill.must, weight: skill.weight },
      create: {
        jobId: JOB_ID,
        termId: term.id,
        must: skill.must,
        weight: skill.weight,
      },
    });

    const tag = skill.must ? "✅ Requerida" : "🔹 Deseable";
    console.log(`   ${tag}: "${term.label}" (${term.slug}) [weight: ${skill.weight}]`);
    linked++;
  }

  console.log(`\n🎉 Listo! Skills vinculadas: ${linked} | Omitidas: ${skipped}`);
  console.log(`\n💡 Ahora recarga la página de aplicaciones — el AI Match debería mostrar scores.`);
  console.log(`🔗 /dashboard/jobs/${JOB_ID}/applications\n`);
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });