// scripts/create-test-candidate.ts
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createEmailVerifyToken } from "../lib/tokens";

const prisma = new PrismaClient();

async function main() {
  const testEmail = "candidate.test@example.com";
  const testPassword = "TestCandidate123!";
  const testName = "Test Candidate";

  console.log("🔨 Creating test candidate account...\n");

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: testEmail },
    select: { id: true, emailVerified: true },
  });

  if (existing) {
    console.log("⚠️  User already exists with email:", testEmail);
    console.log("   ID:", existing.id);
    console.log("   Email Verified:", existing.emailVerified ? "✓" : "✗");

    const shouldDelete = process.argv.includes("--delete");
    if (shouldDelete) {
      console.log("\n🗑️  Deleting existing user...");
      await prisma.user.delete({ where: { id: existing.id } });
      console.log("✓ Deleted\n");
    } else {
      console.log("\nRun with --delete flag to remove and recreate");
      process.exit(0);
    }
  }

  // Create user
  const passwordHash = await hash(testPassword, 10);

  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: testName,
      passwordHash,
      role: "CANDIDATE",
      location: "Monterrey, NL, Mexico",
      country: "MX",
      city: "Monterrey",
      admin1: "Nuevo León",
      phone: "+528112345678",
      // emailVerified is null by default (needs verification)
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
    },
  });

  console.log("✅ Test candidate created:");
  console.log("   ID:", user.id);
  console.log("   Email:", user.email);
  console.log("   Name:", user.name);
  console.log("   Role:", user.role);
  console.log("   Email Verified:", user.emailVerified || "Not yet");

  // Generate verification token
  const token = await createEmailVerifyToken({ email: user.email }, 60);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

  console.log("\n📧 Email Verification:");
  console.log("   Since EMAIL_ENABLED=false, visit this URL to verify:");
  console.log("   " + verifyUrl);

  // Optionally auto-verify
  const shouldAutoVerify = process.argv.includes("--verify");
  if (shouldAutoVerify) {
    console.log("\n🔓 Auto-verifying email...");
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
    console.log("✓ Email verified!");
  }

  console.log("\n🔐 Login Credentials:");
  console.log("   Email:", testEmail);
  console.log("   Password:", testPassword);
  console.log("   Login URL: http://localhost:3000/auth/signin?role=CANDIDATE");

  console.log("\n✨ Done!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
