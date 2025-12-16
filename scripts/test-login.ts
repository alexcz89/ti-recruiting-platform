// scripts/test-login.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function testLogin(email: string, password: string) {
  console.log("🔐 Testing login credentials...\n");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log();

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      emailVerified: true,
      companyId: true,
    },
  });

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log("✅ User found:");
  console.log("   ID:", user.id);
  console.log("   Name:", user.name);
  console.log("   Role:", user.role);
  console.log("   Email Verified:", user.emailVerified ? "Yes ✓" : "No ✗");
  console.log();

  // Test password
  if (!user.passwordHash) {
    console.log("❌ No password set for this user");
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (isValid) {
    console.log("✅ Password is correct!");
    console.log();
    console.log("🎉 Login would succeed!");
    console.log();
    console.log("NextAuth would return:");
    console.log({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  } else {
    console.log("❌ Password is incorrect");
  }
}

const email = process.argv[2] || "candidate.test@example.com";
const password = process.argv[3] || "TestCandidate123!";

testLogin(email, password)
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
