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

  it("shows NFQ topic titles without invented counts or times", () => {
    const html = renderToStaticMarkup(
      <AssessmentIntro
        template={{
          title: "NFQ - Java Junior",
          totalQuestions: 34,
          timeLimit: 30,
          passingScore: 50,
          sections: [
            { title: "Fundamentos de Java" },
            { title: "Java 8 / Streams / Lambdas" },
            { title: "Git y HTTP básico" },
          ],
        }}
        onStart={() => undefined}
      />,
    );

    expect(html).toContain("Temas que se evaluarán");
    expect(html).toContain("Fundamentos de Java");
    expect(html).toContain("Java 8 / Streams / Lambdas");
    expect(html).toContain("Git y HTTP básico");
    expect(html).not.toContain("Sección 1");
    expect(html).not.toContain("— preguntas");
    expect(html).not.toContain("~—");
  });

  it("supports legacy name-based topics and omits generic, blank and duplicate labels", () => {
    const html = renderToStaticMarkup(
      <AssessmentIntro
        template={{
          title: "QA Assessment",
          sections: [
            { name: "Arrays y Objetos", questions: 5 },
            { title: " ", name: "arrays y objetos" },
            { name: "Sección 2" },
            { title: "General" },
            { title: "" },
            { name: "ES6+ y Asincronía" },
          ],
        }}
        onStart={() => undefined}
      />,
    );

    expect(html).toContain("Temas que se evaluarán");
    expect(html).toContain("Arrays y Objetos");
    expect(html).toContain("ES6+ y Asincronía");
    expect(html.match(/Arrays y Objetos/g)).toHaveLength(1);
    expect(html).not.toContain("Sección 2");
    expect(html).not.toContain("— preguntas");
  });

  it("hides topics entirely when no meaningful section titles exist", () => {
    const html = renderToStaticMarkup(
      <AssessmentIntro
        template={{
          title: "QA Assessment",
          sections: [{ name: "Sección 1" }, { name: "General" }, {}, null],
        }}
        onStart={() => undefined}
      />,
    );

    expect(html).not.toContain("Temas que se evaluarán");
    expect(html).toContain("Instrucciones");
    expect(html).toContain("Comenzar evaluación");
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
