import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AssessmentQuestion from "@/app/assessments/[templateId]/AssessmentQuestion";

const question = {
  id: "question-a",
  section: "JavaScript",
  difficulty: "MID",
  questionText: "Selecciona una opción",
  options: [{ id: "option-a", text: "Opción A" }],
  allowMultiple: false,
  type: "MULTIPLE_CHOICE" as const,
};

function renderStatus(status: "saving" | "saved" | "unconfirmed") {
  return renderToStaticMarkup(
    <AssessmentQuestion
      question={question}
      selectedOptions={["option-a"]}
      onAnswer={vi.fn()}
      persistenceStatus={status}
    />,
  );
}

describe("assessment answer save status", () => {
  it("never renders Guardada while the server acknowledgement is pending", () => {
    const markup = renderStatus("saving");
    expect(markup).toContain("Guardando…");
    expect(markup).not.toContain(">Guardada<");
  });

  it("renders Guardada only for an acknowledged answer", () => {
    expect(renderStatus("saved")).toContain("Guardada");
  });

  it("renders No confirmada after a failed save", () => {
    expect(renderStatus("unconfirmed")).toContain("No confirmada");
  });
});
