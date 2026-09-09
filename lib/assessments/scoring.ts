export type ScoringQuestion = {
  id: string;
  section: string;
  type: string;
  testCases: Array<{ points: number }>;
};

export type ScoringAnswer = {
  questionId: string;
  pointsEarned: number | null;
};

export function calculateAssessmentScore(
  questions: ScoringQuestion[],
  answers: ScoringAnswer[],
  options: { codingByTestCases?: boolean } = {}
) {
  const questionMaxPoints = questions.map((question) => ({
    id: question.id,
    section: question.section,
    maxPts:
      options.codingByTestCases && String(question.type).toUpperCase() === "CODING"
        ? Math.max(1, question.testCases.reduce((sum, testCase) => sum + testCase.points, 0))
        : 1,
  }));
  const maxPointsByQuestion = new Map(questionMaxPoints.map((question) => [question.id, question.maxPts]));
  const totalPoints = answers.reduce(
    (sum, answer) => sum + Math.min(maxPointsByQuestion.get(answer.questionId) ?? 0, answer.pointsEarned || 0),
    0
  );
  const maxPoints = questionMaxPoints.reduce((sum, question) => sum + question.maxPts, 0);
  const totalScore = maxPoints > 0
    ? Math.max(0, Math.min(100, Math.round((totalPoints / maxPoints) * 100)))
    : 0;

  return { questionMaxPoints, totalPoints, maxPoints, totalScore };
}