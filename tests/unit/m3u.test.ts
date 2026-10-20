import { describe, expect, it } from "vitest";
import { parseM3u, M3uParseError } from "@/lib/integrations/m3u";

const SAMPLE = `#EXTM3U
#PLAYLIST:Mi lista autorizada
#EXTINF:-1 tvg-id="uno" tvg-logo="https://example.com/uno.png" group-title="Noticias",Canal Uno
https://example.com/uno.m3u8
#EXTINF:-1 group-title="Música",Canal Dos
https://example.com/dos.mp3
#EXTINF:-1 group-title="Música",Canal Dos repetido
https://example.com/dos.mp3
#EXTINF:-1,Inseguro
http://example.com/inseguro.m3u8
#EXTINF:-1,Inválido
file:///etc/passwd
`;

describe("M3U parser", () => {
  it("parses channels, attributes and playlist name", () => {
    const parsed = parseM3u(SAMPLE);
    expect(parsed.name).toBe("Mi lista autorizada");
    expect(parsed.channels).toHaveLength(3);
    expect(parsed.channels[0]).toMatchObject({
      name: "Canal Uno",
      group: "Noticias",
      isHls: true,
      logo: "https://example.com/uno.png",
    });
    expect(parsed.channels[1]?.name).toBe("Canal Dos");
    expect(parsed.channels[2]).toMatchObject({
      name: "Inseguro",
      insecure: true,
    });
  });

  it("deduplicates URLs and skips non-http protocols", () => {
    const parsed = parseM3u(SAMPLE);
    const urls = parsed.channels.map((channel) => channel.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).not.toContain("file:///etc/passwd");
  });

  it("rejects files without the M3U header", () => {
    expect(() => parseM3u("https://example.com/a.m3u8")).toThrow(M3uParseError);
  });

  it("rejects files with no valid channels", () => {
    expect(() => parseM3u("#EXTM3U\n#EXTINF:-1,Canal\nfile:///x")).toThrow(
      /canales válidos/,
    );
  });
});
