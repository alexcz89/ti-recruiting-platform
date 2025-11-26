// lib/geo.ts
import "server-only";
import mbxGeocoding from "@mapbox/mapbox-sdk/services/geocoding";

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

// Marca rápida para saber si el módulo está habilitado
export const geoIsEnabled = Boolean(MAPBOX_TOKEN);

// Crea el cliente únicamente si existe el token
const geocoding = geoIsEnabled
  ? mbxGeocoding({ accessToken: MAPBOX_TOKEN as string })
  : null;

/** Coordenadas WGS84 */
export type GeoPoint = { lat: number; lng: number };

/** Resultado normalizado a partir de un Feature de Mapbox */
export type GeoFeature = {
  id: string;
  name: string;      // "Monterrey"
  fullName: string;  // "Monterrey, Nuevo León, México"
  type: string;      // "place" | "locality" | "region" | "address" | "poi" ...
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  postcode?: string;
  coords: GeoPoint;  // center
  bbox?: [number, number, number, number] | null; // [minLng, minLat, maxLng, maxLat]
};

/** Util: convierte [lng,lat] a {lat,lng} cuidando el orden */
function toPoint(center: [number, number]): GeoPoint {
  return { lat: center[1], lng: center[0] };
}

/** Normaliza un Feature de Mapbox a nuestro shape */
function normalizeFeature(f: any): GeoFeature {
  const ctx = Array.isArray(f?.context) ? f.context : [];
  // Mapbox guarda jerarquía en "context": country, region, place, locality, etc.
  const get = (type: string) =>
    (ctx.find((c: any) => (c?.id as string)?.startsWith(type + ".")) ?? null) as any;

  const country = get("country");
  const region = get("region") ?? get("district"); // algunos países usan "district"
  const place = get("place");                       // ciudad principal
  const locality = get("locality");                 // localidad/municipio
  const postcode = get("postcode");

  // Para city preferimos "place", si no "locality"
  const city = place?.text ?? locality?.text ?? undefined;

  // center siempre es [lng,lat] en Mapbox; si no viniera, intenta de bbox
  const center: [number, number] =
    Array.isArray(f?.center) && f.center.length === 2
      ? (f.center as [number, number])
      : Array.isArray(f?.bbox) && f.bbox.length === 4
      ? ([(f.bbox[0] + f.bbox[2]) / 2, (f.bbox[1] + f.bbox[3]) / 2] as [number, number])
      : [0, 0];

  return {
    id: String(f?.id ?? ""),
    name: String(f?.text ?? ""),
    fullName: String(f?.place_name ?? ""),
    type: String(f?.place_type?.[0] ?? "unknown"),
    country: country?.text,
    countryCode: country?.short_code?.toUpperCase(),
    region: region?.text,
    city,
    postcode: postcode?.text,
    coords: toPoint(center),
    bbox:
      Array.isArray(f?.bbox) && f.bbox.length === 4
        ? (f.bbox as [number, number, number, number])
        : null,
  };
}

/**
 * Geocodificación directa (forward): texto → lugares.
 * @param query Texto a buscar (ej. "Monterrey", "Av. Reforma 1, CDMX").
 * @param options limit, proximity, language, types (default: ciudades y localidades comunes).
 */
export async function geocodeForward(
  query: string,
  options?: {
    limit?: number;
    proximity?: GeoPoint;          // sugiere resultados cercanos a este punto
    language?: string | string[];  // ej. "es" o ["es","en"]
    types?: string | string[];     // ej. ["place","locality",...]
    country?: string | string[];   // ISO2 (mx,us,es) o array
  }
): Promise<GeoFeature[]> {
  if (!geocoding) return [];
  if (!query || !query.trim()) return [];

  const {
    limit = 5,
    proximity,
    language = ["es"],
    // Predeterminamos a ciudades/localidades/estados y (si aplica) vecindarios/direcciones
    types = ["place", "locality", "region", "district", "neighborhood", "address"],
    country,
  } = options || {};

  const params: any = {
    query,
    limit,
    language: Array.isArray(language) ? language : [language],
    types: Array.isArray(types) ? types : [types],
  };

  if (proximity) params.proximity = [proximity.lng, proximity.lat] as [number, number];
  if (country) params.countries = Array.isArray(country) ? country : [country];

  const res = await geocoding.forwardGeocode(params).send();
  const features = (res?.body?.features ?? []) as any[];
  return features.map(normalizeFeature);
}

