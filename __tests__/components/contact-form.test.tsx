// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@/lib/analytics", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...original, track: analyticsMocks.track };
});

import ContactForm from "@/app/contact/ContactForm";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Ana Torres" } });
  fireEvent.change(screen.getByLabelText(/Empresa/), { target: { value: "Acme México" } });
  fireEvent.change(screen.getByLabelText(/Correo de trabajo/), {
    target: { value: "ana@acme.mx" },
  });
  fireEvent.change(screen.getByLabelText(/Qué perfiles necesitas contratar/), {
    target: { value: "Dos desarrolladores backend senior" },
  });
}

describe("ContactForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("valida los campos requeridos y el correo en el cliente", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: "Solicitar demo" }));
    expect(await screen.findByText("Ingresa tu nombre.")).toBeInTheDocument();
    expect(screen.getByText("Ingresa el nombre de tu empresa.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Ana Torres" } });
    fireEvent.change(screen.getByLabelText(/Empresa/), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText(/Correo de trabajo/), { target: { value: "ana@" } });
    fireEvent.change(screen.getByLabelText(/Qué perfiles necesitas contratar/), {
      target: { value: "Backend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar demo" }));
    expect(await screen.findByText("Ingresa un correo de trabajo válido.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registra el inicio una sola vez, sin propiedades ni datos del formulario", () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/Empresa/), { target: { value: "Acme" } });

    expect(analyticsMocks.track).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.demoRequestStarted,
    );
  });

  it("muestra éxito y registra conversión después de la confirmación del servidor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Solicitar demo" }));

    expect(
      await screen.findByText("Gracias. Recibimos tu solicitud y te contactaremos pronto."),
    ).toBeInTheDocument();
    expect(analyticsMocks.track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.demoRequestSubmitted,
    );
    expect(analyticsMocks.track).toHaveBeenLastCalledWith(
      ANALYTICS_EVENTS.demoRequestSubmitted,
    );
  });

  it("conserva los datos, permite reintentar y no convierte el intento fallido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: "Servicio temporalmente no disponible." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Solicitar demo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Servicio temporalmente no disponible.",
    );
    expect(screen.getByLabelText(/Nombre/)).toHaveValue("Ana Torres");
    expect(analyticsMocks.track).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.demoRequestSubmitted,
    );

    fireEvent.click(screen.getByRole("button", { name: "Solicitar demo" }));
    expect(await screen.findByText("Solicitud recibida")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(analyticsMocks.track).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.demoRequestSubmitted,
    );
  });

  it("impide dos envíos mientras la primera solicitud sigue pendiente", async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn(
      () => new Promise((resolve) => { resolveRequest = resolve; }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm />);
    fillRequiredFields();

    const button = screen.getByRole("button", { name: "Solicitar demo" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveRequest?.({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) });
    await screen.findByText("Solicitud recibida");
  });

  it("no reenvía una solicitud al montar de nuevo el formulario", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<ContactForm />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar demo" }));
    await screen.findByText("Solicitud recibida");

    view.unmount();
    render(<ContactForm />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
