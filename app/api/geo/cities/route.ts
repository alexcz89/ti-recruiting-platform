// app/api/geo/cities/route.ts
import { NextResponse } from "next/server";
import { geoIsEnabled, suggestCities } from "@/lib/geo";

// Fuerza Node.js runtime (el SDK de Mapbox necesita Node, no Edge)
export const runtime = "nodejs";

export async function GET(req: Request) {
  const t0 = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const countries = searchParams.getAll("country").map((c) => c.toLowerCase());
    const debug = searchParams.get("debug") === "1";

    if (!q) {
      if (debug) {
        return NextResponse.json({ meta: { q, note: "empty query" }, items: [] }, { status: 200 });
      }
      return NextResponse.json([], { status: 200 });
    }

    if (!geoIsEnabled) {
      console.warn("[/api/geo/cities] geoIsEnabled=false (¿MAPBOX_TOKEN en .env?)");
      if (debug) {
        return NextResponse.json({ meta: { q, geoIsEnabled: false }, items: [] }, { status: 200 });
      }
      return NextResponse.json([], { status: 200 });
    }

    const results = await suggestCities(q, {
      limit: 8,
      country: countries.length ? countries : undefined,
    });

    const payload = results.map((r) => ({
      id: r.id,
      fullName: r.fullName,
    }));

    // Log básico al server
    console.log("[/api/geo/cities] q=%s country=%o -> %d resultados en %dms",
      q, countries, payload.length, Date.now() - t0);

    if (debug) {
      return NextResponse.json(
        {
          meta: {
            q,
            countries,
            count: payload.length,
            tookMs: Date.now() - t0,
            geoIsEnabled: true,
            sample: results[0] ? {
              id: results[0].id,
              name: results[0].name,
              fullName: results[0].fullName,
              type: results[0].type,
              countryCode: results[0].countryCode,
              coords: results[0].coords,
            } : null,
          },
          items: payload,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("[/api/geo/cities] ERROR:", err);
    // En debug devuelve más info
    const body = { error: true, message: String(err?.message || err) };
    return NextResponse.json(body, { status: 200 });
  }
}
