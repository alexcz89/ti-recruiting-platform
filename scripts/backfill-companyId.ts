import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1) Buscar por nombre (no-único) y crear si no existe
  let company = await prisma.company.findFirst({ where: { name: 'Default Company' } })
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Default Company',
        country: 'MX',
        city: 'Monterrey',
        domain: 'default.local',
      },
    })
  }

  // 2) Backfill: poner companyId a todas las Jobs que estén en NULL
  const updated = await prisma.job.updateMany({
    where: { companyId: null },
    data: { companyId: company.id },
  })

  console.log(`✅ Backfill listo: ${updated.count} Job(s) actualizadas con companyId=${company.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
