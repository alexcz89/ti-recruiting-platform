// scripts/fix-skill-taxonomy-slugs.mjs
//
// Migración one-off que acompaña a lib/shared/slugify-taxonomy.ts:
//   1. Renombra in-place los slugs que cambiaron con el nuevo slugifier
//      (F# ocupaba "f", C# (Unity) era "c-unity", etc.), conservando id y relaciones.
//   2. Consolida términos SKILL duplicados (nodejs/node-js, vuejs/vue-js, ...)
//      migrando candidateSkills, requiredByJobs, candidateBadges y badgeExams
//      del perdedor al ganador antes de borrar el duplicado.
//   3. Crea los términos que nunca llegaron a la BD por la colisión de slug
//      (C++ y C# colisionaban con C en el slug "c"; Embedded C++ con Embedded C).
//   4. Verifica que no queden duplicados por label normalizado en kind SKILL.
//
// Uso:  node scripts/fix-skill-taxonomy-slugs.mjs [--dry-run]
// Idempotente: puede correrse varias veces sin efectos adicionales.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");
const KIND = "SKILL";

// Slug viejo → slug nuevo (mismo término, solo cambia el slug).
// El label esperado protege contra renombrar un término que no es el que creemos.
const RENAMES = [
  { from: "f", to: "fsharp", expectLabel: "F#" },
  { from: "c-unity", to: "csharp-unity", expectLabel: "C# (Unity)" },
  { from: "c-unreal", to: "cpp-unreal", expectLabel: "C++ (Unreal)" },
  { from: "x-dynamics", to: "xpp-dynamics", expectLabel: "X++ (Dynamics)" },
];

// Duplicados: el perdedor se funde en el ganador y se borra.
const MERGES = [
  { loser: "node-js", winner: "nodejs", label: "Node.js" },
  { loser: "vuejs", winner: "vue-js", label: "Vue.js" },
  { loser: "nextjs", winner: "next-js", label: "Next.js" },
  { loser: "aspnet-core", winner: "asp-net-core", label: "ASP.NET Core" },
  { loser: "ab-testing", winner: "a-b-testing", label: "A/B Testing" },
  { loser: "argocd", winner: "argo-cd", label: "Argo CD" },
];

// Términos del catálogo que la colisión de slugs dejó fuera de la BD.
const CREATE_IF_MISSING = [
  { slug: "cpp", label: "C++" },
  { slug: "csharp", label: "C#" },
  { slug: "embedded-cpp", label: "Embedded C++" },
];

function findTerm(slug) {
  return prisma.taxonomyTerm.findUnique({
    where: { kind_slug: { kind: KIND, slug } },
    select: { id: true, slug: true, label: true },
  });
}

async function mergeTerm(tx, loser, winner) {
  // Relaciones con unique que incluye termId: si el ganador ya tiene la fila
  // equivalente, la del perdedor se borra; si no, se re-apunta.
  const uniqueRelations = [
    { name: "candidateSkill", model: tx.candidateSkill, keys: ["userId"] },
    { name: "candidateLanguage", model: tx.candidateLanguage, keys: ["userId"] },
    { name: "jobRequiredSkill", model: tx.jobRequiredSkill, keys: ["jobId"] },
    { name: "candidateBadge", model: tx.candidateBadge, keys: ["candidateId", "level"] },
  ];

  for (const { name, model, keys } of uniqueRelations) {
    const rows = await model.findMany({ where: { termId: loser.id } });
    for (const row of rows) {
      const conflictWhere = { termId: winner.id };
      for (const k of keys) conflictWhere[k] = row[k];
      const conflict = await model.findFirst({ where: conflictWhere, select: { id: true } });
      if (conflict) {
        console.log(`    · fila duplicada en ambos términos → se borra la del perdedor (id ${row.id})`);
        await model.delete({ where: { id: row.id } });
      } else {
        await model.update({ where: { id: row.id }, data: { termId: winner.id } });
      }
    }
    if (rows.length) console.log(`    · ${rows.length} fila(s) migradas en ${name}`);
  }

  // CandidateCredential no tiene unique por (userId, termId): update directo.
  const creds = await tx.candidateCredential.updateMany({
    where: { termId: loser.id },
    data: { termId: winner.id },
  });
  if (creds.count) console.log(`    · ${creds.count} candidateCredential migradas`);

  // Exámenes de badge: unique [badgeTermId, badgeLevel]. Un choque aquí implica
  // dos exámenes reales para el mismo skill+nivel → requiere decisión humana.
  const exams = await tx.assessmentTemplate.findMany({
    where: { badgeTermId: loser.id },
    select: { id: true, slug: true, badgeLevel: true },
  });
  for (const exam of exams) {
    const conflict = await tx.assessmentTemplate.findFirst({
      where: { badgeTermId: winner.id, badgeLevel: exam.badgeLevel },
      select: { slug: true },
    });
    if (conflict) {
      throw new Error(
        `Conflicto de badge exam: '${exam.slug}' y '${conflict.slug}' cubren el mismo skill+nivel. Resolver a mano.`
      );
    }
    await tx.assessmentTemplate.update({
      where: { id: exam.id },
      data: { badgeTermId: winner.id },
    });
    console.log(`    · badge exam '${exam.slug}' re-apuntado al ganador`);
  }

  await tx.taxonomyTerm.delete({ where: { id: loser.id } });
}

