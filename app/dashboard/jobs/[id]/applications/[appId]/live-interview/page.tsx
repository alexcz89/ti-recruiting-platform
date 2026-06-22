// app/dashboard/jobs/[id]/applications/[appId]/live-interview/page.tsx
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { notFound, redirect } from "next/navigation";
import InterviewerView from "./InterviewerView";

export default async function LiveInterviewPage({
  params,
}: {
  params: { id: string; appId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = session.user as { id: string; role: string; companyId?: string };
  if (!["RECRUITER", "ADMIN"].includes(user.role)) redirect("/dashboard");

  const application = await prisma.application.findUnique({
    where: { id: params.appId },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      job: { select: { id: true, title: true, companyId: true } },
      liveInterviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          qaScores: {
            include: {
              question: {
                select: { id: true, question: true, expectedTopics: true, category: true },
              },
            },
          },
        },
      },
    },
  });

  if (!application) notFound();
  if (user.companyId && application.job.companyId !== user.companyId) notFound();

  // Available question bank for this session
  const questions = await prisma.liveInterviewQuestion.findMany({
    where: { isActive: true },
    orderBy: [{ techStack: "asc" }, { orderIndex: "asc" }],
  });

  const existingInterview = application.liveInterviews[0] ?? null;

  return (
    <InterviewerView
      application={{
        id: application.id,
        jobId: params.id,
        candidate: application.candidate,
        job: application.job,
      }}
      existingInterview={existingInterview ? {
        id: existingInterview.id,
        status: existingInterview.status as any,
        challengeTitle: existingInterview.challengeTitle,
        challengeDescription: existingInterview.challengeDescription,
        apiName: existingInterview.apiName,
        apiDocsUrl: existingInterview.apiDocsUrl,
        videoCallUrl: existingInterview.videoCallUrl,
        codingMinutes: existingInterview.codingMinutes,
        qaMinutes: existingInterview.qaMinutes,
        codingStartedAt: existingInterview.codingStartedAt?.toISOString() ?? null,
        codingEndedAt: existingInterview.codingEndedAt?.toISOString() ?? null,
        qaStartedAt: existingInterview.qaStartedAt?.toISOString() ?? null,
        submittedAt: existingInterview.submittedAt?.toISOString() ?? null,
        githubUrl: existingInterview.githubUrl,
        liveUrl: existingInterview.liveUrl,
        codingScore: existingInterview.codingScore,
        qaScore: existingInterview.qaScore,
        finalScore: existingInterview.finalScore,
        interviewerNotes: existingInterview.interviewerNotes,
        recommendation: existingInterview.recommendation as any,
        qaScores: existingInterview.qaScores.map((s) => ({
          questionId: s.questionId,
          score: s.score,
          notes: s.notes,
          question: s.question,
        })),
      } : null}
      questionBank={questions.map((q) => ({
        id: q.id,
        question: q.question,
        expectedTopics: q.expectedTopics,
        category: q.category,
        techStack: q.techStack,
        seniority: q.seniority as string | null,
      }))}
    />
  );
}
