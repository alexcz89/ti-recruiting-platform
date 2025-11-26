// app/api/geo/search/route.ts
import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/geo";

// El SDK de Mapbox usa Node, no Edge
export const runtime = "nodejs";

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
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }

  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.max(limitParam, 1), 10)
      : 5;

  try {
    const results = await searchPlaces(q, {
      limit,
      language: ["es"],
      // 👇 nombre correcto en SearchPlacesOptions es `country`, no `countries`
      country: countries.length ? countries : undefined,
      proximity:
        lngParam && latParam
          ? { lng: Number(lngParam), lat: Number(latParam) }
          : undefined,
    });

    // Cache suave (1 min) + stale-while-revalidate
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    console.error("[/api/geo/search] error", e);
    // No rompemos UX: regresamos []
    return NextResponse.json([], { status: 200 });
  }
}