async function main() {
  if (DRY) console.log("== DRY RUN: no se escribe nada ==\n");

  console.log("1) Renombres de slug in-place");
  for (const { from, to, expectLabel } of RENAMES) {
    const term = await findTerm(from);
    if (!term) {
      console.log(`  - '${from}': no existe (ya migrado u omitido)`);
      continue;
    }
    if (term.label !== expectLabel) {
      console.log(`  ! '${from}' tiene label '${term.label}' (se esperaba '${expectLabel}') — se omite`);
      continue;
    }
    const target = await findTerm(to);
    if (target) {
      console.log(`  - '${from}' → '${to}': el destino ya existe, se fusiona`);
      if (!DRY) await prisma.$transaction((tx) => mergeTerm(tx, term, target));
    } else {
      console.log(`  - '${from}' → '${to}' (label '${term.label}')`);
      if (!DRY) {
        await prisma.taxonomyTerm.update({ where: { id: term.id }, data: { slug: to } });
      }
    }
  }

  console.log("\n2) Consolidación de duplicados");
  for (const { loser, winner, label } of MERGES) {
    const loserTerm = await findTerm(loser);
    const winnerTerm = await findTerm(winner);
    if (!loserTerm) {
      console.log(`  - '${loser}': no existe (ya consolidado)`);
      continue;
    }
    if (!winnerTerm) {
      console.log(`  - '${loser}' → '${winner}': el ganador no existe, se renombra el perdedor`);
      if (!DRY) {
        await prisma.taxonomyTerm.update({
          where: { id: loserTerm.id },
          data: { slug: winner, label },
        });
      }
      continue;
    }
    console.log(`  - '${loser}' (${loserTerm.id}) → '${winner}' (${winnerTerm.id})`);
    if (!DRY) {
      await prisma.$transaction((tx) => mergeTerm(tx, loserTerm, winnerTerm));
      await prisma.taxonomyTerm.update({ where: { id: winnerTerm.id }, data: { label } });
    }
  }

  console.log("\n3) Términos perdidos por colisión de slug");
  for (const { slug, label } of CREATE_IF_MISSING) {
    const existing = await findTerm(slug);
    if (existing) {
      console.log(`  - '${slug}' ya existe (label '${existing.label}')`);
      continue;
    }
    console.log(`  - creando '${slug}' (label '${label}')`);
    if (!DRY) {
      await prisma.taxonomyTerm.create({
        data: { kind: KIND, slug, label, aliases: [] },
      });
    }
  }

  console.log("\n4) Verificación: duplicados por label normalizado (kind SKILL)");
  const all = await prisma.taxonomyTerm.findMany({
    where: { kind: KIND },
    select: { id: true, slug: true, label: true },
  });
  const norm = (s) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9+#]/g, "");
  const byNorm = new Map();
  for (const t of all) {
    const k = norm(t.label);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(t);
  }
  let dupes = 0;
  for (const [k, list] of byNorm) {
    if (list.length > 1) {
      dupes++;
      console.log(`  ! '${k}': ${list.map((t) => `${t.slug} (${t.label})`).join("  vs  ")}`);
    }
  }
  console.log(dupes === 0 ? "  ✅ sin duplicados" : `  ⚠ ${dupes} grupo(s) duplicados`);
  console.log(`  Total SKILL terms: ${all.length}`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
