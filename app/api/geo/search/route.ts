// app/api/geo/search/route.ts
import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/geo";

// El SDK de Mapbox usa Node, no Edge
export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const q = (searchParams.get("q") || "").trim();
  const limitParam = Number(searchParams.get("limit") || "5");
  const lngParam = searchParams.get("lng");
  const latParam = searchParams.get("lat");

  const countriesParam = searchParams.get("countries");
  const countries = countriesParam
    ? countriesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Si no hay query, regresamos arreglo vacío (más barato)
  if (!q) {
    return NextResponse.json([], {
      status: 200,
      headers: CACHE_HEADERS,
    });
  }

  if (q.length > 100) {
    return NextResponse.json([], {
      status: 400,
      headers: CACHE_HEADERS,
    });
  }

  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.max(limitParam, 1), 10)
      : 5;

  const lng = lngParam !== null ? Number(lngParam) : null;
  const lat = latParam !== null ? Number(latParam) : null;

  const proximity =
    Number.isFinite(lng) && Number.isFinite(lat)
      ? { lng: lng as number, lat: lat as number }
      : undefined;

  try {
    const results = await searchPlaces(q, {
      limit,
      language: ["es"],
      country: countries.length ? countries : undefined,
      proximity,
    });

    return NextResponse.json(results, {
      status: 200,
      headers: CACHE_HEADERS,
    });
  } catch (e) {
    console.error("[/api/geo/search] error", e);
    // No rompemos UX: regresamos []
    return NextResponse.json([], {
      status: 200,
      headers: CACHE_HEADERS,
    });
  }
}