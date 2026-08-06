import { PrismaClient } from "@prisma/client";
import { seedTaskioCodingChallenge } from "../prisma/seeds/taskio-coding-challenge";

const prisma = new PrismaClient();

seedTaskioCodingChallenge(prisma)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });