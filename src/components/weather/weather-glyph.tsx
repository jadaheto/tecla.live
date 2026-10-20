import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";
import { describeWeather } from "@/lib/weather-codes";
import { cn } from "@/lib/utils";

export function WeatherGlyph({
  code,
  isDay,
  className,
}: {
  code: number;
  isDay: boolean;
  className?: string;
}) {
  const group = describeWeather(code).group;
  const props = { className: cn("size-6", className), "aria-hidden": true as const };

  switch (group) {
    case "clear":
      return isDay ? <Sun {...props} /> : <Moon {...props} />;
    case "clouds":
      return isDay ? <CloudSun {...props} /> : <CloudMoon {...props} />;
    case "fog":
      return <CloudFog {...props} />;
    case "drizzle":
      return <CloudDrizzle {...props} />;
    case "rain":
      return <CloudRain {...props} />;
    case "snow":
      return <CloudSnow {...props} />;
    case "storm":
      return <CloudLightning {...props} />;
    default:
      return <Cloud {...props} />;
  }
}
