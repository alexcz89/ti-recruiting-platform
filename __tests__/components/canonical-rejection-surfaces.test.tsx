// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/ui/toast", () => ({
  toastSuccess: mocks.toastSuccess,
  toastError: mocks.toastError,
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
}));

import InterestSelect from "@/app/dashboard/jobs/[id]/applications/InterestSelect";
import CandidateReviewShell, {
  type AppState,
} from "@/components/dashboard/CandidateReviewShell";

const rejectedApplication: AppState = {
  id: "application-1",
  stage: "CLOSED",
  disposition: "REJECTED",
  status: "REJECTED",
  recruiterInterest: "REJECTED",
  stateVersion: 2,
  internalNotes: null,
  starred: false,
  createdAt: "2026-10-05T12:00:00.000Z",
  submittedAt: "2026-10-05T12:00:00.000Z",
  reviewingAt: null,
  interviewAt: null,
  offerAt: null,
  hiredAt: null,
  rejectedAt: "2026-10-05T12:05:00.000Z",
  lastViewedAt: null,
  viewCount: 0,
};

const interviewApplication: AppState = {
  ...rejectedApplication,
  status: "INTERVIEW",
  recruiterInterest: "ACCEPTED",
  stage: "INTERVIEW",
  disposition: "ACTIVE",
  stateVersion: 3,
  interviewAt: "2026-10-05T12:05:00.000Z",
  rejectedAt: null,
};

const offerApplication: AppState = {
  ...interviewApplication,
  status: "OFFER",
  recruiterInterest: "ACCEPTED",
  stage: "OFFER",
  disposition: "ACTIVE",
  stateVersion: 4,
  offerAt: "2026-10-05T12:10:00.000Z",
};

const hiredApplication: AppState = {
  ...offerApplication,
  status: "HIRED",
  stage: "CLOSED",
  disposition: "HIRED",
  stateVersion: 5,
  hiredAt: "2026-10-05T12:15:00.000Z",
};

const appliedApplication: AppState = {
  ...interviewApplication,
  status: "SUBMITTED",
  recruiterInterest: "REVIEW",
  stage: "APPLIED",
  disposition: "ACTIVE",
  stateVersion: 1,
  reviewingAt: null,
  interviewAt: null,
};

