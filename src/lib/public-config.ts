export const publicConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  weatherLocation:
    process.env.NEXT_PUBLIC_WEATHER_LOCATION ?? "Sincelejo, Sucre, Colombia",
  weatherLat: Number(process.env.NEXT_PUBLIC_WEATHER_LAT ?? "9.3047"),
  weatherLon: Number(process.env.NEXT_PUBLIC_WEATHER_LON ?? "-75.3978"),
  timeZone: "America/Bogota",
  locale: "es-CO",
} as const;
