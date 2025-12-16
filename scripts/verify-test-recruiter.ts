// scripts/verify-test-recruiter.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "recruiter.test@tasktest.com" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      location: true,
      phone: true,
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
          domain: true,
          billingPlan: true,
          city: true,
          country: true,
        },
      },
      recruiterProfile: {
        select: {
          id: true,
          company: true,
          website: true,
          phone: true,
          status: true,
        },
      },
      createdAt: true,
    },
  });

  if (!user) {
    console.log("❌ User not found");
    return;
  }

  console.log("✅ Test Recruiter Found:\n");
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

  if (user.company) {
    console.log("\n🏢 Company:");
    console.log("   Name:", user.company.name);
    console.log("   Domain:", user.company.domain);
    console.log("   Billing Plan:", user.company.billingPlan);
    console.log("   Location:", user.company.city + ", " + user.company.country);
    console.log("   Company ID:", user.company.id);
  }

  if (user.recruiterProfile) {
    console.log("\n👔 Recruiter Profile:");
    console.log("   Status:", user.recruiterProfile.status);
    console.log("   Company:", user.recruiterProfile.company);
    console.log("   Website:", user.recruiterProfile.website || "Not set");
    console.log("   Phone:", user.recruiterProfile.phone || "Not set");
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