/**
 * Autocomplete de ciudades/localidades (rápido para inputs).
 * Limita a tipos: place/locality/region/district.
 */
export async function suggestCities(
  query: string,
  options?: { limit?: number; country?: string | string[]; proximity?: GeoPoint }
): Promise<GeoFeature[]> {
  return geocodeForward(query, {
    limit: options?.limit ?? 8,
    country: options?.country,
    proximity: options?.proximity,
    types: ["place", "locality", "region", "district"],
    language: ["es"],
  });
}

/**
 * Geocodificación inversa (reverse): coordenadas → lugar más relevante.
 */
export async function geocodeReverse(
  point: GeoPoint,
  options?: {
    limit?: number;
    language?: string | string[];
    types?: string | string[];
  }
): Promise<GeoFeature | null> {
  if (!geocoding) return null;

  const {
    limit = 1,
    language = ["es"],
    types = ["address", "place", "locality", "region"],
  } = options || {};

  const res = await geocoding
    .reverseGeocode({
      query: [point.lng, point.lat],
      limit,
      language: Array.isArray(language) ? language : [language],
      types: Array.isArray(types) ? types : [types],
    })
    .send();

  const f = (res?.body?.features ?? [])[0];
  return f ? normalizeFeature(f) : null;
}

/**
 * Toma el primer resultado “tipo ciudad/localidad” como punto canonical.
 * Útil para guardar en User.locationLat/locationLng o Job.locationLat/locationLng.
 */
export async function geocodeCityToPoint(
  query: string,
  country?: string | string[]
): Promise<GeoPoint | null> {
  const results = await suggestCities(query, { limit: 1, country });
  const top = results[0];
  return top ? top.coords : null;
}

/**
 * Distancia en kilómetros entre dos puntos (Haversine).
 */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371; // km
  const dLat = deg2rad(b.lat - a.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const s1 =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(a.lat)) *
      Math.cos(deg2rad(b.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
  return R * c;
}
const deg2rad = (d: number) => (d * Math.PI) / 180;

/**
 * Helper seguro: intenta geocodificar y devuelve null si falla.
 */
export async function tryGeocodeCityToPoint(
  query: string,
  country?: string | string[]
): Promise<GeoPoint | null> {
  try {
    if (!query || !query.trim()) return null;
    return await geocodeCityToPoint(query, country);
    // eslint-disable-next-line no-empty
  } catch {}
  return null;
}

/* =====================================================
 * 🔁 Wrappers de compatibilidad: searchPlaces / reversePlace
 * ==================================================== */

export type SearchPlacesOptions = {
  limit?: number;
  proximity?: GeoPoint;
  language?: string | string[];
  types?: string | string[];
  country?: string | string[];
};

/**
 * ✅ Compatibilidad con código antiguo:
 * searchPlaces(query, options?) → usa geocodeForward por debajo.
 */
export async function searchPlaces(
  query: string,
  options?: SearchPlacesOptions
): Promise<GeoFeature[]> {
  return geocodeForward(query, options);
}

export type ReversePlaceOptions = {
  limit?: number;
  language?: string | string[];
  types?: string | string[];
};

/**
 * ✅ Compatibilidad con código antiguo:
 * Puede llamarse como:
 *   reversePlace({ lat, lng })
 *   reversePlace(lat, lng)
 */
export async function reversePlace(
  point: GeoPoint,
  options?: ReversePlaceOptions
): Promise<GeoFeature | null>;
export async function reversePlace(
  lat: number,
  lng: number,
  options?: ReversePlaceOptions
): Promise<GeoFeature | null>;
export async function reversePlace(
  a: GeoPoint | number,
  b?: number | ReversePlaceOptions,
  c?: ReversePlaceOptions
): Promise<GeoFeature | null> {
  let point: GeoPoint;
  let options: ReversePlaceOptions | undefined;

  if (typeof a === "number") {
    // reversePlace(lat, lng, options?)
    point = { lat: a, lng: (b as number) ?? 0 };
    options = c;
  } else {
    // reversePlace({ lat, lng }, options?)
    point = a;
    options = b as ReversePlaceOptions | undefined;
  }

  return geocodeReverse(point, options);
}
