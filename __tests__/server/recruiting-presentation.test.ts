import { describe, expect, it } from "vitest";
import { getRecruitingPresentation as present, getRecruitingActions, type PresentationSource } from "@/lib/hiring-process/recruiting-presentation";
import { LEGACY_APPLICATION_STATE_MATRIX } from "@/lib/hiring-process/legacy-mapping";

const source: PresentationSource = { stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW", stateVersion: 1 };
describe.each([true, false])("recruiting presentation, canonical reads=%s", reads => {
  it.each(LEGACY_APPLICATION_STATE_MATRIX)("classifies legacy $key only when deterministic", mapping => {
    const p = present({ stage: null, disposition: null, stateVersion: 0, status: mapping.status, recruiterInterest: mapping.recruiterInterest }, reads);
    expect(p.section === "RECONCILIATION").toBe(!mapping.autoApplicable);
  });
  it("partitions every candidature once, preserving closed outcomes and pause", () => {
    const rows: PresentationSource[] = [source, { ...source, stage: "REVIEW", status: "REVIEWING", recruiterInterest: "MAYBE" }, { ...source, stage: "ASSESSMENT", status: "REVIEWING" }, { ...source, stage: "INTERVIEW", status: "INTERVIEW", recruiterInterest: "ACCEPTED" }, { ...source, stage: "OFFER", status: "OFFER", recruiterInterest: "ACCEPTED" }, ...(["REJECTED", "HIRED", "WITHDRAWN", "CANCELLED"] as const).map(disposition => ({ ...source, stage: "CLOSED" as const, disposition })), { ...source, disposition: "HOLD" }, { ...source, stage: null }];
    const projected = rows.map(r => present(r, reads));
    expect(projected.filter(p => p.section === "ACTIVE")).toHaveLength(5);
    expect(projected.filter(p => p.section === "CLOSED")).toHaveLength(4);
    expect(projected.filter(p => p.section === "HOLD")).toHaveLength(1);
    expect(projected.filter(p => p.section === "RECONCILIATION")).toHaveLength(1);
    expect(projected[1]).toMatchObject({ column: "REVIEW", preselected: true });
    expect(projected[2]).toMatchObject({ column: "REVIEW", assessmentStage: true });
    expect(projected.map(p => p.section)).toHaveLength(rows.length);
  });
  it("offers actions using the persisted stage", () => {
    expect(getRecruitingActions(source, reads)).toContain("START_REVIEW");
    expect(getRecruitingActions({ ...source, stage: "ASSESSMENT", status: "REVIEWING" }, reads)).not.toContain("MARK_PRESELECTED");
    expect(getRecruitingActions({ ...source, stage: "INTERVIEW", status: "INTERVIEW", recruiterInterest: "ACCEPTED" }, reads)).toContain("MOVE_TO_OFFER");
    expect(getRecruitingActions({ ...source, disposition: "HOLD" }, reads)).toEqual([]);
    expect(getRecruitingActions({ ...source, status: "HIRED" }, reads)).toEqual([]);
  });
});
