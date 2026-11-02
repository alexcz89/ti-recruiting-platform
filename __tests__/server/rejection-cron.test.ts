import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  sendRejectionEmail: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    application: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("@/lib/server/mailer", () => ({
  sendRejectionEmail: mocks.sendRejectionEmail,
}));

import { GET } from "@/app/api/cron/rejections/route";

const NOW = new Date("2026-11-02T18:00:00.000Z");

function request() {
  return new Request("http://localhost/api/cron/rejections", {
    headers: { "x-cron-secret": "test-cron-secret" },
  });
}

const application = {
  id: "application-1",
  stateVersion: 3,
  rejectedAt: new Date("2026-10-30T18:00:00.000Z"),
  candidate: {
    email: "candidate@example.test",
    name: "Candidato de prueba",
  },
  job: {
    title: "Desarrollador",
    company: { name: "Empresa de prueba" },
  },
};

describe("Cron de rechazos", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    process.env.CRON_SECRET = "test-cron-secret";
    mocks.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_SECRET;
  });

  it("utiliza exactamente 72 horas como tiempo de espera", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "REJECTED",
          rejectionEmailSent: false,
          rejectedAt: {
            lte: new Date("2026-10-30T18:00:00.000Z"),
          },
        }),
      })
    );

    expect(mocks.sendRejectionEmail).not.toHaveBeenCalled();
  });


	it("evita enviar si no consigue la reserva del rechazo", async () => {
		mocks.findMany.mockResolvedValue([application]);

		// Simula que el estado cambió o que otra ejecución
		// adquirió la reserva antes de esta operación.
		mocks.updateMany.mockResolvedValueOnce({ count: 0 });

		await GET(request());

		expect(mocks.updateMany).toHaveBeenCalledTimes(1);

		expect(mocks.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					id: application.id,
					stateVersion: application.stateVersion,
					status: "REJECTED",
					rejectedAt: application.rejectedAt,
					rejectionEmailSent: false,
				}),
				data: expect.objectContaining({
					rejectionEmailLeaseToken: expect.any(String),
					rejectionEmailLeaseUntil: expect.any(Date),
				}),
			})
		);

		expect(mocks.sendRejectionEmail).not.toHaveBeenCalled();
	});



	it("envía el correo identificando el periodo de rechazo", async () => {
		mocks.findMany.mockResolvedValue([application]);

		mocks.sendRejectionEmail.mockResolvedValue({
			ok: true,
			id: "email-1",
		});

		// Primera operación: adquirir la reserva.
		// Segunda operación: confirmar el envío.
		mocks.updateMany
			.mockResolvedValueOnce({ count: 1 })
			.mockResolvedValueOnce({ count: 1 });

		const response = await GET(request());

		expect(response.status).toBe(200);

		expect(await response.json()).toMatchObject({
			results: [
				{
					id: application.id,
					ok: true,
				},
			],
		});

		expect(mocks.sendRejectionEmail).toHaveBeenCalledTimes(1);

		expect(mocks.sendRejectionEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationId: application.id,
				rejectedAt: application.rejectedAt,
				to: application.candidate.email,
			})
		);

		expect(mocks.updateMany).toHaveBeenCalledTimes(2);

		const claim = mocks.updateMany.mock.calls[0][0];
		const finalized = mocks.updateMany.mock.calls[1][0];

		expect(claim.data).toEqual(
			expect.objectContaining({
				rejectionEmailLeaseToken: expect.any(String),
				rejectionEmailLeaseUntil: expect.any(Date),
			})
		);

		expect(finalized.where.rejectionEmailLeaseToken).toBe(
			claim.data.rejectionEmailLeaseToken
		);

		expect(finalized.data).toEqual({
			rejectionEmailSent: true,
			rejectionEmailLeaseUntil: null,
			rejectionEmailLeaseToken: null,
		});
	});

  it("evita dos intentos de envío para el mismo periodo de rechazo", async () => {
    mocks.findMany.mockResolvedValue([application]);

    mocks.sendRejectionEmail.mockResolvedValue({
      ok: true,
      id: "email-1",
    });

    let activeLeaseToken: string | null = null;
    let emailSent = false;

    mocks.updateMany.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: {
          stateVersion?: number;
          rejectedAt?: Date | null;
          rejectionEmailSent?: boolean;
          rejectionEmailLeaseToken?: string;
          AND?: unknown;
        };
        data: {
          rejectionEmailLeaseToken?: string | null;
          rejectionEmailSent?: boolean;
        };
      }) => {
        // Simula la adquisición atómica de la reserva.
        if (typeof data.rejectionEmailLeaseToken === "string") {
          expect(where.stateVersion).toBe(application.stateVersion);
          expect(where.rejectedAt).toEqual(application.rejectedAt);
          expect(where.rejectionEmailSent).toBe(false);
          expect(where.AND).toBeDefined();

          if (activeLeaseToken !== null || emailSent) {
            return { count: 0 };
          }

          activeLeaseToken = data.rejectionEmailLeaseToken;
          return { count: 1 };
        }

        // Simula la confirmación del envío por su token.
        if (data.rejectionEmailSent === true) {
          if (where.rejectionEmailLeaseToken !== activeLeaseToken) {
            return { count: 0 };
          }

          emailSent = true;
          activeLeaseToken = null;

          return { count: 1 };
        }

        return { count: 0 };
      }
    );

    await Promise.all([
      GET(request()),
      GET(request()),
    ]);

    expect(mocks.sendRejectionEmail).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledTimes(3);
    expect(emailSent).toBe(true);
  });

	it("libera la reserva si falla el envío del correo", async () => {
		mocks.findMany.mockResolvedValue([application]);

		mocks.sendRejectionEmail.mockResolvedValue({
			error: "Resend no disponible",
		});

		mocks.updateMany.mockResolvedValue({ count: 1 });

		const response = await GET(request());

		expect(mocks.sendRejectionEmail).toHaveBeenCalledTimes(1);
		expect(mocks.updateMany).toHaveBeenCalledTimes(2);

		const claim = mocks.updateMany.mock.calls[0][0];
		const release = mocks.updateMany.mock.calls[1][0];

		expect(release.where).toEqual(
			expect.objectContaining({
				id: application.id,
				rejectionEmailLeaseToken: claim.data.rejectionEmailLeaseToken,
			})
		);

		expect(release.data).toEqual({
			rejectionEmailLeaseUntil: null,
			rejectionEmailLeaseToken: null,
		});

		expect(
			mocks.updateMany.mock.calls.some(
				([args]) => args.data.rejectionEmailSent === true
			)
		).toBe(false);

		expect(await response.json()).toMatchObject({
			results: [
				{
					id: application.id,
					error: "Resend no disponible",
				},
			],
		});
	});

	it("permite recuperar una reserva vencida", async () => {
		mocks.findMany.mockResolvedValue([application]);

		mocks.sendRejectionEmail.mockResolvedValue({
			ok: true,
			id: "email-recuperado",
		});

		// Simula que PostgreSQL concede una reserva vencida
		// y después confirma el envío.
		mocks.updateMany
			.mockResolvedValueOnce({ count: 1 })
			.mockResolvedValueOnce({ count: 1 });

		const response = await GET(request());

		expect(response.status).toBe(200);

		const claim = mocks.updateMany.mock.calls[0][0];

		// Verificar que se puedan reclamar reservas
		// inexistentes o con fecha de vencimiento cumplida.
		expect(claim.where.AND).toEqual([
			{
				OR: [
					{ rejectionEmailLeaseUntil: null },
					{
						rejectionEmailLeaseUntil: {
							lte: expect.any(Date),
						},
					},
				],
			},
		]);

		// La nueva reserva debe durar 10 minutos.
		const leaseUntil = claim.data.rejectionEmailLeaseUntil;
		const leaseCutoff =
			claim.where.AND[0].OR[1].rejectionEmailLeaseUntil.lte;

		expect(leaseUntil.getTime() - leaseCutoff.getTime()).toBe(
			10 * 60 * 1000
		);

		expect(mocks.sendRejectionEmail).toHaveBeenCalledTimes(1);

		expect(await response.json()).toMatchObject({
			results: [
				{
					id: application.id,
					ok: true,
				},
			],
		});
	});

	it("conserva el intento si Resend devuelve un resultado incierto", async () => {
		mocks.findMany.mockResolvedValue([application]);

		mocks.sendRejectionEmail.mockResolvedValue({
			error: "connection timeout",
			deliveryUncertain: true,
		});

		mocks.updateMany.mockResolvedValue({ count: 1 });

		const response = await GET(request());

		expect(response.status).toBe(200);
		expect(mocks.sendRejectionEmail).toHaveBeenCalledTimes(1);
		expect(mocks.updateMany).toHaveBeenCalledTimes(2);

		const claim = mocks.updateMany.mock.calls[0][0];
		const release = mocks.updateMany.mock.calls[1][0];

		// Solo se pueden reclamar candidaturas sin un intento previo.
		expect(claim.where.rejectionEmailAttemptStartedAt).toBeNull();

		// El intento debe registrarse antes de contactar a Resend.
		expect(claim.data.rejectionEmailAttemptStartedAt).toBeInstanceOf(Date);

		// Se libera el lease, pero NO se elimina el intento.
		expect(release.where.rejectionEmailLeaseToken).toBe(
			claim.data.rejectionEmailLeaseToken
		);

		expect(release.data).toEqual({
			rejectionEmailLeaseUntil: null,
			rejectionEmailLeaseToken: null,
		});

		// No marcar como enviado sin confirmación.
		expect(
			mocks.updateMany.mock.calls.some(
				([args]) => args.data.rejectionEmailSent === true
			)
		).toBe(false);

		expect(await response.json()).toMatchObject({
			results: [
				{
					id: application.id,
					error: "connection timeout",
				},
			],
		});
	});
});
