// app/api/geo/reverse/route.ts
import { NextResponse } from "next/server";
import { reversePlace } from "@/lib/geo";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  const isValidLat = Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const isValidLng = Number.isFinite(lng) && lng >= -180 && lng <= 180;

  if (!isValidLat || !isValidLng) {
    return NextResponse.json(
      { error: "lat/lng inválidos" },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  try {
    const place = await reversePlace(lat, lng);
    return NextResponse.json(place, {
      status: 200,
      headers: CACHE_HEADERS,
    });
  } catch (e) {
    console.error("[/api/geo/reverse] error", e);
    return NextResponse.json(null, {
      status: 200,
      headers: CACHE_HEADERS,
    });
  }
}