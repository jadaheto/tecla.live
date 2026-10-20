import { Cloud } from "lucide-react";
import { useWeather } from "@/features/integrations/hooks";
import { WeatherGlyph } from "@/components/weather/weather-glyph";
import { cn } from "@/lib/utils";

export function WeatherPill({ className }: { className?: string }) {
  const { data, isLoading, isError } = useWeather();

  if (isLoading) {
    return (
      <div
        className={cn(
          "hidden h-11 w-[148px] animate-pulse rounded-full bg-surface lg:block",
          className,
        )}
        aria-hidden
      />
    );
  }

  if (isError || !data) {
    return (
      <div
        className={cn(
          "hidden items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-xs text-muted lg:flex",
          className,
        )}
        title="No pudimos consultar el clima"
      >
        <Cloud className="size-4" aria-hidden />
        <span>Clima no disponible</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "hidden items-center gap-2.5 rounded-full border border-border bg-surface px-3.5 py-2 lg:flex",
        className,
      )}
      title={`${data.label} en ${data.location}. Sensación ${data.apparentTemperature}°`}
    >
      <WeatherGlyph code={data.code} isDay={data.isDay} className="size-4 text-amber-300" />
      <span className="text-sm font-medium tabular-nums text-foreground">{data.temperature}°</span>
      <span className="max-w-[112px] truncate text-[11px] text-muted">{data.label}</span>
    </div>
  );
}
