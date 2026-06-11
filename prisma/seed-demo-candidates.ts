/**
 * seed-demo-candidates.ts — v3 (slugs reales de taxonomía)
 * Uso: npx tsx prisma/seed-demo-candidates.ts
 *
 * Slugs confirmados desde la UI:
 * Skills: "salesforce-lightning-platform", "salesforce-visualforce", "rest-apis", "java", "heroku", "oracle-apex"
 * Idiomas: "espanol" (Español), "ingles" (Inglés)
 */

import { PrismaClient, ApplicationStatus, ApplicationInterest } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const JOB_ID = "cmohxbgve000m30lb9w7togzs";
const DEFAULT_PASSWORD = "Demo1234!";

// Skills requeridas por la vacante (slugs reales confirmados)
// Apex → buscar "apex", Visualforce → "salesforce-visualforce",
// Lightning Components → "salesforce-lightning-platform", APIs → "rest-apis"
const SKILL_APEX            = "apex";
const SKILL_VISUALFORCE     = "salesforce-visualforce";
const SKILL_LIGHTNING       = "salesforce-lightning-platform";
const SKILL_REST_APIS       = "rest-apis";
const SKILL_JAVA            = "java";
const SKILL_HEROKU          = "heroku";
const SKILL_ORACLE_APEX     = "oracle-apex";

const demoCandidates = [
  {
    email: "carlos.mendoza.sf@example.com",
    name: "Carlos Mendoza",
    firstName: "Carlos",
    lastName: "Mendoza",
    location: "Ciudad de México, México",
    city: "Ciudad de México",
    cityNorm: "ciudad-de-mexico",
    country: "MX" as const,
    phone: "+525512345678",
    linkedin: "https://linkedin.com/in/carlos-mendoza-sf",
    github: "https://github.com/cmendoza",
    yearsExperience: 5,
    // Tiene las 4 skills requeridas → match alto
    skillSlugs: [SKILL_APEX, SKILL_VISUALFORCE, SKILL_LIGHTNING, SKILL_REST_APIS],
    languageSlugs: ["espanol", "ingles"],
    languageLevels: ["NATIVE", "PROFESSIONAL"] as const,
    status: "REVIEWING" as ApplicationStatus,
    interest: "ACCEPTED" as ApplicationInterest,
    coverLetter: "5 años desarrollando en Salesforce. Especialización en Apex, Visualforce y Lightning Components. He implementado soluciones CRM para empresas Fortune 500 en México.",
  },
  {
    email: "sofia.ramirez.crm@example.com",
    name: "Sofía Ramírez",
    firstName: "Sofía",
    lastName: "Ramírez",
    location: "Guadalajara, Jalisco, México",
    city: "Guadalajara",
    cityNorm: "guadalajara",
    country: "MX" as const,
    phone: "+523312345678",
    linkedin: "https://linkedin.com/in/sofia-ramirez-crm",
    github: null,
    yearsExperience: 3,
    // Tiene 3 de 4 skills requeridas → match medio
    skillSlugs: [SKILL_APEX, SKILL_LIGHTNING, SKILL_REST_APIS],
    languageSlugs: ["espanol", "ingles"],
    languageLevels: ["NATIVE", "CONVERSATIONAL"] as const,
    status: "SUBMITTED" as ApplicationStatus,
    interest: "REVIEW" as ApplicationInterest,
    coverLetter: "Certificada Salesforce Administrator y Platform Developer I. Experiencia en implementaciones de Sales Cloud y Service Cloud en el sector retail.",
  },
  {
    email: "jorge.villa.dev@example.com",
    name: "Jorge Villanueva",
    firstName: "Jorge",
    lastName: "Villanueva",
    location: "Monterrey, Nuevo León, México",
    city: "Monterrey",
    cityNorm: "monterrey",
    country: "MX" as const,
    phone: "+528112345678",
    linkedin: "https://linkedin.com/in/jorge-villanueva-dev",
    github: "https://github.com/jvillanueva",
    yearsExperience: 7,
    // Tiene las 4 skills requeridas + extras → match alto
    skillSlugs: [SKILL_APEX, SKILL_VISUALFORCE, SKILL_LIGHTNING, SKILL_REST_APIS, SKILL_JAVA],
    languageSlugs: ["espanol", "ingles"],
    languageLevels: ["NATIVE", "PROFESSIONAL"] as const,
    status: "INTERVIEW" as ApplicationStatus,
    interest: "ACCEPTED" as ApplicationInterest,
    coverLetter: "Senior Salesforce Developer con 7 años de experiencia. Especialista en integraciones y desarrollo de soluciones enterprise. Certificaciones: PD2, Advanced Administrator.",
  },
  {
    email: "ana.torres.sf@example.com",
    name: "Ana Torres",
    firstName: "Ana",
    lastName: "Torres",
    location: "Querétaro, Querétaro, México",
    city: "Querétaro",
    cityNorm: "queretaro",
    country: "MX" as const,
    phone: "+524421234567",
    linkedin: "https://linkedin.com/in/ana-torres-salesforce",
    github: null,
    yearsExperience: 2,
    // Tiene 2 de 4 skills requeridas → match bajo-medio
    skillSlugs: [SKILL_APEX, SKILL_VISUALFORCE],
    languageSlugs: ["espanol", "ingles"],
    languageLevels: ["NATIVE", "BASIC"] as const,
    status: "SUBMITTED" as ApplicationStatus,
    interest: "MAYBE" as ApplicationInterest,
    coverLetter: "Desarrolladora junior con 2 años en Salesforce. Manejo de Apex y Visualforce. Actualmente cursando certificación Platform Developer I.",
  },
  {
    email: "miguel.orozco.cto@example.com",
    name: "Miguel Orozco",
    firstName: "Miguel",
    lastName: "Orozco",
    location: "Ciudad de México, México",
    city: "Ciudad de México",
    cityNorm: "ciudad-de-mexico",
    country: "MX" as const,
    phone: "+525598765432",
    linkedin: "https://linkedin.com/in/miguel-orozco-sf",
    github: "https://github.com/morozco",
    yearsExperience: 10,
    // Tiene las 4 requeridas + extras → match más alto
    skillSlugs: [SKILL_APEX, SKILL_VISUALFORCE, SKILL_LIGHTNING, SKILL_REST_APIS, SKILL_HEROKU, SKILL_JAVA, SKILL_ORACLE_APEX],
    languageSlugs: ["espanol", "ingles"],
    languageLevels: ["NATIVE", "PROFESSIONAL"] as const,
    status: "REVIEWING" as ApplicationStatus,
    interest: "ACCEPTED" as ApplicationInterest,
    coverLetter: "Salesforce Architect con 10 años. Lideré más de 30 implementaciones en LATAM. Certificaciones: Application Architect, System Architect, PD2, Advanced Admin.",
  },
];

