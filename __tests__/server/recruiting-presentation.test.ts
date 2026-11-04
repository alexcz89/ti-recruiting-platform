import { describe, expect, it } from "vitest";
import { getRecruitingPresentation as present, getRecruitingActions, getRecruiterStageOptions, getRecruiterPipelineOptions, getRecruiterPipelinePresentation, resolveRecruiterPipelineFilterKey, type PresentationSource } from "@/lib/hiring-process/recruiting-presentation";
import { LEGACY_APPLICATION_STATE_MATRIX } from "@/lib/hiring-process/legacy-mapping";

const source: PresentationSource = { stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW", stateVersion: 1 };
describe.each([true, false])("recruiting presentation, canonical reads=%s", reads => {
  it("limits the simplified UI to five existing destinations without weakening command requirements", () => {
    const options = getRecruiterPipelineOptions(source, reads);
    expect(options.map(option => option.destination)).toEqual(["APPLIED", "REVIEW", "INTERVIEW", "HIRED", "REJECTED"]);
    expect(options.map(option => option.label)).toEqual(["Por revisar", "En revisión", "Entrevista", "Contratado", "Descartado"]);
    expect(options.find(option => option.destination === "HIRED")).toMatchObject({ requiresConfirmation: true });
    expect(options.find(option => option.destination === "REJECTED")).toMatchObject({ requiresConfirmation: true });
    expect(getRecruiterPipelineOptions({ ...source, stage: "CLOSED", disposition: "HIRED", status: "HIRED", recruiterInterest: "ACCEPTED" }, reads)).toEqual([]);
    expect(getRecruiterPipelineOptions({ ...source, stage: null }, reads)).toEqual([]);
  });
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
  it.each(LEGACY_APPLICATION_STATE_MATRIX.filter(m => m.autoApplicable && m.suggestedDisposition !== "HIRED"))("offers all nine destinations for non-hired deterministic legacy $key", mapping => {
    const options = getRecruiterStageOptions({ stage: null, disposition: null, stateVersion: 0, status: mapping.status, recruiterInterest: mapping.recruiterInterest }, reads);
    expect(options.map(o => o.destination)).toEqual(["APPLIED", "REVIEW", "INTERVIEW", "OFFER", "REJECTED", "HIRED", "HOLD", "WITHDRAWN", "CANCELLED"]);
    expect(options.filter(o => o.current)).toHaveLength(1);
    expect(options.every(o => o.intent === "SET_RECRUITING_STATE")).toBe(true);
    expect(options.some(o => o.label === "Preselecto" || o.label === "Evaluación")).toBe(false);
    expect(options.find(o => o.destination === "HIRED")).toMatchObject({ requiresConfirmation: true });
  });
  it.each([true, false])("exposes no ordinary destinations from HIRED, canonical source=%s", canonical => {
    const hired: PresentationSource = { stage: canonical ? "CLOSED" : null, disposition: canonical ? "HIRED" : null,
      status: "HIRED", recruiterInterest: "ACCEPTED", stateVersion: canonical ? 1 : 0 };
    expect(present(hired, reads)).toMatchObject({ section: "CLOSED", outcome: "HIRED", label: "Contratado" });
    expect(getRecruiterStageOptions(hired, reads)).toEqual([]);
    expect(getRecruitingActions(hired, reads)).toEqual([]);
  });
  it("allows forward skips, backward moves, pause and audited reopening", () => {
    const review = { ...source, stage: "REVIEW" as const, status: "REVIEWING" };
    expect(getRecruiterStageOptions(review, reads).find(o => o.destination === "OFFER")).toMatchObject({ requiresReason: false, requiresConfirmation: false });
    const offer = { ...source, stage: "OFFER" as const, status: "OFFER", recruiterInterest: "ACCEPTED" };
    expect(getRecruiterStageOptions(offer, reads).find(o => o.destination === "REVIEW")).toMatchObject({ requiresReason: true });
    expect(getRecruiterStageOptions({ ...review, disposition: "HOLD" }, reads)).toHaveLength(9);
    expect(getRecruiterStageOptions({ ...source, stage: "CLOSED", disposition: "REJECTED", status: "REJECTED", recruiterInterest: "REJECTED" }, reads).find(o => o.destination === "OFFER"))
      .toMatchObject({ requiresReason: true, requiresConfirmation: true });
  });
  it.each([
    { status: "HIRED" }, { status: "REJECTED" }, { recruiterInterest: "REJECTED" },
    { stage: null }, { stage: null, disposition: null, stateVersion: 2 },
  ] as const)("offers no destinations for inconsistent source %j", invalid => {
    expect(getRecruiterStageOptions({ ...source, ...invalid }, reads)).toEqual([]);
  });
});


describe.each([true, false])("five-state recruiter projection, reads=%s", reads => {
  it.each([
    { patch: {}, state: "APPLIED" },
    { patch: { stage: "REVIEW", status: "REVIEWING" }, state: "REVIEW" },
    { patch: { stage: "REVIEW", status: "REVIEWING", recruiterInterest: "MAYBE" }, state: "REVIEW" },
    { patch: { stage: "ASSESSMENT", status: "REVIEWING" }, state: "REVIEW" },
    { patch: { stage: "INTERVIEW", status: "INTERVIEW", recruiterInterest: "ACCEPTED" }, state: "INTERVIEW" },
    { patch: { stage: "OFFER", status: "OFFER", recruiterInterest: "ACCEPTED" }, state: "INTERVIEW" },
    { patch: { stage: "CLOSED", disposition: "HIRED", status: "HIRED", recruiterInterest: "ACCEPTED" }, state: "HIRED" },
    { patch: { stage: "CLOSED", disposition: "REJECTED", status: "REJECTED", recruiterInterest: "REJECTED" }, state: "REJECTED" },
    { patch: { stage: "CLOSED", disposition: "WITHDRAWN" }, state: "REJECTED" },
    { patch: { stage: "CLOSED", disposition: "CANCELLED" }, state: "REJECTED" },
    { patch: { stage: "REVIEW", disposition: "HOLD", status: "REVIEWING" }, state: "REVIEW" },
    { patch: { stage: "OFFER", disposition: "HOLD", status: "OFFER", recruiterInterest: "ACCEPTED" }, state: "INTERVIEW" },
  ] as const)("maps $patch to $state without mutating its source or domain presentation", ({ patch, state }) => {
    const row = Object.freeze({ ...source, ...patch });
    const domain = present(row, reads);
    const before = { ...row };
    expect(getRecruiterPipelinePresentation(row, reads)).toMatchObject({ pipelineState: state, integrityIssue: false });
    expect(row).toEqual(before);
    expect(present(row, reads)).toEqual(domain);
  });
  it.each([
    { stage: null }, { stage: null, disposition: null, stateVersion: 2 },
    { status: "HIRED" }, { stage: "REVIEW", disposition: "HOLD", status: "OFFER", recruiterInterest: "ACCEPTED" },
    { hiredAt: "2026-10-01T00:00:00Z" }, { rejectedAt: "2026-10-01T00:00:00Z" }, { rejectionEmailSent: true },
    { stage: "CLOSED", disposition: "REJECTED", status: "HIRED", recruiterInterest: "ACCEPTED" },
  ] as const)("keeps inconsistent $patch outside every normal state and blocks options", patch => {
    const row = { ...source, ...patch };
    expect(getRecruiterPipelinePresentation(row, reads)).toMatchObject({ pipelineState: null, integrityIssue: true, label: "—" });
    expect(getRecruiterPipelineOptions(row, reads)).toEqual([]);
  });
  it("resumes a paused OFFER using OFFER internally without offering an Oferta UI state", () => {
    const row = { ...source, stage: "OFFER" as const, disposition: "HOLD" as const, status: "OFFER", recruiterInterest: "ACCEPTED" };
    const options = getRecruiterPipelineOptions(row, reads);
    expect(options).toHaveLength(5);
    expect(options.find(option => option.pipelineState === "INTERVIEW")).toMatchObject({ destination: "OFFER", label: "Entrevista", resumesPaused: true, disabled: false, requiresReason: false });
  });
  it.each(["WITHDRAWN", "CANCELLED"] as const)("does not offer a false re-rejection for a %s closure", disposition => {
    const row = { ...source, stage: "CLOSED" as const, disposition };
    expect(getRecruiterPipelinePresentation(row, reads).outcome).toBe(disposition);
    expect(getRecruiterPipelineOptions(row, reads).find(option => option.pipelineState === "REJECTED")).toMatchObject({ current: true, disabled: true });
  });
  describe.each(["REJECTED", "WITHDRAWN", "CANCELLED"] as const)("non-hired closure %s", disposition => {
    it.each([
      { status: "HIRED", hiredAt: null },
      { status: "OFFER", hiredAt: new Date("2026-10-01T00:00:00Z") },
      { status: "OFFER", hiredAt: "2026-10-01T00:00:00Z" },
      { status: "HIRED", hiredAt: "2026-10-01T00:00:00Z" },
    ])("flags hiring footprint %j without rewriting the closure", footprint => {
      const row: PresentationSource = { ...source, stage: "CLOSED", disposition, recruiterInterest: "ACCEPTED", ...footprint };
      const before = { ...row };
      expect(getRecruiterPipelinePresentation(row, reads)).toMatchObject({ pipelineState: null, integrityIssue: true, label: "—", outcome: disposition });
      expect(getRecruiterPipelineOptions(row, reads)).toEqual([]);
      expect(row).toEqual(before);
    });
  });
  describe.each(["WITHDRAWN", "CANCELLED"] as const)("retained legacy projection for %s", disposition => {
    it.each([
      { status: "SUBMITTED", recruiterInterest: "REVIEW" },
      { status: "REVIEWING", recruiterInterest: "REVIEW" },
      { status: "REVIEWING", recruiterInterest: "MAYBE" },
      { status: "INTERVIEW", recruiterInterest: "ACCEPTED" },
      { status: "OFFER", recruiterInterest: "ACCEPTED" },
      { status: "REJECTED", recruiterInterest: "REJECTED" },
    ])("does not mistake preserved %j for a contradictory hire", legacy => {
      const row: PresentationSource = { ...source, stage: "CLOSED", disposition, hiredAt: null, ...legacy };
      expect(getRecruiterPipelinePresentation(row, reads)).toMatchObject({ pipelineState: "REJECTED", integrityIssue: false, outcome: disposition });
    });
  });
  it("keeps a genuine hired closure with its timestamp terminal and visible", () => {
    const row: PresentationSource = { ...source, stage: "CLOSED", disposition: "HIRED", status: "HIRED", recruiterInterest: "ACCEPTED", hiredAt: "2026-10-01T00:00:00Z" };
    expect(getRecruiterPipelinePresentation(row, reads)).toMatchObject({ pipelineState: "HIRED", integrityIssue: false, label: "Contratado" });
    expect(getRecruiterPipelineOptions(row, reads)).toEqual([]);
  });
});

it("maps legacy filter URLs to the five visible stages", () => {
  expect(resolveRecruiterPipelineFilterKey("OFFER")).toBe("INTERVIEW");
  expect(resolveRecruiterPipelineFilterKey("ASSESSMENT")).toBe("REVIEW");
  expect(resolveRecruiterPipelineFilterKey("PRESELECTED")).toBe("REVIEW");
  expect(resolveRecruiterPipelineFilterKey("CLOSED", "HIRED")).toBe("HIRED");
  expect(resolveRecruiterPipelineFilterKey("CLOSED", "WITHDRAWN")).toBe("REJECTED");
  expect(resolveRecruiterPipelineFilterKey("CLOSED")).toBeUndefined();
  expect(resolveRecruiterPipelineFilterKey("RECONCILIATION")).toBeUndefined();
});
