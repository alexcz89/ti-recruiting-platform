// app/api/geo/reverse/route.ts
import { NextResponse } from "next/server";
import { reversePlace } from "@/lib/geo";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "lat/lng inválidos" }, { status: 400 });
  }

  try {
    const place = await reversePlace(lat, lng);
    return NextResponse.json(place);
  } catch (e) {
    console.error("[/api/geo/reverse] error", e);
    return NextResponse.json(null, { status: 200 });
  }
}