async function findTerm(kind: "SKILL" | "LANGUAGE", slug: string) {
  return prisma.taxonomyTerm.findFirst({
    where: {
      kind,
      OR: [
        { slug: { contains: slug, mode: "insensitive" } },
        { label: { contains: slug, mode: "insensitive" } },
      ],
    },
  });
}

async function main() {
  console.log("🌱 Iniciando seed v3 (slugs reales)...\n");

  const job = await prisma.job.findUnique({
    where: { id: JOB_ID },
    select: { id: true, title: true },
  });
  if (!job) throw new Error(`❌ No se encontró la vacante con ID: ${JOB_ID}`);
  console.log(`✅ Vacante: "${job.title}"\n`);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const candidate of demoCandidates) {
    console.log(`👤 ${candidate.name}...`);

    const user = await prisma.user.upsert({
      where: { email: candidate.email },
      update: {
        name: candidate.name,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        location: candidate.location,
        city: candidate.city,
        cityNorm: candidate.cityNorm,
        country: candidate.country,
        phone: candidate.phone,
        linkedin: candidate.linkedin,
        github: candidate.github,
        yearsExperience: candidate.yearsExperience,
        profileCompleted: true,
        profileCompletion: 85,
      },
      create: {
        email: candidate.email,
        name: candidate.name,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        passwordHash,
        role: "CANDIDATE",
        location: candidate.location,
        city: candidate.city,
        cityNorm: candidate.cityNorm,
        country: candidate.country,
        phone: candidate.phone,
        linkedin: candidate.linkedin,
        github: candidate.github,
        yearsExperience: candidate.yearsExperience,
        profileCompleted: true,
        profileCompletion: 85,
        emailVerified: new Date(),
      },
    });

    // Skills
    let skillsLinked = 0;
    for (const slug of candidate.skillSlugs) {
      const term = await findTerm("SKILL", slug);
      if (!term) { console.log(`   ⚠️  Skill no encontrada: "${slug}"`); continue; }
      await prisma.candidateSkill.upsert({
        where: { userId_termId: { userId: user.id, termId: term.id } },
        update: {},
        create: { userId: user.id, termId: term.id },
      });
      skillsLinked++;
    }

    // Idiomas
    let langsLinked = 0;
    for (let i = 0; i < candidate.languageSlugs.length; i++) {
      const term = await findTerm("LANGUAGE", candidate.languageSlugs[i]);
      if (!term) { console.log(`   ⚠️  Idioma no encontrado: "${candidate.languageSlugs[i]}"`); continue; }
      await prisma.candidateLanguage.upsert({
        where: { userId_termId: { userId: user.id, termId: term.id } },
        update: { level: candidate.languageLevels[i] },
        create: { userId: user.id, termId: term.id, level: candidate.languageLevels[i] },
      });
      langsLinked++;
    }

    // Application
    const app = await prisma.application.upsert({
      where: { candidateId_jobId: { candidateId: user.id, jobId: JOB_ID } },
      update: {
        status: candidate.status,
        recruiterInterest: candidate.interest,
        coverLetter: candidate.coverLetter,
      },
      create: {
        jobId: JOB_ID,
        candidateId: user.id,
        status: candidate.status,
        recruiterInterest: candidate.interest,
        coverLetter: candidate.coverLetter,
        submittedAt: new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000),
        source: "demo_seed",
      },
    });

    console.log(`   ✅ skills: ${skillsLinked}/${candidate.skillSlugs.length} | idiomas: ${langsLinked} | status: ${app.status}\n`);
  }

  console.log("🎉 ¡Seed v3 completado!");
  console.log(`🔑 Contraseña: ${DEFAULT_PASSWORD}`);
  console.log(`🔗 /dashboard/jobs/${JOB_ID}/applications\n`);
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });