import { expect, test } from "@playwright/test";

test.describe("media y reproductores", () => {
  test("el reproductor de YouTube funciona sin metadatos y el mini reproductor aparece al salir", async ({ page }) => {
    await page.goto("/watch/dQw4w9WgXcQ", { waitUntil: "domcontentloaded" });
    // El SDK de YouTube reemplaza el nodo interno del reproductor. Esperamos
    // a que ese montaje ocurra para detectar regresiones de reconciliación DOM.
    await page
      .locator('iframe[src*="youtube.com/embed"]')
      .waitFor({ state: "attached", timeout: 6000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /Video de YouTube|Never Gonna Give You Up/,
    );
    await page.getByRole("link", { name: "Volver a YouTube" }).click();
    await expect(page).toHaveURL(/\/youtube/);
    const mini = page.locator('aside[aria-label="Minirreproductor"]');
    await expect(mini).toBeVisible();
    await mini.getByRole("button", { name: "Cerrar minirreproductor" }).click();
    await expect(mini).toBeHidden();
  });

  test("la IPTV importa una lista M3U autorizada y muestra el canal", async ({ page }) => {
    await page.goto("/iptv");
    const m3u = `#EXTM3U
#PLAYLIST:Prueba E2E
#EXTINF:-1 group-title="Noticias",Canal de prueba E2E
https://example.invalid/canal-de-prueba.m3u8
`;
    await page.getByRole("textbox", { name: "Contenido M3U" }).fill(m3u);
    await page.getByRole("button", { name: "Importar lista" }).click();
    await expect(page.getByText("Canal de prueba E2E").first()).toBeVisible();
    await expect(page.getByText("Prueba E2E").first()).toBeVisible();
  });

  test("el modo cine oculta la cabecera y permite salir", async ({ page }) => {
    await page.goto("/settings#pantalla");
    await page.getByRole("button", { name: "Cine" }).click();
    await expect(page.locator("header")).toBeHidden();
    const exit = page.getByRole("button", { name: "Salir de modo cine" });
    await expect(exit).toBeVisible();
    await exit.click();
    await expect(page.locator("header")).toBeVisible();
  });
});
