// app/api/geo/cities/route.ts
import { NextResponse } from "next/server";
import { geoIsEnabled, suggestCities } from "@/lib/geo";

// Fuerza Node.js runtime (el SDK/proveedor necesita Node, no Edge)
export const runtime = "nodejs";

// helpers
function stripDiacriticsLower(s: string | null | undefined) {
  if (!s) return null;
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Normaliza la salida de suggestCities() a un objeto de "place" que el wizard puede usar:
 * {
 *   label, city, admin1, country, cityNorm, admin1Norm, lat, lng
 * }
 *
 * Nota: country intenta ser ISO-2 si suggestCities la expone (countryCode),
 * si no, usamos el último fragmento de fullName como etiqueta país (no ISO).
 */
function mapToPlace(r: any) {
  const id: string = String(r.id ?? "");
  const name: string = String(r.name ?? "");
  const fullName: string = String(r.fullName ?? name);

  // Heurística: "Ciudad, Estado/Región, País"
  const parts = fullName.split(",").map((s: string) => s.trim()).filter(Boolean);
  const city = parts[0] || name || null;
  const admin1 = parts.length >= 3 ? parts[1] : (parts.length === 2 ? parts[1] : null);
  // Si lib/geo expone countryCode (ISO-2), úsalo; si no, dejamos null.
  const countryIso2 = (r.countryCode ? String(r.countryCode).toUpperCase() : null) || null;

  const lat = r?.coords?.lat ?? null;
  const lng = r?.coords?.lng ?? null;

  const label = fullName || [city, admin1, countryIso2].filter(Boolean).join(", ");

  return {
    // mantenemos id/fullName por compatibilidad con clientes viejos que sólo pintan texto
    id,
    fullName: label,

    // campos estructurados que el JobWizard puede mandar al backend
    label,
    city,
    admin1,
    country: countryIso2, // <- pensado para tu columna @db.VarChar(2)
    cityNorm: stripDiacriticsLower(city),
    admin1Norm: stripDiacriticsLower(admin1),
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
  };
}

export async function GET(req: Request) {
  const t0 = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const countries = searchParams.getAll("country").map((c) => c.toLowerCase());
    const debug = searchParams.get("debug") === "1";

    if (!q) {
      const empty = [];
      if (debug) {
        return NextResponse.json({ meta: { q, note: "empty query" }, items: empty }, { status: 200 });
      }
      return NextResponse.json(empty, { status: 200 });
    }

    if (!geoIsEnabled) {
      console.warn("[/api/geo/cities] geoIsEnabled=false (¿MAPBOX_TOKEN en .env?)");
      const empty = [];
      if (debug) {
        return NextResponse.json({ meta: { q, geoIsEnabled: false }, items: empty }, { status: 200 });
      }
      return NextResponse.json(empty, { status: 200 });
    }

    const results = await suggestCities(q, {
      limit: 8,
      country: countries.length ? countries : undefined,
    });

    // 👉 ahora devolvemos objetos con estructura completa
    const places = (results || []).map(mapToPlace);

    // Log básico al server
    console.log(
      "[/api/geo/cities] q=%s country=%o -> %d resultados en %dms",
      q,
      countries,
      places.length,
      Date.now() - t0
    );

    if (debug) {
      return NextResponse.json(
        {
          meta: {
            q,
            countries,
            count: places.length,
            tookMs: Date.now() - t0,
            geoIsEnabled: true,
            sample: results[0]
              ? {
                  id: results[0].id,
                  name: results[0].name,
                  fullName: results[0].fullName,
                  type: results[0].type,
                  countryCode: results[0].countryCode,
                  coords: results[0].coords,
                  mapped: places[0],
                }
              : null,
          },
          items: places,
        },
        { status: 200 }
      );
    }

    // Sin debug devolvemos directamente el arreglo (más simple para el cliente)
    return NextResponse.json(places, { status: 200 });
  } catch (err: any) {
    console.error("[/api/geo/cities] ERROR:", err);
    // No romper UX: responde arreglo vacío cuando falla
    if (searchParams.get("debug") === "1") {
      return NextResponse.json({ error: true, message: String(err?.message || err) }, { status: 200 });
    }
    return NextResponse.json([], { status: 200 });
  }
}
