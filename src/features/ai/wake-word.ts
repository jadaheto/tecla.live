/**
 * Detección de la frase de activación («Oye TECLA») sobre transcripciones del
 * reconocimiento del navegador. Tolera acentos, variantes fonéticas que
 * produce el reconocedor en el Tesla («tekla», «tesla», «te cla», «olle tecla»)
 * y un error de una letra en la frase completa.
 */
const TRIGGERS = ["oye", "hey", "ok", "okey", "hola", "ey", "oh ye", "olle", "oie", "oyes"];
const BASE_NAMES = ["tecla", "tekla", "tesla", "teclas", "te cla", "tecla live", "tecla ai"];
const KITT_NAMES = ["kitt", "kit", "kid", "quit"];

export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Distancia de Levenshtein acotada a 1 (devuelve 2 en cuanto supera 1). */
function distanceAtMostOne(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return 2;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  edits += a.length - i + (b.length - j);
  return edits > 1 ? 2 : edits;
}

export interface WakeWordOptions {
  /** Nombre personalizado del asistente (Ajustes → Nombre del asistente). */
  assistantName?: string | null;
  /** Con el estilo «El auto fantástico» también responde a «KITT». */
  style?: string | null;
}

function nameVariants(options: WakeWordOptions): string[] {
  const names = [...BASE_NAMES];
  if (options.style === "kitt") names.push(...KITT_NAMES);
  // «Discovery»: como en la serie, «computadora» también despierta al asistente.
  if (options.style === "discovery") names.push("computadora", "computador", "ordenador");
  const custom = normalizeSpeech(options.assistantName ?? "");
  if (custom && custom !== "tecla" && custom.length >= 3) names.push(custom);
  return names;
}

export function matchesWakeWord(transcript: string, options: WakeWordOptions = {}): boolean {
  const text = normalizeSpeech(transcript);
  if (!text) return false;
  const names = nameVariants(options);
  const pattern = new RegExp(
    `(^|\\s)(${TRIGGERS.map(escapeRegex).join("|")})\\s*(${names.map(escapeRegex).join("|")})(\\s|$)`,
  );
  if (pattern.test(text)) return true;

  // Tolerancia a una letra: «oyetekla», «olletecla», «hoye tecla»… sobre el texto sin espacios.
  const condensed = text.replace(/\s/g, "");
  if (condensed.length < 6) return false;
  const targets = new Set<string>();
  for (const trigger of ["oye", "hey", "hola", "okey"]) {
    for (const name of names) {
      const target = (trigger + name).replace(/\s/g, "");
      if (target.length >= 7) targets.add(target);
    }
  }
  for (const target of targets) {
    for (const length of [target.length - 1, target.length, target.length + 1]) {
      if (length <= 0) continue;
      for (let start = 0; start + length <= condensed.length; start += 1) {
        if (distanceAtMostOne(condensed.slice(start, start + length), target) <= 1) return true;
      }
    }
  }
  return false;
}
