import { expect, test } from "@playwright/test";

test.describe("páginas y estados de configuración", () => {
  const pages = [
    { path: "/youtube", heading: "Videos para el camino." },
    { path: "/radio", heading: "Radio para el camino." },
    { path: "/podcasts", heading: "Podcasts para escuchar." },
    { path: "/navigate", heading: "Navega sin rodeos." },
    { path: "/iptv", heading: "Tus canales, en orden." },
    { path: "/twitch", heading: "Twitch sin distracciones." },
    { path: "/music", heading: "Tu banda sonora." },
    { path: "/apps", heading: "Todas tus aplicaciones." },
    { path: "/settings", heading: "Ajustes" },
    { path: "/favorites", heading: "Favoritos y listas." },
  ];

  for (const item of pages) {
    test(`${item.path} responde y muestra su título`, async ({ page }) => {
      const response = await page.goto(item.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(item.heading);
      await expect(page.getByText("Application error")).toHaveCount(0);
    });
  }

  test("YouTube responde sin romper la app, con o sin claves", async ({ page }) => {
    await page.goto("/youtube");
    await expect(page.getByRole("main").getByRole("button", { name: "Buscar", exact: true })).toBeVisible();
    await expect(
      page.getByText(/YouTube aún no está configurado|Tendencias de hoy|No pudimos cargar/),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("Radio lista emisoras reales o un error controlado", async ({ page }) => {
    await page.goto("/radio");
    await expect(
      page.getByText(/Populares ahora|No pudimos cargar las emisoras/),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("Música muestra el estado de Spotify sin simular reproducción", async ({ page }) => {
    await page.goto("/music");
    await expect(
      page.getByText(/Spotify está a un paso\.|Conecta tu cuenta\./),
    ).toBeVisible();
    await expect(
      page.getByText(/SPOTIFY_CLIENT_ID|Inicia sesión para vincular|Vincular Spotify/).first(),
    ).toBeVisible();
  });

  test("Navegación genera enlaces oficiales al buscar", async ({ page }) => {
    await page.goto("/navigate");
    await page.getByRole("textbox", { name: "Destino para Waze" }).fill("Cartagena");
    await page.getByRole("button", { name: "Preparar ruta" }).click();
    await expect(page.getByRole("heading", { name: "Cartagena" })).toBeVisible();
    const wazeLink = page.getByRole("link", { name: /Abrir ruta en Waze/ });
    await expect(wazeLink).toHaveAttribute("href", /waze\.com\/ul\?q=Cartagena/);
    await expect(page.getByText("Avisos de Waze")).toBeVisible();
    await expect(page.getByRole("link", { name: /Abrir mapa en vivo de Waze/ })).toHaveAttribute(
      "href",
      "https://www.waze.com/live-map/",
    );
  });

  test("TECLA Drive inicia la simulación y cambia de escena", async ({ page }) => {
    await page.goto("/drive");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("TECLA");
    await page.getByRole("button", { name: "Demo", exact: true }).click();
    await page.getByRole("button", { name: "Costa" }).click();
    await expect(page.getByRole("button", { name: "Costa" })).toHaveAttribute("aria-pressed", "true");
    await page.locator("button:visible").filter({ hasText: /Iniciar paseo/ }).first().click();
    await expect(page.locator("button:visible").filter({ hasText: /Detener paseo/ }).first()).toBeVisible();
    await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    await page.locator("button:visible").filter({ hasText: /Detener paseo/ }).first().click();
  });

  test("TECLA Drive usa la velocidad del GPS cuando está disponible", async ({ page }) => {
    await page.addInitScript(() => {
      const watchPosition = (success: (position: unknown) => void) => {
        let speed = 8;
        return window.setInterval(() => {
          speed += 1;
          success({
            coords: {
              latitude: 9.3047,
              longitude: -75.3978,
              accuracy: 8,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed,
            },
            timestamp: Date.now(),
          });
        }, 650);
      };
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          watchPosition,
          clearWatch: (id: number) => window.clearInterval(id),
        },
      });
    });
    await page.goto("/drive");
    await page.locator("button:visible").filter({ hasText: /Activar GPS/ }).first().click();
    await expect(page.getByText(/GPS activo/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("GPS REAL").first()).toBeVisible();
    await expect(page.locator("button:visible").filter({ hasText: /Detener paseo/ }).first()).toBeVisible();
    await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    await page.locator("button:visible").filter({ hasText: /Detener paseo/ }).first().click();
  });

  test("biblioteca permite crear una lista local", async ({ page }) => {
    await page.goto("/favorites");
    await page.getByRole("button", { name: "Nueva lista" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Nueva lista" })).toBeVisible();
    await dialog.getByRole("textbox", { name: "Nombre de la lista" }).fill("Lista E2E");
    await dialog.getByRole("button", { name: "Crear lista" }).click();
    await expect(page.getByText("Lista E2E").first()).toBeVisible();
  });
});

test.describe("experiencia móvil", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("la navegación rápida y TECLA AI funcionan en móvil", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator('nav[aria-label="Navegación rápida"]');
    await expect(nav).toBeVisible();
    await nav.getByRole("button", { name: "Abrir TECLA AI" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText("¿Qué quieres disfrutar hoy?"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cerrar TECLA AI" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
