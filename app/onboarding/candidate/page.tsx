// app/onboarding/candidate/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/server/skills";
import CandidateOnboardingPage from "./PageClient";

export const dynamic = "force-dynamic";

export default async function OnboardingCandidateServerPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user) redirect("/auth/signin");
  if (user.role !== "CANDIDATE") redirect("/dashboard");

  const [dbUser, skillOptions, certOptions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        onboardingStep: true,
        profileCompleted: true,
        phone: true,
        location: true, // ← agregar
        candidateSkills: {
          select: { term: { select: { label: true } } },
          take: 30,
        },
        candidateCredentials: {
          select: { term: { select: { label: true } } },
          take: 20,
        },
      },
    }),
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  if (!dbUser) redirect("/auth/signin");
  if (dbUser.profileCompleted) redirect("/jobs");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4 py-8">
      <CandidateOnboardingPage
        userName={dbUser.name ?? ""}
        initialStep={dbUser.onboardingStep ?? 1}
        initialPhone={dbUser.phone ?? ""}
        initialLocation={dbUser.location ?? ""} // ← agregar
        initialSkills={dbUser.candidateSkills.map((s) => s.term.label)}
        initialCerts={dbUser.candidateCredentials.map((c) => c.term.label)}
        skillOptions={skillOptions}
        certOptions={certOptions}
      />
    </div>
  );
}