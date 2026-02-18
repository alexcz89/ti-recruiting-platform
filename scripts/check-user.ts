// scripts/check-user.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { id: 'cmlqsr0e60000e9sbxioorro8' },
  });

  if (!user) {
    console.log('❌ Usuario no encontrado');
    return;
  }

  console.log('\n✅ Usuario encontrado:', user.email);
  console.log('─'.repeat(60));

  // Mostrar campo por campo
  const entries = Object.entries(user);
  for (const [key, value] of entries) {
    const display = value === null ? '⬜ null' : `✅ ${JSON.stringify(value)}`;
    console.log(`  ${key.padEnd(25)} ${display}`);
  }

  console.log('─'.repeat(60));
  
  // Resumen de campos nulos vs llenos
  const nullFields = entries.filter(([, v]) => v === null).map(([k]) => k);
  const filledFields = entries.filter(([, v]) => v !== null).map(([k]) => k);
  
  console.log(`\n📊 Resumen:`);
  console.log(`  Campos llenos: ${filledFields.length}`);
  console.log(`  Campos nulos:  ${nullFields.length}`);
  console.log(`\n⬜ Campos nulos:`);
  nullFields.forEach(f => console.log(`  - ${f}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());