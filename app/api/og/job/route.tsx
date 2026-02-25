// app/api/og/job/route.tsx
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/server/prisma";
import fs from "fs";
import path from "path";

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

// Lee el logo una vez y lo convierte a data URL para usarlo en ImageResponse
function getLogoDataUrl(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "TASKIO_black.png");
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return "";
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

  const logoDataUrl = getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
          background: "#09090b",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Acento de color arriba a la izquierda */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "6px",
            height: "100%",
            background: "linear-gradient(180deg, #10b981 0%, #7c3aed 100%)",
          }}
        />

        {/* Top: logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDataUrl}
              alt="TaskIO"
              style={{ height: "44px", objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: "28px", fontWeight: 800, color: "white", letterSpacing: "-1px" }}>
              TASK<span style={{ color: "#10b981" }}>IO</span>
            </span>
          )}
        </div>

        {/* Center: título vacante */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {job.company?.name && (
            <div style={{ fontSize: "22px", fontWeight: 500, color: "#10b981", letterSpacing: "0.5px" }}>
              {job.company.name}
            </div>
          )}
          <div
            style={{
              fontSize: job.title.length > 40 ? 52 : 64,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.05,
              letterSpacing: "-2px",
              maxWidth: "1000px",
            }}
          >
            {job.title}
          </div>
        </div>

        {/* Bottom: chips */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {chips.filter((_, i) => i > 0).map((chip, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 20px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.06)",
                border: "1.5px solid rgba(255,255,255,0.12)",
                fontSize: "20px",
                fontWeight: 500,
                color: "#d4d4d8",
              }}
            >
              {chip}
            </div>
          ))}
          {/* taskio.com.mx badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "auto",
              padding: "8px 20px",
              borderRadius: "999px",
              background: "rgba(16,185,129,0.12)",
              border: "1.5px solid rgba(16,185,129,0.3)",
              fontSize: "18px",
              fontWeight: 600,
              color: "#10b981",
            }}
          >
            taskio.com.mx
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}