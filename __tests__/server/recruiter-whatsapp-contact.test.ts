import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  buildRecruiterWhatsappHref,
  buildRecruiterWhatsappMessage,
  normalizeMexicanWhatsappPhone,
  type RecruiterWhatsappJob,
} from "@/lib/whatsapp/recruiter-contact";

const publicJob: RecruiterWhatsappJob = {
  title: "Desarrollador Backend Java / APX",
  companyConfidential: false,
  company: { name: "NFQ" },
};

const base = {
  candidateName: "René García",
  recruiterName: "Alejandro Cerda",
  job: publicJob,
};

describe("recruiter WhatsApp contact", () => {
  it("uses the selected public job company", () => {
    expect(buildRecruiterWhatsappMessage(base)).toBe(
      "Hola René, soy Alejandro de NFQ. Te contacto porque te postulaste a la vacante de Desarrollador Backend Java / APX. ¿Tienes disponibilidad para platicar?",
    );
  });

  it("keeps confidential jobs neutral for recruiter and admin callers", () => {
    const confidential = {
      ...base,
      job: { ...publicJob, companyConfidential: true },
    };
    const recruiterMessage = buildRecruiterWhatsappMessage(confidential);
    const adminMessage = buildRecruiterWhatsappMessage(confidential);

    expect(recruiterMessage).toBe(
      "Hola René, soy Alejandro. Te contacto porque te postulaste a la vacante de Desarrollador Backend Java / APX. ¿Tienes disponibilidad para platicar?",
    );
    expect(adminMessage).toBe(recruiterMessage);
    expect(adminMessage).not.toContain("NFQ");
    expect(adminMessage).not.toContain("de la empresa");
  });

  it.each([null, "", "   "])("uses neutral copy when company name is %j", (name) => {
    const message = buildRecruiterWhatsappMessage({
      ...base,
      job: { ...publicJob, company: name === null ? null : { name } },
    });
    expect(message).toContain("Hola René, soy Alejandro. Te contacto");
    expect(message).not.toContain("de la empresa");
  });

  it("uses only the job belonging to the selected application", () => {
    const applications = [
      { id: "application-other", job: { ...publicJob, title: "Otra vacante", company: { name: "Otra empresa" } } },
      { id: "application-selected", job: publicJob },
    ];
    const selected = applications.find((application) => application.id === "application-selected");
    const message = buildRecruiterWhatsappMessage({ ...base, job: selected?.job ?? null });

    expect(message).toContain("de NFQ");
    expect(message).toContain("Desarrollador Backend Java / APX");
    expect(message).not.toContain("Otra empresa");
    expect(message).not.toContain("Otra vacante");
  });

  it("wires the contact identity to the authorized selected application", () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "app", "dashboard", "candidates", "[id]", "page.tsx"),
      "utf8",
    );
    expect(page).toContain("job: currentApplication?.job ?? null");
    expect(page).toContain("companyConfidential: true");
    expect(page).toContain("company: { select: { name: true } }");
    expect(page).not.toContain('company?.name?.trim() || "la empresa"');
  });

  it("encodes accents and special characters in a working WhatsApp link", () => {
    const href = buildRecruiterWhatsappHref({
      ...base,
      phone: "+52 (81) 1234-5678",
      job: { ...publicJob, title: "Desarrollador Java / APIs & Integración" },
    });
    expect(href).not.toBeNull();
    expect(href).toContain("https://wa.me/528112345678?text=");
    expect(href).toContain("Ren%C3%A9");
    expect(href).toContain("%26");
    expect(new URL(href!).searchParams.get("text")).toContain(
      "Desarrollador Java / APIs & Integración",
    );
  });

  it("preserves Mexican phone normalization and omits links without a phone", () => {
    expect(normalizeMexicanWhatsappPhone("81 1234 5678")).toBe("528112345678");
    expect(normalizeMexicanWhatsappPhone("+52 1 81 1234 5678")).toBe("528112345678");
    expect(normalizeMexicanWhatsappPhone("+52 81 1234 5678")).toBe("528112345678");
    expect(buildRecruiterWhatsappHref({ ...base, phone: null })).toBeNull();
  });
});
