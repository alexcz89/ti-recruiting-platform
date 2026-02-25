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
    case "FULL_TIME": return "Tiempo completo";
    case "PART_TIME": return "Medio tiempo";
    case "CONTRACT": return "Por periodo";
    case "INTERNSHIP": return "Prácticas";
    default: return null;
  }
}

function getLogoDataUrl(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "TASKIO_black.png");
    const buffer = fs.readFileSync(logoPath);

    // Corregido: si es PNG debe ser image/png
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
    job.locationType === "REMOTE" ? "Remoto" : job.city ?? null;

  const chips = [
    locationLabel,
    labelEmployment(job.employmentType),
    salary,
  ].filter(Boolean) as string[];

  const logoDataUrl = getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "630px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Top border */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: "linear-gradient(90deg, #10b981, #7c3aed)",
          }}
        />

        {/* Logo */}
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoDataUrl}
            alt="TaskIO"
            style={{
              width: "300px",
              objectFit: "contain",
              marginBottom: "36px",
            }}
          />
        ) : (
          <div
            style={{
              fontSize: "72px",
              fontWeight: 900,
              color: "white",
              letterSpacing: "-2px",
              marginBottom: "36px",
            }}
          >
            TASK<span style={{ color: "#10b981" }}>IO</span>
          </div>
        )}

        {/* Separator */}
        <div
          style={{
            width: "40px",
            height: "3px",
            background: "#10b981",
            borderRadius: "2px",
            marginBottom: "28px",
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: job.title.length > 35 ? 26 : 32,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: "520px",
            marginBottom: "12px",
            padding: "0 40px",
          }}
        >
          {job.title}
        </div>

        {/* Company */}
        {job.company?.name && (
          <div
            style={{
              fontSize: "19px",
              fontWeight: 600,
              color: "#10b981",
              marginBottom: "20px",
            }}
          >
            {job.company.name}
          </div>
        )}

        {/* Chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            justifyContent: "center",
            padding: "0 40px",
          }}
        >
          {chips.map((chip, i) => (
            <div
              key={i}
              style={{
                padding: "5px 14px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontSize: "15px",
                color: "#a1a1aa",
              }}
            >
              {chip}
            </div>
          ))}
        </div>

        {/* Bottom border */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: "linear-gradient(90deg, #7c3aed, #10b981)",
          }}
        />
      </div>
    ),
    { width: 630, height: 630 }
  );
}