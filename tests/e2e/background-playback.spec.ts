import { expect, test } from "@playwright/test";

/** WAV PCM de silencio (8 kHz, mono, 16 bits) para sustituir la emisora real. */
function silentWav(seconds: number): Buffer {
  const sampleRate = 8_000;
  const dataSize = sampleRate * seconds * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, Buffer.alloc(dataSize)]);
}

test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

test.describe("reproducción de fondo", () => {
  test("la radio sigue sonando al cambiar de pantalla y se pausa al elegir YouTube", async ({ page }) => {
    // Las emisoras vienen del directorio real; el audio se sustituye por un WAV local
    // para no depender de que el stream externo responda.
    const response = await page.request.get("/api/radio/stations?limit=30&country=CO");
    const payload = (await response.json()) as { data?: { stations: { url: string }[] }; stations?: { url: string }[] };
    const stations = payload.data?.stations ?? payload.stations ?? [];
    expect(stations.length).toBeGreaterThan(0);
    const urls = new Set(stations.map((station) => station.url));
    const wav = silentWav(40);
    await page.route((url) => urls.has(url.href), (route) =>
      route.fulfill({ status: 200, contentType: "audio/wav", body: wav, headers: { "access-control-allow-origin": "*" } }),
    );

    await page.goto("/radio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Sintonizar" }).first().click();
    await expect(page.getByRole("button", { name: "Pausar emisora" })).toBeVisible();

    // Navegación interna a Inicio: la barra flotante aparece y la emisora sigue sonando.
    await page.getByRole("link", { name: "Inicio", exact: true }).first().click();
    await expect(page).toHaveURL(/\/$/);
    const mini = page.locator('aside[aria-label="Minirreproductor"]');
    await expect(mini).toBeVisible();
    await expect(mini).toContainText("Radio en vivo · Sonando");

    // En Drive la barra se oculta pero el audio no se detiene; al volver sigue sonando.
    await page.getByRole("link", { name: "Drive", exact: true }).first().click();
    await expect(page).toHaveURL(/\/drive/);
    await expect(mini).toBeHidden();
    await page.getByRole("link", { name: "Inicio", exact: true }).first().click();
    await expect(mini).toContainText("Radio en vivo · Sonando");

    // Controles de la barra.
    await mini.getByRole("button", { name: "Pausar" }).click();
    await expect(mini).toContainText("En pausa");
    await mini.getByRole("button", { name: "Reproducir" }).click();
    await expect(mini).toContainText("Sonando");

    // Elegir un video (navegación interna) reemplaza la fuente: la radio queda pausada.
    await page.getByRole("link", { name: "Videos", exact: true }).first().click();
    await expect(page).toHaveURL(/\/youtube/);
    await page.locator('a[href^="/watch/"]').first().click();
    await expect(page).toHaveURL(/\/watch\//);
    await expect(mini).toBeHidden();
    await page.getByRole("link", { name: "Radio", exact: true }).first().click();
    await expect(page).toHaveURL(/\/radio/);
    await expect(page.getByRole("button", { name: "Reproducir emisora" })).toBeVisible();
  });
});
