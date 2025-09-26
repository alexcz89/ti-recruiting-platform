// app/api/geo/search/route.ts
import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/geo";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = Number(searchParams.get("limit") || 5);
  const countries = searchParams.get("countries")?.split(",").map(s => s.trim()).filter(Boolean);
  const lng = searchParams.get("lng");
  const lat = searchParams.get("lat");

  try {
    const results = await searchPlaces(q, {
      limit: Math.min(Math.max(limit, 1), 10),
      language: ["es"],
      countries: countries && countries.length ? countries : undefined,
      proximity: (lng && lat) ? { lng: Number(lng), lat: Number(lat) } : undefined,
    });

    // Cache suave (1 min) + revalidación
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    console.error("[/api/geo/search] error", e);
    return NextResponse.json([], { status: 200 });
  }
}
