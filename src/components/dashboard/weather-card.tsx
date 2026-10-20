import { Cloud, Droplets, MapPin, RefreshCw, Wind } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { WeatherGlyph } from "@/components/weather/weather-glyph";
import { useWeather } from "@/features/integrations/hooks";
import { usePreferences } from "@/stores/preferences";

export function WeatherCard() {
  const { data, isLoading, isError, refetch, isFetching } = useWeather();
  const location = usePreferences((state) => state.weatherLocation);

  if (isLoading) {
    return (
      <Card className="min-h-[188px] p-5">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="mt-6 h-14 w-32 rounded-2xl" />
        <Skeleton className="mt-5 h-4 w-44 rounded-full" />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="flex min-h-[188px] flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Clima</p>
            <p className="mt-1 text-sm font-medium">{location}</p>
          </div>
          <Cloud className="size-6 text-muted" aria-hidden />
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          No pudimos consultar el clima. El resto de TECLA LIVE sigue disponible.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <Button variant="subtle" size="sm" onClick={() => void refetch()} loading={isFetching}>
            <RefreshCw className="size-3.5" aria-hidden />
            Reintentar
          </Button>
          <Link href="/settings" className="text-[11px] text-muted hover:text-foreground">
            Ajustes
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative min-h-[188px] overflow-hidden p-5">
      <div className="absolute -right-12 -top-16 size-56 rounded-full bg-gradient-to-br from-[#ff8a5c]/25 via-[#ff5a3c]/10 to-transparent blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <MapPin className="size-3" aria-hidden />
            Clima ahora
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-foreground/90">
            {data.location}
          </p>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-amber-300">
          <WeatherGlyph code={data.code} isDay={data.isDay} className="size-6" />
        </span>
      </div>

      <div className="relative mt-4 flex items-end gap-3">
        <span className="text-display text-[3.4rem] leading-none tabular-nums">{data.temperature}°</span>
        <div className="pb-1.5">
          <p className="text-sm font-medium text-foreground">{data.label}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Sensación {data.apparentTemperature}° · {data.isDay ? "Día" : "Noche"}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-4 border-t border-border pt-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <Droplets className="size-3.5" aria-hidden />
          {data.humidity}% humedad
        </span>
        <span className="flex items-center gap-1.5">
          <Wind className="size-3.5" aria-hidden />
          {data.windSpeed} km/h
        </span>
        <Link href="/settings" className="ml-auto text-[10px] hover:text-foreground">
          Ajustar
        </Link>
      </div>
    </Card>
  );
}
