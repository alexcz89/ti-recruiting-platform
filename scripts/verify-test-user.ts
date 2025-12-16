// scripts/verify-test-user.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "candidate.test@example.com" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      location: true,
      phone: true,
      createdAt: true,
    },
  });

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log("✅ Test Candidate Found:\n");
  console.log("📧 Email:", user.email);
  console.log("👤 Name:", user.name);
  console.log("🎭 Role:", user.role);
  console.log("✓ Email Verified:", user.emailVerified ? "Yes" : "No");
  if (user.emailVerified) {
    console.log("   Verified at:", user.emailVerified.toISOString());
  }
  console.log("📍 Location:", user.location || "Not set");
  console.log("📱 Phone:", user.phone || "Not set");
  console.log("🆔 User ID:", user.id);
  console.log("📅 Created:", user.createdAt.toISOString());
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