describe("canonical rejection surfaces", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends one MARK_PRESELECTED command from InterestSelect", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      application: {
        stage: "REVIEW",
        disposition: "ACTIVE",
        status: "REVIEWING",
        recruiterInterest: "MAYBE",
        stateVersion: 2,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<InterestSelect
      applicationId="application-1"
      initial="REVIEW"
      initialStateVersion={1}
      canonicalStage="APPLIED"
      canonicalDisposition="ACTIVE"
    />);
    fireEvent.click(screen.getByRole("button", { name: /Por revisar/ }));
    fireEvent.click(screen.getByRole("option", { name: /Preselecto/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/applications/application-1/intent");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      intent: "MARK_PRESELECTED",
      expectedVersion: 1,
    });
  });

  it("sends one CLEAR_PRESELECTED command from InterestSelect", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      application: {
        stage: "REVIEW",
        disposition: "ACTIVE",
        status: "REVIEWING",
        recruiterInterest: "REVIEW",
        stateVersion: 2,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<InterestSelect
      applicationId="application-1"
      initial="MAYBE"
      initialStateVersion={2}
      canonicalStage="REVIEW"
      canonicalDisposition="ACTIVE"
    />);
    fireEvent.click(screen.getByRole("button", { name: /Preselecto/ }));
    fireEvent.click(screen.getByRole("option", { name: /Por revisar/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      intent: "CLEAR_PRESELECTED",
      expectedVersion: 2,
    });
  });

  it("sends one MARK_PRESELECTED command from CandidateReviewShell and updates canonical review state", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      application: {
        stage: "REVIEW",
        disposition: "ACTIVE",
        status: "REVIEWING",
        recruiterInterest: "MAYBE",
        stateVersion: 2,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<CandidateReviewShell
      candidateId="candidate-1"
      candidateName="Candidate"
      candidateSeniority={null}
      candidateLocation={null}
      resumeUrl={null}
      waHref={null}
      fromJobId="job-1"
      jobTitle="Job"
      matchScore={null}
      matchLocked={false}
      applicationId="application-1"
      currentApplication={appliedApplication}
      navList={[]}
      navIndex={-1}
      slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }}
    />);
    fireEvent.click(screen.getByRole("button", { name: /Preselecto/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      intent: "MARK_PRESELECTED",
      expectedVersion: 1,
    });
  });

  it("keeps Preselecto inert after Interview", () => {
    render(<CandidateReviewShell
      candidateId="candidate-1"
      candidateName="Candidate"
      candidateSeniority={null}
      candidateLocation={null}
      resumeUrl={null}
      waHref={null}
      fromJobId="job-1"
      jobTitle="Job"
      matchScore={null}
      matchLocked={false}
      applicationId="application-1"
      currentApplication={interviewApplication}
      navList={[]}
      navIndex={-1}
      slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }}
    />);

    expect(screen.getByRole("button", { name: /Preselecto/ })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends one REJECT_CANDIDATE command from InterestSelect", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          application: {
            status: "REJECTED",
            recruiterInterest: "REJECTED",
            stateVersion: 2,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <InterestSelect
        applicationId="application-1"
        initial="REVIEW"
        initialStateVersion={1}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Por revisar/ }));
    fireEvent.click(screen.getByRole("option", { name: /Descartado/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/applications/application-1/intent");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      intent: "REJECT_CANDIDATE",
      expectedVersion: 1,
    });
  });

  it("does not toggle a terminal CandidateReviewShell rejection back to REVIEW", () => {
    render(
      <CandidateReviewShell
        candidateId="candidate-1"
        candidateName="Candidate"
        candidateSeniority={null}
        candidateLocation={null}
        resumeUrl={null}
        waHref={null}
        fromJobId="job-1"
        jobTitle="Job"
        matchScore={null}
        matchLocked={false}
        applicationId="application-1"
        currentApplication={rejectedApplication}
        navList={[]}
        navIndex={-1}
        slots={{
          summary: <div>Summary</div>,
          profile: <div>Profile</div>,
          cv: null,
          assessments: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Descartar/ }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends exactly one MOVE_TO_OFFER command from CandidateReviewShell", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          application: {
            stage: "OFFER",
            disposition: "ACTIVE",
            status: "OFFER",
            recruiterInterest: "ACCEPTED",
            stateVersion: 4,
            offerAt: "2026-10-05T12:10:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <CandidateReviewShell
        candidateId="candidate-1"
        candidateName="Candidate"
        candidateSeniority={null}
        candidateLocation={null}
        resumeUrl={null}
        waHref={null}
        fromJobId="job-1"
        jobTitle="Job"
        matchScore={null}
        matchLocked={false}
        applicationId="application-1"
        currentApplication={interviewApplication}
        navList={[]}
        navIndex={-1}
        slots={{
          summary: <div>Summary</div>,
          profile: <div>Profile</div>,
          cv: null,
          assessments: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mover a oferta" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/applications/application-1/intent");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      intent: "MOVE_TO_OFFER",
      expectedVersion: 3,
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Mover a oferta" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Entrevista" })).toBeInTheDocument();
    expect(screen.getByText("Oferta enviada")).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Candidato movido a oferta");
  });

  it("shows a Spanish error when MOVE_TO_OFFER fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 409 }));

    render(
      <CandidateReviewShell
        candidateId="candidate-1"
        candidateName="Candidate"
        candidateSeniority={null}
        candidateLocation={null}
        resumeUrl={null}
        waHref={null}
        fromJobId="job-1"
        jobTitle="Job"
        matchScore={null}
        matchLocked={false}
        applicationId="application-1"
        currentApplication={interviewApplication}
        navList={[]}
        navIndex={-1}
        slots={{
          summary: <div>Summary</div>,
          profile: <div>Profile</div>,
          cv: null,
          assessments: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mover a oferta" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "No se pudo mover al candidato a oferta. Intenta de nuevo.",
      ),
    );
    expect(screen.getByRole("button", { name: "Mover a oferta" })).toBeInTheDocument();
  });

  it("does not expose working backward interest actions after canonical Offer", () => {
    render(
      <CandidateReviewShell
        candidateId="candidate-1"
        candidateName="Candidate"
        candidateSeniority={null}
        candidateLocation={null}
        resumeUrl={null}
        waHref={null}
        fromJobId="job-1"
        jobTitle="Job"
        matchScore={null}
        matchLocked={false}
        applicationId="application-1"
        currentApplication={offerApplication}
        navList={[]}
        navIndex={-1}
        slots={{
          summary: <div>Summary</div>,
          profile: <div>Profile</div>,
          cv: null,
          assessments: null,
        }}
      />,
    );

    const preselected = screen.getByRole("button", { name: /Preselecto/ });
    const interview = screen.getByRole("button", { name: "Entrevista" });
    expect(preselected).toBeDisabled();
    expect(interview).toBeDisabled();
    fireEvent.click(preselected);
    fireEvent.click(interview);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps InterestSelect legacy choices inert for a canonical Offer", () => {
    render(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={4}
        canonicalStage="OFFER"
        canonicalDisposition="ACTIVE"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Entrevista/ }));
    expect(screen.getByRole("option", { name: /Por revisar/ })).toBeDisabled();
    expect(screen.getByRole("option", { name: /Preselecto/ })).toBeDisabled();
    expect(screen.getByRole("option", { name: /Entrevista/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("option", { name: /Preselecto/ }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps InterestSelect unable to move canonical Interview backward or reopen rejection", () => {
    const interview = render(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={3}
        canonicalStage="INTERVIEW"
        canonicalDisposition="ACTIVE"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Entrevista/ }));
    expect(screen.getByRole("option", { name: /Por revisar/ })).toBeDisabled();
    expect(screen.getByRole("option", { name: /Preselecto/ })).toBeDisabled();
    interview.unmount();

    render(
      <InterestSelect
        applicationId="application-1"
        initial="REJECTED"
        initialStateVersion={2}
        canonicalStage="CLOSED"
        canonicalDisposition="REJECTED"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Descartado/ }));
    fireEvent.click(screen.getByRole("option", { name: /Entrevista/ }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends exactly one HIRE_CANDIDATE command and applies its transaction result", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          application: {
            stage: "CLOSED",
            disposition: "HIRED",
            status: "HIRED",
            recruiterInterest: "ACCEPTED",
            stateVersion: 5,
            hiredAt: "2026-10-05T12:15:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <CandidateReviewShell
        candidateId="candidate-1"
        candidateName="Candidate"
        candidateSeniority={null}
        candidateLocation={null}
        resumeUrl={null}
        waHref={null}
        fromJobId="job-1"
        jobTitle="Job"
        matchScore={null}
        matchLocked={false}
        applicationId="application-1"
        currentApplication={offerApplication}
        navList={[]}
        navIndex={-1}
        slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }}
      />,
    );

    const hireButton = screen.getByRole("button", { name: "Contratar" });
    fireEvent.click(hireButton);
    fireEvent.click(hireButton);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/applications/application-1/intent");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      intent: "HIRE_CANDIDATE",
      expectedVersion: 4,
    });
    expect(String(init?.body)).not.toContain("/status");
    expect(String(init?.body)).not.toContain("/interest");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Contratar" })).not.toBeInTheDocument());
    expect(screen.getByText("Candidato contratado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preselecto/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Entrevista/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Descartar/ })).toBeDisabled();
    expect(screen.getByPlaceholderText("Escribe tus notas sobre este candidato...")).toBeEnabled();
  });

  it("keeps canonical and legacy HIRED InterestSelect controls inert", () => {
    const { rerender } = render(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={5}
        legacyStatus="HIRED"
      />,
    );
    expect(screen.getByRole("button", { name: /Entrevista/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Entrevista/ }));
    expect(fetch).not.toHaveBeenCalled();

    rerender(
      <InterestSelect
        applicationId="application-1"
        initial="ACCEPTED"
        initialStateVersion={5}
        legacyStatus="OFFER"
        canonicalStage={hiredApplication.stage}
        canonicalDisposition={hiredApplication.disposition}
      />,
    );
    expect(screen.getByRole("button", { name: /Entrevista/ })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows only the approved backward and reopen actions for each canonical state", () => {
    const props = {
      candidateId: "candidate-1",
      candidateName: "Candidate",
      candidateSeniority: null,
      candidateLocation: null,
      resumeUrl: null,
      waHref: null,
      fromJobId: "job-1",
      jobTitle: "Job",
      matchScore: null,
      matchLocked: false,
      applicationId: "application-1",
      navList: [],
      navIndex: -1,
      slots: { summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null },
    };

    const interview = render(
      <CandidateReviewShell {...props} currentApplication={interviewApplication} />,
    );
    expect(screen.getByRole("button", { name: "Regresar a revisión" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Regresar a entrevista" })).not.toBeInTheDocument();
    interview.unmount();

    const offer = render(
      <CandidateReviewShell {...props} currentApplication={offerApplication} />,
    );
    expect(screen.getByRole("button", { name: "Regresar a entrevista" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Regresar a revisión" })).toBeEnabled();
    offer.unmount();

    const rejected = render(
      <CandidateReviewShell {...props} currentApplication={rejectedApplication} />,
    );
    expect(screen.getByRole("button", { name: "Reabrir proceso" })).toBeEnabled();
    rejected.unmount();

    render(<CandidateReviewShell {...props} currentApplication={hiredApplication} />);
    expect(screen.queryByRole("button", { name: /Regresar a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reabrir proceso" })).not.toBeInTheDocument();
  });

  it("submits one reasoned MOVE_BACKWARD command and updates the returned state", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      application: {
        stage: "REVIEW",
        disposition: "ACTIVE",
        status: "REVIEWING",
        recruiterInterest: "REVIEW",
        stateVersion: 4,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<CandidateReviewShell
      candidateId="candidate-1"
      candidateName="Candidate"
      candidateSeniority={null}
      candidateLocation={null}
      resumeUrl={null}
      waHref={null}
      fromJobId="job-1"
      jobTitle="Job"
      matchScore={null}
      matchLocked={false}
      applicationId="application-1"
      currentApplication={interviewApplication}
      navList={[]}
      navIndex={-1}
      slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Regresar a revisión" }));
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "ADDITIONAL_REVIEW" },
    });
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), {
      target: { value: "  Validar referencias  " },
    });
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/applications/application-1/intent");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      intent: "MOVE_BACKWARD",
      targetStage: "REVIEW",
      expectedVersion: 3,
      reasonCode: "ADDITIONAL_REVIEW",
      reasonText: "Validar referencias",
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Regresar a revisión" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Preselecto" })).toBeEnabled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Etapa actualizada");
  });

  it("sends OFFER backward to INTERVIEW only after explicit confirmation", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      application: {
        stage: "INTERVIEW",
        disposition: "ACTIVE",
        status: "INTERVIEW",
        recruiterInterest: "ACCEPTED",
        stateVersion: 5,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<CandidateReviewShell
      candidateId="candidate-1"
      candidateName="Candidate"
      candidateSeniority={null}
      candidateLocation={null}
      resumeUrl={null}
      waHref={null}
      fromJobId="job-1"
      jobTitle="Job"
      matchScore={null}
      matchLocked={false}
      applicationId="application-1"
      currentApplication={offerApplication}
      navList={[]}
      navIndex={-1}
      slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Regresar a entrevista" }));
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "PROCESS_CHANGE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      intent: "MOVE_BACKWARD",
      targetStage: "INTERVIEW",
      expectedVersion: 4,
      reasonCode: "PROCESS_CHANGE",
    });
  });

  it("requires a note for OTHER and reopens rejection with one command", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      application: {
        stage: "REVIEW",
        disposition: "ACTIVE",
        status: "REVIEWING",
        recruiterInterest: "REVIEW",
        stateVersion: 3,
        rejectedAt: null,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<CandidateReviewShell
      candidateId="candidate-1"
      candidateName="Candidate"
      candidateSeniority={null}
      candidateLocation={null}
      resumeUrl={null}
      waHref={null}
      fromJobId="job-1"
      jobTitle="Job"
      matchScore={null}
      matchLocked={false}
      applicationId="application-1"
      currentApplication={rejectedApplication}
      navList={[]}
      navIndex={-1}
      slots={{ summary: <div>Summary</div>, profile: <div>Profile</div>, cv: null, assessments: null }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Reabrir proceso" }));
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "OTHER" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Describe el motivo cuando seleccionas Otro.",
    );
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Nota (obligatoria)"), {
      target: { value: "El candidato aportó nueva evidencia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      intent: "REOPEN_REJECTED",
      expectedVersion: 2,
      reasonCode: "OTHER",
      reasonText: "El candidato aportó nueva evidencia",
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Reabrir proceso" })).not.toBeInTheDocument(),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Proceso reabierto");
  });
});
