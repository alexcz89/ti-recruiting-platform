// app/api/og/job/route.tsx
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/server/prisma";

// Node runtime (no edge) para compatibilidad con Prisma
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
}

function labelEmployment(type: string | null | undefined) {
  switch (type) {
    case "FULL_TIME":  return "Tiempo completo";
    case "PART_TIME":  return "Medio tiempo";
    case "CONTRACT":   return "Por periodo";
    case "INTERNSHIP": return "Prácticas";
    default:           return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      title: true,
      city: true,
      employmentType: true,
      locationType: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      company: { select: { name: true } },
    },
  });

  if (!job) return new Response("Not found", { status: 404 });

  const currency = job.currency ?? "MXN";
  const salary =
    job.salaryMin && job.salaryMax
      ? `${currency} ${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`
      : job.salaryMin
      ? `Desde ${currency} ${fmt(job.salaryMin)}`
      : job.salaryMax
      ? `Hasta ${currency} ${fmt(job.salaryMax)}`
      : null;

  const locationLabel =
    job.locationType === "REMOTE"
      ? "Remoto"
      : job.city ?? null;

  const chips = [
    job.company?.name,
    locationLabel,
    labelEmployment(job.employmentType),
    salary,
  ].filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top: logo/brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            }}
          />
          <span style={{ fontSize: "22px", fontWeight: 700, color: "#18181b", letterSpacing: "-0.5px" }}>
            TaskIO
          </span>
        </div>

        {/* Center: título */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
          <div
            style={{
              fontSize: job.title.length > 40 ? 52 : 62,
              fontWeight: 800,
              color: "#09090b",
              lineHeight: 1.1,
              letterSpacing: "-1.5px",
              maxWidth: "900px",
            }}
          >
            {job.title}
          </div>
        </div>

        {/* Bottom: chips de info */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {chips.map((chip, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 20px",
                borderRadius: "999px",
                background: i === 0 ? "#f0fdf4" : "#f4f4f5",
                border: i === 0 ? "1.5px solid #bbf7d0" : "1.5px solid #e4e4e7",
                fontSize: "22px",
                fontWeight: i === 0 ? 700 : 500,
                color: i === 0 ? "#15803d" : "#3f3f46",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}