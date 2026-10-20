export interface M3uChannel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  isHls: boolean;
  insecure?: boolean;
}

export interface ParsedM3u {
  name: string;
  channels: M3uChannel[];
}

export class M3uParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "M3uParseError";
    this.code = code;
  }
}

export const MAX_M3U_CHANNELS = 5000;
export const MAX_M3U_BYTES = 5 * 1024 * 1024;

function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function lastCommaOutsideQuotes(value: string): number {
  let inQuotes = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const char = value[index];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) return index;
  }
  return -1;
}

function attribute(source: string, name: string): string | undefined {
  const pattern = new RegExp(`${name}="([^"]*)"`, "i");
  const match = pattern.exec(source);
  return match?.[1]?.trim() || undefined;
}

export function parseM3u(content: string): ParsedM3u {
  if (!content || content.trim().length === 0) {
    throw new M3uParseError("EMPTY", "El archivo está vacío.");
  }
  if (content.length > MAX_M3U_BYTES) {
    throw new M3uParseError("TOO_LARGE", "El archivo M3U supera el tamaño máximo permitido.");
  }

  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  if (!lines.some((line) => line.trim().toUpperCase().startsWith("#EXTM3U"))) {
    throw new M3uParseError("INVALID_HEADER", "El contenido no parece una lista M3U válida (falta #EXTM3U).");
  }

  const channels: M3uChannel[] = [];
  const seenUrls = new Set<string>();
  let playlistName = "Mi lista";
  let pending: { name: string; logo?: string; group?: string } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase().startsWith("#PLAYLIST:")) {
      const name = line.slice("#PLAYLIST:".length).trim();
      if (name) playlistName = name.slice(0, 80);
      continue;
    }

    if (line.toUpperCase().startsWith("#EXTINF:")) {
      const commaIndex = lastCommaOutsideQuotes(line);
      const metadata = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const displayName = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "";
      pending = {
        name: (displayName || attribute(metadata, "tvg-name") || "Canal sin nombre").slice(0, 160),
        logo: attribute(metadata, "tvg-logo"),
        group: attribute(metadata, "group-title"),
      };
      continue;
    }

    if (line.startsWith("#")) continue;

    const [urlPart] = line.split("|");
    const url = safeUrl(urlPart ?? "");
    if (!url) {
      pending = null;
      continue;
    }
    if (seenUrls.has(url)) {
      pending = null;
      continue;
    }
    seenUrls.add(url);
    const current = pending ?? { name: `Canal ${channels.length + 1}` };
    const logo = current.logo ? safeUrl(current.logo) : null;
    channels.push({
      id: `iptv_${hash(url)}`,
      name: current.name,
      url,
      logo: logo ?? undefined,
      group: current.group?.slice(0, 80),
      isHls: /\.m3u8(?:\?|$)/i.test(url),
      insecure: url.startsWith("http://"),
    });
    pending = null;

    if (channels.length >= MAX_M3U_CHANNELS) break;
  }

  if (channels.length === 0) {
    throw new M3uParseError("NO_CHANNELS", "No encontramos canales válidos en la lista.");
  }

  return { name: playlistName.slice(0, 80), channels };
}
