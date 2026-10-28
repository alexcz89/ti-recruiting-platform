import { beforeEach, expect, it, vi } from "vitest";
import { refreshAssessmentInbox } from "@/app/assessments/actions";
const mocks = vi.hoisted(() => ({ session: vi.fn(), revalidate: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
beforeEach(() => vi.clearAllMocks());
it.each([null, { user: { id: "recruiter", role: "RECRUITER" } }, { user: { id: "admin", role: "ADMIN" } }, { user: { role: "CANDIDATE" } }])("does not invalidate without an authenticated candidate", async session => {
  mocks.session.mockResolvedValue(session); await refreshAssessmentInbox(); expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("invalidates the inbox navigation cache for the candidate without writing any assessment data", async () => {
  mocks.session.mockResolvedValue({ user: { id: "candidate", role: "CANDIDATE" } });
  await refreshAssessmentInbox(); expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("/assessments");
});
