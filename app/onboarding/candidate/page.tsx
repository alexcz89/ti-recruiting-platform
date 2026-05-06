// app/onboarding/candidate/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import CandidateOnboardingPage from "./PageClient";

export const dynamic = "force-dynamic";

export default async function OnboardingCandidateServerPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user) redirect("/auth/signin");
  if (user.role !== "CANDIDATE") redirect("/dashboard");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      onboardingStep: true,
      profileCompleted: true,
      phone: true,
      candidateSkills: {
        select: { term: { select: { label: true } } }, // ← label, no name
        take: 30,
      },
      candidateCredentials: {
        select: { term: { select: { label: true } } }, // ← label, no name
        take: 20,
      },
    },
  });

  if (!dbUser) redirect("/auth/signin");
  if (dbUser.profileCompleted) redirect("/jobs");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4 py-8">
      <CandidateOnboardingPage
        userName={dbUser.name ?? ""}
        initialStep={dbUser.onboardingStep ?? 1}
        initialPhone={dbUser.phone ?? ""}
        initialSkills={dbUser.candidateSkills.map((s) => s.term.label)}       // ← label
        initialCerts={dbUser.candidateCredentials.map((c) => c.term.label)}   // ← label
      />
    </div>
  );
}