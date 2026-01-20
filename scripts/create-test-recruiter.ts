// scripts/create-test-recruiter.ts
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createEmailVerifyToken } from "../lib/server/tokens";

const prisma = new PrismaClient();

async function main() {
  const testEmail = "recruiter.test@tasktest.com";
  const testPassword = "TestRecruiter123!";
  const testName = "Test Recruiter";
  const companyName = "Task Test Company";

  console.log("🔨 Creating test recruiter account...\n");

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: testEmail },
    select: { id: true, emailVerified: true, companyId: true },
  });

  if (existing) {
    console.log("⚠️  User already exists with email:", testEmail);
    console.log("   ID:", existing.id);
    console.log("   Email Verified:", existing.emailVerified ? "✓" : "✗");
    console.log("   Company ID:", existing.companyId || "None");

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

  // Extract domain from email
  const domain = testEmail.split("@")[1];

  // Find or create company
  let company = await prisma.company.findUnique({
    where: { domain },
    select: { id: true, name: true, domain: true },
  });

  if (company) {
    console.log("✅ Found existing company:");
    console.log("   Name:", company.name);
    console.log("   Domain:", company.domain);
  } else {
    company = await prisma.company.create({
      data: {
        name: companyName,
        domain,
        country: "MX",
        city: "Monterrey",
        size: "11-50",
        billingPlan: "PRO",
      },
      select: { id: true, name: true, domain: true },
    });
    console.log("✅ Created new company:");
    console.log("   Name:", company.name);
    console.log("   Domain:", company.domain);
  }

  // Create user
  const passwordHash = await hash(testPassword, 10);

  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: testName,
      firstName: "Test",
      lastName: "Recruiter",
      passwordHash,
      role: "RECRUITER",
      companyId: company.id,
      location: "Monterrey, NL, Mexico",
      country: "MX",
      city: "Monterrey",
      admin1: "Nuevo León",
      phone: "+528187654321",
      // emailVerified is null by default (needs verification)
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      companyId: true,
    },
  });

  console.log("\n✅ Test recruiter created:");
  console.log("   ID:", user.id);
  console.log("   Email:", user.email);
  console.log("   Name:", user.name);
  console.log("   Role:", user.role);
  console.log("   Company ID:", user.companyId);
  console.log("   Email Verified:", user.emailVerified || "Not yet");

  // Create recruiter profile
  try {
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        company: company.name,
        website: "https://tasktest.com",
        phone: "+528187654321",
        status: "APPROVED", // Pre-approve for testing
      },
    });
    console.log("✅ Recruiter profile created (status: APPROVED)");
  } catch (err) {
    console.log("⚠️  Could not create recruiter profile (may already exist)");
  }

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
  console.log("   Login URL: http://localhost:3000/auth/signin?role=RECRUITER");

  console.log("\n🏢 Company Details:");
  console.log("   Name:", company.name);
  console.log("   Domain:", company.domain);
  console.log("   ID:", company.id);

  console.log("\n📊 Access:");
  console.log("   Dashboard: http://localhost:3000/dashboard/overview");
  console.log("   Jobs: http://localhost:3000/dashboard/jobs");
  console.log("   Candidates: http://localhost:3000/dashboard/candidates");

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
