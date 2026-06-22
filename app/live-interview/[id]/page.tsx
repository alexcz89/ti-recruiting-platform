// app/live-interview/[id]/page.tsx
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { notFound, redirect } from "next/navigation";
import CandidateLiveInterviewView from "./CandidateLiveInterviewView";

export default async function CandidateLiveInterviewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = session.user as { id: string; role: string };
  if (user.role !== "CANDIDATE") redirect("/dashboard");

  const interview = await prisma.liveInterview.findUnique({
    where: { id: params.id },
    include: {
      job: { select: { id: true, title: true } },
    },
  });

  if (!interview) notFound();
  if (interview.candidateId !== user.id) notFound();

  return (
    <CandidateLiveInterviewView
      interview={{
        id: interview.id,
        status: interview.status,
        challengeTitle: interview.challengeTitle,
        challengeDescription: interview.challengeDescription,
        apiName: interview.apiName,
        apiDocsUrl: interview.apiDocsUrl,
        videoCallUrl: interview.videoCallUrl,
        codingMinutes: interview.codingMinutes,
        qaMinutes: interview.qaMinutes,
        codingStartedAt: interview.codingStartedAt?.toISOString() ?? null,
        qaStartedAt: interview.qaStartedAt?.toISOString() ?? null,
        submittedAt: interview.submittedAt?.toISOString() ?? null,
        githubUrl: interview.githubUrl,
        liveUrl: interview.liveUrl,
        job: interview.job,
      }}
    />
  );
}
