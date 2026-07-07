// app/api/og/badge/route.tsx
// OG image para la página pública de badges — preview en LinkedIn/redes.
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/server/prisma";
import { badgeLevelLabel } from "@/lib/badges";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const slug = searchParams.get("slug");

  if (!slug) return new Response("Missing slug", { status: 400 });

  const badge = await prisma.candidateBadge.findUnique({
    where: { slug },
    select: {
      level: true,
      isPublic: true,
      earnedAt: true,
      term: { select: { label: true } },
      candidate: { select: { name: true, firstName: true, lastName: true } },
    },
  });

  if (!badge || !badge.isPublic) {
    return new Response("Not found", { status: 404 });
  }

  const name =
    badge.candidate.name ||
    [badge.candidate.firstName, badge.candidate.lastName]
      .filter(Boolean)
      .join(" ") ||
    "Candidato Taskio";
  const levelLabel = badgeLevelLabel(badge.level);
  const logo = getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f766e",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: 60,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: "#ffffff",
            borderRadius: 24,
            padding: "48px 72px",
            color: "#18181b",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 20,
              backgroundColor: "#0d9488",
              color: "#ffffff",
              fontSize: 48,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 22,
              fontWeight: 600,
              color: "#0d9488",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Skill verificado
          </div>
          <div style={{ marginTop: 8, fontSize: 54, fontWeight: 800 }}>
            {badge.term.label} · {levelLabel}
          </div>
          <div style={{ marginTop: 16, fontSize: 30, color: "#52525b" }}>
            {name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 40,
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt="TaskIO"
              width={140}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: 10,
                padding: "8px 14px",
              }}
            />
          ) : (
            <span>TaskIO</span>
          )}
          <span>Certifícate gratis en taskio.com.mx</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
