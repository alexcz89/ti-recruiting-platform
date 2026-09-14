import { describe, expect, it } from "vitest";

import { buildDemoRequestEmail } from "@/lib/server/mailer";

describe("demo request email", () => {
  it("escapa contenido suministrado por el visitante en el HTML", () => {
    const email = buildDemoRequestEmail({
      name: "<img src=x onerror=alert(1)>",
      company: "Acme & Partners",
      email: "ana@acme.mx",
      role: "People Lead",
      hiringNeeds: "Backend <script>alert(1)</script>",
      message: "Línea uno\nLínea dos",
    });

    expect(email.subject).toBe("Nueva solicitud de demo de TaskIO");
    expect(email.replyTo).toBe("ana@acme.mx");
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("Acme &amp; Partners");
    expect(email.html).toContain("<strong>Nombre:</strong>");
    expect(email.html).toContain("<strong>Empresa:</strong>");
    expect(email.html).toContain("<strong>Correo:</strong>");
    expect(email.html).toContain("<strong>Cargo:</strong>");
    expect(email.html).toContain("People Lead");
    expect(email.html).toContain("<strong>Necesidades de contratación:</strong>");
    expect(email.html).toContain("<strong>Mensaje adicional:</strong>");
    expect(email.html).toContain("Línea uno<br/>Línea dos");
  });
});
