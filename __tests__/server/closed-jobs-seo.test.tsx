import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/server/prisma";
import JobDetail, { generateMetadata } from "@/app/jobs/[slug]/page";
import ExampleTechProfiles from "@/components/jobs/ExampleTechProfiles";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => null),
}));

vi.mock("@/lib/server/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    job: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    application: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/server/session", () => ({
  getSessionCompanyId: vi.fn(async () => null),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("@/lib/ai/matchScore", () => ({
  buildCandidateSkillInputs: vi.fn(() => []),
  buildJobSkillInputs: vi.fn(() => []),
  computeMatchScore: vi.fn(() => null),
  hasMatchSignals: vi.fn(() => false),
}));

vi.mock("@/components/jobs/JobDetailPanel", () => ({
  default: () => <div data-testid="active-job-panel">Detalle activo</div>,
}));

vi.mock("@/components/Footer", () => ({
  default: () => null,
}));

const job = {
  id: "test-job-1",
  slug: "test-job",
  title: "Desarrollador Java",
  status: "OPEN",
  description: "Prueba de vacante",
  descriptionHtml: null,
  city: "Monterrey",
  admin1: "Nuevo Leon",
  country: "MX",
  location: "Monterrey",
  locationType: "ONSITE",
  employmentType: "FULL_TIME",
  remote: false,
  skills: [],
  requiredSkills: [],
  seniority: null,
  minYearsExperience: null,
  salaryMin: null,
  salaryMax: null,
  showSalary: false,
  companyConfidential: false,
  currency: "MXN",
  companyId: "test-company",
  company: {
    id: "test-company",
    name: "Empresa de prueba",
    logoUrl: null,
  },
  createdAt: new Date("2026-11-01T00:00:00Z"),
  updatedAt: new Date("2026-11-01T00:00:00Z"),
};

function mockJob(status: string) {
  const fixture = { ...job, status };

  vi.mocked(prisma.job.findUnique).mockImplementation(
    ((args: any) =>
      Promise.resolve(
        args.where.slug
          ? { id: fixture.id, slug: fixture.slug }
          : fixture
      )) as any
  );
}

describe("SEO y disponibilidad de vacantes", () => {
  beforeEach(() => {
    vi.mocked(prisma.job.findUnique).mockReset();
  });

  it.each(["CLOSED", "PAUSED"])(
    "%s muestra aviso y bloquea controles de postulación",
    async (status) => {
      mockJob(status);

      const html = renderToStaticMarkup(
        await JobDetail({ params: { slug: job.slug } })
      );

      expect(html).toContain("Vacante no disponible");
      expect(html).toContain("Ver vacantes disponibles");
      expect(html).not.toContain("Postularme");
      expect(html).not.toContain("Inicia sesión para postularte");
      expect(html).not.toContain("JobPosting");
      expect(html).not.toContain("active-job-panel");
    }
  );

  it.each(["CLOSED", "PAUSED"])(
    "%s genera metadata noindex",
    async (status) => {
      mockJob(status);

      const metadata = await generateMetadata({
        params: { slug: job.slug },
      });

      expect(metadata.robots).toEqual({
        index: false,
        follow: true,
      });
    }
  );

  it("OPEN mantiene la pagina activa y JobPosting", async () => {
    mockJob("OPEN");

    const metadata = await generateMetadata({
      params: { slug: job.slug },
    });

    const html = renderToStaticMarkup(
      await JobDetail({ params: { slug: job.slug } })
    );

    expect(metadata.robots).toBeUndefined();
    expect(html).toContain("active-job-panel");
    expect(html).toContain("JobPosting");
  });

  it("los seis perfiles de ejemplo no son vacantes activas", () => {
    const html = renderToStaticMarkup(<ExampleTechProfiles />);

    expect(
      html.match(/No es una vacante activa/g)
    ).toHaveLength(6);

    expect(html).not.toContain("Postularme");
    expect(html).not.toContain("JobPosting");
  });
});
