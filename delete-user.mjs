import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUser() {
  try {
    const result = await prisma.user.deleteMany({
      where: { email: 'alejandro.cz89@gmail.com' }
    });
    console.log(`✅ Eliminados ${result.count} usuario(s) con email alejandro.cz89@gmail.com`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUser();
