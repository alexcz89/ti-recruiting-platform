// app/profile/edit/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileForm from "../ProfileForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TaxonomyKind } from "@prisma/client";

// Catálogo central
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";

// Server action centralizada (datos + experiencias + idiomas)
import { updateProfileAction } from "../actions";

export const metadata = { title: "Mi perfil | Bolsa TI" };

/** Divide un nombre en {firstName, lastName1, lastName2} */
function splitName(full?: string | null) {
  const parts = (full ?? "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { firstName: "", lastName1: "", lastName2: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName1: "", lastName2: "" };
  if (parts.length === 2) return { firstName: parts[0], lastName1: parts[1], lastName2: "" };
  const lastName2 = parts.pop() as string;
  const lastName1 = parts.pop() as string;
  const firstName = parts.join(" ");
  return { firstName, lastName1, lastName2 };
}

/** Split E.164 -> parts con heurística simple (MX = últimos 10) */
function parseE164ToParts(e164?: string | null) {
  if (!e164) return { phoneCountry: "52", phoneLocal: "" };
  const digits = e164.replace(/\D+/g, "");
  if (digits.startsWith("52")) {
    return { phoneCountry: "52", phoneLocal: digits.slice(-10) };
  }
  let countryLen = 1;
  if (digits.length > 9) countryLen = 3;
  else if (digits.length > 8) countryLen = 2;
  const phoneCountry = digits.slice(0, countryLen) || "52";
  const phoneLocal = digits.slice(countryLen);
  return { phoneCountry, phoneLocal };
}

export default async function ProfileEditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin?callbackUrl=/profile/edit");

  const me = session.user as any;
  if (me.role === "RECRUITER" || me.role === "ADMIN") {
    redirect("/dashboard");
  }

  // Asegura registro (MVP)
  const dbUser = await prisma.user.upsert({
    where: { email: me.email! },
    update: {},
    create: {
      email: me.email!,
      name: me.name ?? me.email!.split("@")[0],
      passwordHash: "demo",
      role: "CANDIDATE",
    },
  });

  // Experiencias existentes (más reciente primero)
  const experiences = await prisma.workExperience.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, role: true, company: true, startDate: true, endDate: true, isCurrent: true },
  });

  // Idiomas del candidato (con label del término)
  const candidateLangs = await prisma.candidateLanguage.findMany({
    where: { userId: dbUser.id },
    include: {
      term: { select: { id: true, label: true } },
    },
    orderBy: [{ term: { label: "asc" } }],
  });

  // Opciones de idiomas para el combobox
  const languageOptions = await prisma.taxonomyTerm.findMany({
    where: { kind: TaxonomyKind.LANGUAGE },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });

  // Catálogos (server) → props del form
  const [skillsOptions, certOptions] = await Promise.all([
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  // Refetch del usuario con campos necesarios para iniciales
  const fullUser = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: {
      name: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      resumeUrl: true,
      skills: true,
      certifications: true,
    },
  });
  if (!fullUser) redirect("/profile");

  const parts = parseE164ToParts(fullUser.phone);
  const { firstName, lastName1, lastName2 } = splitName(fullUser.name);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Mi perfil</h1>
      <ProfileForm
        initial={{
          // nombre separado
          firstName,
          lastName1,
          lastName2,
          // demás campos
          email: fullUser.email,
          phoneCountry: parts.phoneCountry || "52",
          phoneLocal:
            parts.phoneCountry === "52"
              ? (parts.phoneLocal || "").replace(/\D+/g, "").slice(-10)
              : (parts.phoneLocal || "").replace(/\D+/g, "").slice(0, 15),
          location: fullUser.location ?? "",
          birthdate: fullUser.birthdate ? fullUser.birthdate.toISOString().slice(0, 10) : "",
          linkedin: fullUser.linkedin ?? "",
          github: fullUser.github ?? "",
          resumeUrl: fullUser.resumeUrl ?? "",
          skills: fullUser.skills ?? [],
          certifications: fullUser.certifications ?? [],
          // experiencias para el tab "Historial de trabajo" (YYYY-MM)
          experiences: experiences.map((e) => ({
            id: e.id,
            role: e.role,
            company: e.company,
            startDate: e.startDate.toISOString().slice(0, 7), // YYYY-MM
            endDate: e.endDate ? e.endDate.toISOString().slice(0, 7) : "",
            isCurrent: e.isCurrent,
          })),
          // idiomas con termId/label/level
          languages: candidateLangs.map((l) => ({
            termId: l.termId,
            label: l.term.label,
            level: l.level, // "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC"
          })),
        }}
        skillsOptions={skillsOptions}
        certOptions={certOptions}
        languageOptions={languageOptions} // ← combobox de idiomas
        onSubmit={updateProfileAction}
      />
    </main>
  );
}
