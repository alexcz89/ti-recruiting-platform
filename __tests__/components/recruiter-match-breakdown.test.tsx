// @vitest-environment happy-dom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import MatchScorePopover from "@/components/dashboard/MatchScorePopover";
import MatchBreakdownMini from "@/components/jobs/MatchBreakdownMini";
import { computeRecruiterMatch } from "@/lib/ai/recruiter-match";
import { scoreToLabel } from "@/lib/ai/matchScore";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("explains the final score as base plus applied profile and tag deltas without changing skill evidence", async () => {
  vi.stubGlobal("React", React);
  const match = computeRecruiterMatch({ title: "Backend Java AWS", requiredSkills: [
    { term: { id: "java", label: "Java" }, must: true, weight: 4 },
    { term: { id: "sql", label: "SQL" }, must: true, weight: 3 },
  ] }, { candidateSkills: [{ term: { id: "java", label: "Java" }, level: 3 }], aiProfile: { profileType: "ENGINEERING", tags: ["backend", "cloud"] } });
  const fetch = vi.fn(async () => new Response(JSON.stringify({ explanation: null, fromCache: true })));
  vi.stubGlobal("fetch", fetch);
  const { unmount } = render(<MatchBreakdownMini matchResult={match.matchResult} adjustments={match} />);
  expect(screen.getByText("Skills 1/2")).toBeInTheDocument();
  expect(screen.getByText("Base 48")).toBeInTheDocument();
  expect(screen.getByText("Perfil +5")).toBeInTheDocument();
  expect(screen.getByText(`Tags +${match.tagAdjustment}`)).toBeInTheDocument();
  expect(screen.getByText(`Final ${match.finalScore}%`)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  unmount();
  render(<MatchScorePopover score={match.finalScore} matchResult={match.matchResult} adjustments={match}
    jobSkillCount={2} scoreColor="" scoreTextColor="" scoreLabel={scoreToLabel(match.finalScore)} candidateId="synthetic" jobId="synthetic-job" />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(screen.getByText("Base 48")).toBeInTheDocument();
  expect(screen.getByText(`Final ${match.finalScore}%`)).toBeInTheDocument();
});
