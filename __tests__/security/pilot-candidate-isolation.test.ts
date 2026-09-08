import { describe, expect, it } from "vitest";
import {
  applicationWhereForActor,
  candidateWhereForActor,
} from "@/lib/server/candidate-access";

const companyA = { id: "company-a" };
const companyB = { id: "company-b" };
const recruiterA = { role: "RECRUITER", companyId: companyA.id };
const recruiterB = { role: "RECRUITER", companyId: companyB.id };
const candidateA = { id: "candidate-a" };
const candidateB = { id: "candidate-b" };
const applicationA = { id: "application-a", jobId: "job-a", candidateId: candidateA.id };
const applicationB = { id: "application-b", jobId: "job-b", candidateId: candidateB.id };

describe("pilot candidate tenant boundary", () => {
  it("scopes recruiter A's candidate list to applications on company A jobs", () => {
    expect(candidateWhereForActor(recruiterA)).toEqual({
      role: "CANDIDATE",
      applications: { some: { job: { companyId: companyA.id } } },
    });
    expect(candidateWhereForActor(recruiterB)).toEqual({
      role: "CANDIDATE",
      applications: { some: { job: { companyId: companyB.id } } },
    });
  });

  it("blocks candidate B by direct candidate ID for recruiter A", () => {
    expect(candidateWhereForActor(recruiterA, candidateB.id)).toEqual({
      id: candidateB.id,
      role: "CANDIDATE",
      applications: { some: { job: { companyId: companyA.id } } },
    });
  });

  it("binds candidate, application and job IDs to the same company scope", () => {
    expect(applicationWhereForActor(recruiterA, {
      applicationId: applicationB.id,
      jobId: applicationB.jobId,
      candidateId: applicationB.candidateId,
    })).toEqual({
      id: applicationB.id,
      jobId: applicationB.jobId,
      candidateId: applicationB.candidateId,
      job: { companyId: companyA.id },
    });

    expect(applicationWhereForActor(recruiterA, {
      applicationId: applicationA.id,
      jobId: applicationB.jobId,
      candidateId: candidateA.id,
    })).toEqual({
      id: applicationA.id,
      jobId: applicationB.jobId,
      candidateId: candidateA.id,
      job: { companyId: companyA.id },
    });
  });

  it("rejects an unapproved/unlinked recruiter and preserves ADMIN global scope", () => {
    expect(candidateWhereForActor({ role: "RECRUITER", companyId: null })).toBeNull();
    expect(applicationWhereForActor(
      { role: "RECRUITER", companyId: null },
      { applicationId: applicationB.id }
    )).toBeNull();
    expect(candidateWhereForActor({ role: "ADMIN", companyId: null }, candidateB.id))
      .toEqual({ id: candidateB.id, role: "CANDIDATE" });
  });
});
