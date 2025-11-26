// global.d.ts

// ---------------------------------------------------------------------------
// google-libphonenumber (no tiene tipos)
// ---------------------------------------------------------------------------
declare module "google-libphonenumber" {
  export const PhoneNumberUtil: any;
  export const PhoneNumberFormat: any;
}

// ---------------------------------------------------------------------------
// Mapbox Geocoding SDK (no existen @types/mapbox__mapbox-sdk)
// ---------------------------------------------------------------------------
declare module "@mapbox/mapbox-sdk/services/geocoding" {
  const mbxGeocoding: any;
  export default mbxGeocoding;
}
