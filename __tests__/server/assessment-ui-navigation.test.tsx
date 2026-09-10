import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { assessmentInvitationPath } from "@/lib/assessments/navigation";
import { NOTIFICATION_TEMPLATES } from "@/lib/notifications/templates";
import { CandidateAssessmentAction } from "@/app/assessments/CandidateAssessmentAction";
import AssessmentIntro from "@/app/assessments/[templateId]/AssessmentIntro";

describe("assessment candidate navigation", () => {
  it("builds the canonical relative notification href with the invite token", () => {
    const href = assessmentInvitationPath({
      templateId: "template / uno",
      token: "token?qa=preview&candidate=1",
      inviteUrl:
        "https://www.taskio.com.mx/assessments/wrong-template?token=wrong-token",
    });

    expect(href).toBe(
      "/assessments/template%20%2F%20uno?token=token%3Fqa%3Dpreview%26candidate%3D1",
    );
    expect(href).not.toContain("taskio.com.mx");
  });

  it("normalizes legacy absolute notification metadata onto the current app", () => {
    const href = assessmentInvitationPath({
      templateId: "template-a",
      inviteUrl:
        "https://www.taskio.com.mx/assessments/template-a?token=legacy-token%2Fqa",
    });

    expect(href).toBe("/assessments/template-a?token=legacy-token%2Fqa");
    expect(href.startsWith("/")).toBe(true);
  });

  it("uses the canonical assessment route in generated notification actions", () => {
    const href = NOTIFICATION_TEMPLATES.ASSESSMENT_INVITATION.actionUrl({
      templateId: "template-a",
      token: "invite-token-a",
      inviteUrl:
        "https://www.taskio.com.mx/assessments/template-a?token=invite-token-a",
    });

    expect(href).toBe("/assessments/template-a?token=invite-token-a");
  });

  it("renders an expired invite without a clickable start or restart action", () => {
    const html = renderToStaticMarkup(
      <CandidateAssessmentAction
        state="EXPIRED"
        startUrl="/assessments/template-a?token=expired-token"
        resumeUrl="/assessments/template-a?attemptId=attempt-a"
      />,
    );

    expect(html).toContain("Invitación expirada");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("Comenzar evaluación");
    expect(html).not.toContain("Reiniciar");
  });

  it("keeps a valid in-progress attempt actionable after invite expiration", () => {
    const html = renderToStaticMarkup(
      <CandidateAssessmentAction
        state="IN_PROGRESS"
        startUrl="/assessments/template-a?token=expired-token"
        resumeUrl="/assessments/template-a?attemptId=attempt-active"
      />,
    );

    expect(html).toContain('href="/assessments/template-a?attemptId=attempt-active"');
    expect(html).toContain("Continuar");
  });

  it("does not render an active action for an expired attempt", () => {
    const html = renderToStaticMarkup(
      <CandidateAssessmentAction
        state="EXPIRED"
        startUrl="/assessments/template-a?token=invite-token"
        resumeUrl="/assessments/template-a?attemptId=attempt-expired"
      />,
    );

    expect(html).toContain("Invitación expirada");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("Continuar");
  });

  it("renders the assessment detail as expired instead of startable", () => {
    const html = renderToStaticMarkup(
      <AssessmentIntro
        template={{ title: "QA Assessment" }}
        onStart={() => undefined}
        accessState="EXPIRED"
      />,
    );

    expect(html).toContain("Invitación expirada");
    expect(html).toContain("pide al reclutador");
    expect(html).not.toContain("Comenzar evaluación");
    expect(html).not.toContain("<button");
  });

  it("renders continue on detail for a valid in-progress attempt", () => {
    const html = renderToStaticMarkup(
      <AssessmentIntro
        template={{ title: "QA Assessment" }}
        onStart={() => undefined}
        accessState="IN_PROGRESS"
      />,
    );

    expect(html).toContain("Continuar evaluación");
    expect(html).toContain("<button");
  });
});
