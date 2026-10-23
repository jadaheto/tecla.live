/**
 * Despedidas y cierres por voz. Se resuelven localmente: TECLA AI responde
 * con una frase breve y el HUD de voz se cierra, sin llamar a DeepSeek.
 */
const FAREWELL_PATTERNS: RegExp[] = [
  // Solo frases cortas y completas: «gracias», «no, gracias», «muchas gracias, TECLA».
  /^\s*(no[,\s]+)?(muchas\s+)?gracias(\s*[,]?\s*(tecla|señor|jarvis))?\s*[.!]?\s*$/i,
  /^\s*(bueno[,\s]+)?(adi[oó]s|chao|chau|hasta\s+(luego|pronto|mañana)|nos\s+vemos|bye)(\s*[,]?\s*(tecla|señor|jarvis))?\s*[.!]?\s*$/i,
  /^\s*(no[,\s]+)?(eso\s+es\s+todo|nada\s+m[aá]s|ya\s+est[aá]|listo|est[aá]\s+bien|as[ií]\s+est[aá]\s+bien|perfecto|ok(ey)?|vale)(\s*[,]?\s*gracias)?\s*[.!]?\s*$/i,
  /^\s*(ci[eé]rra(te|lo)?|cerrar|salir|descansa|silencio|ap[aá]gate)(\s*[,]?\s*(tecla|jarvis))?\s*[.!]?\s*$/i,
  /^\s*(buenas\s+noches|que\s+descanses)(\s*[,]?\s*(tecla|señor|jarvis))?\s*[.!]?\s*$/i,
];

export function isFarewell(text: string): boolean {
  const clean = text.trim();
  if (!clean || clean.length > 80) return false;
  return FAREWELL_PATTERNS.some((pattern) => pattern.test(clean));
}

export function farewellReply(text: string, persona: "jarvis" | "copiloto" | "kitt" | "piloto"): string {
  const clean = text.trim().toLowerCase();
  const thanks = /gracias/.test(clean);
  const night = /buenas\s+noches|descans/.test(clean);
  if (persona === "piloto") {
    if (night) return "Buenas noches, piloto. Cabina en reposo.";
    if (thanks) return "Confirmado, piloto. Quedo a la escucha.";
    return "Recibido. Copiloto en espera.";
  }
  if (persona === "kitt") {
    if (night) return "Buenas noches, señor. Mantendré el escáner en reposo.";
    if (thanks) return "Para eso estoy, señor. Conduzca con cuidado.";
    return "Entendido, señor. Quedo en espera.";
  }
  if (persona === "jarvis") {
    if (night) return "Buenas noches, señor. Quedo disponible.";
    if (thanks) return "A sus órdenes, señor. Quedo disponible.";
    return "Quedo disponible, señor.";
  }
  if (night) return "Buenas noches. Aquí estaré.";
  if (thanks) return "Con gusto. Aquí estaré.";
  return "Listo. Aquí estaré.";
}
