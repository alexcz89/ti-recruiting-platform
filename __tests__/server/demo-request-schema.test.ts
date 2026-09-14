import { describe, expect, it } from "vitest";

import { DemoRequestSchema } from "@/lib/contact/demo-request";

const validRequest = {
  name: "Ana Torres",
  company: "Acme México",
  email: "ANA@ACME.MX",
  role: "People Lead",
  hiringNeeds: "Dos desarrolladores backend senior",
  message: "Queremos conocer las evaluaciones.",
  website: "",
};

describe("DemoRequestSchema", () => {
  it("normaliza una solicitud válida", () => {
    const result = DemoRequestSchema.parse(validRequest);

    expect(result.email).toBe("ana@acme.mx");
    expect(result.name).toBe("Ana Torres");
  });

  it.each(["name", "company", "email", "hiringNeeds"] as const)(
    "requiere %s",
    (field) => {
      expect(
        DemoRequestSchema.safeParse({ ...validRequest, [field]: "" }).success,
      ).toBe(false);
    },
  );

  it("rechaza correos inválidos, campos demasiado largos y propiedades inesperadas", () => {
    expect(
      DemoRequestSchema.safeParse({ ...validRequest, email: "ana@" }).success,
    ).toBe(false);
    expect(
      DemoRequestSchema.safeParse({ ...validRequest, message: "x".repeat(1001) }).success,
    ).toBe(false);
    expect(
      DemoRequestSchema.safeParse({ ...validRequest, unexpected: "value" }).success,
    ).toBe(false);
  });

  it("rechaza caracteres de control en campos usados en el correo", () => {
    expect(
      DemoRequestSchema.safeParse({ ...validRequest, company: "Acme\r\nBcc: victim@example.com" })
        .success,
    ).toBe(false);
  });
});
