import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function flag(name: string) {
  return process.argv.includes(`--${name}`);
}

function value(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const email = value("email")?.trim().toLowerCase();
  const companyId = value("company-id")?.trim();
  const name = value("name")?.trim();
  const approve = flag("approve");
  const correctCompany = flag("correct-company");

  if (!email || !companyId) {
    throw new Error(
      "Uso: npm run pilot:recruiter -- --email=... --company-id=... [--name=...] [--approve] [--correct-company]"
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, domain: true },
  });
  if (!company) throw new Error("companyId no existe; no se modificó ningún dato.");

  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      recruiterProfile: { select: { companyId: true, status: true } },
    },
  });

  if (existing?.role === "ADMIN") {
    throw new Error("La herramienta no modifica cuentas ADMIN.");
  }
  if (existing && existing.role !== "RECRUITER") {
    throw new Error(`El email ya pertenece a un usuario ${existing.role}; no se modificó.`);
  }
  const currentCompanyId = existing?.recruiterProfile?.companyId;
  if (currentCompanyId && currentCompanyId !== company.id && !correctCompany) {
    throw new Error(
      `Asociación existente ${currentCompanyId}. Revisa los IDs y repite con --correct-company para corregirla explícitamente.`
    );
  }

  const password = process.env.PILOT_RECRUITER_PASSWORD;
  if (!existing && (!password || password.length < 12)) {
    throw new Error(
      "Para crear un usuario define PILOT_RECRUITER_PASSWORD con al menos 12 caracteres."
    );
  }

  // bcrypt is intentionally completed before opening the database transaction.
  const passwordHash = existing ? null : await hash(password!, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = existing
      ? existing
      : await tx.user.create({
          data: {
            email,
            name: name || email.split("@")[0],
            passwordHash: passwordHash!,
            role: "RECRUITER",
            emailVerified: new Date(),
          },
          select: { id: true, role: true },
        });

    const profile = await tx.recruiterProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        companyId: company.id,
        companyName: company.name,
        phone: null,
        status: approve ? "APPROVED" : "PENDING",
        approvedAt: approve ? new Date() : null,
        approvedBy: approve ? "founder-cli" : null,
      },
      update: {
        ...(currentCompanyId !== company.id
          ? { companyId: company.id, companyName: company.name }
          : {}),
        ...(approve
          ? { status: "APPROVED" as const, approvedAt: new Date(), approvedBy: "founder-cli" }
          : {}),
      },
      select: { companyId: true, companyName: true, status: true },
    });

    return { userId: user.id, email, profile };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
