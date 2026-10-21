/**
 * Saludo de arranque de TECLA AI, construido localmente (sin DeepSeek) con la
 * hora, el clima real y lo que quedó pendiente. Solo cuesta una síntesis de voz.
 */
export function buildGreeting(input: {
  hour: number;
  persona: "jarvis" | "copiloto" | "kitt";
  weather: { temperature: number; label: string; location: string } | null;
  pendingTitle: string | null;
}): string {
  const { hour, persona, weather, pendingTitle } = input;
  const moment = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const kitt = persona === "kitt";
  const jarvis = persona === "jarvis" || kitt;
  const parts: string[] = [];
  parts.push(kitt ? `${moment}, señor. Escáner activo y sistemas en línea.` : jarvis ? `${moment}, señor. Sistemas en línea.` : `${moment}.`);
  if (weather) {
    const city = weather.location.split(",")[0]?.trim() ?? weather.location;
    parts.push(`${Math.round(weather.temperature)} grados y ${weather.label.toLowerCase()} en ${city}.`);
  }
  if (pendingTitle) {
    const title = pendingTitle.length > 60 ? `${pendingTitle.slice(0, 57)}…` : pendingTitle;
    parts.push(jarvis ? `Dejó a medias «${title}»; puedo retomarlo.` : `Dejaste a medias «${title}»; puedo retomarlo.`);
  }
  parts.push(kitt ? "¿Adónde vamos hoy, señor? ¿Qué desea escuchar?" : jarvis ? "¿Qué desea escuchar?" : "¿Qué quieres escuchar?");
  return parts.join(" ");
}
