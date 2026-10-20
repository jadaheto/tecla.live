import { expect, test } from "@playwright/test";

test.describe("dashboard y shell", () => {
  test("muestra la identidad, hero y accesos rápidos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "TECLA LIVE, ir al inicio" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Buenas");
    await expect(page.getByRole("button", { name: "Abrir YouTube" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir TECLA AI" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Continuar viendo" })).toBeVisible();
    await expect(page.getByText(/TECLA LIVE · Entretenimiento inteligente/)).toBeVisible();
  });

  test("el tema cambia y persiste tras recargar", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);
    await page.getByRole("button", { name: /Cambiar tema/ }).click();
    await expect(html).not.toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("la búsqueda universal se abre con el atajo y encuentra apps", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole("textbox", { name: "Búsqueda universal" });
    await input.fill("spotify");
    await expect(dialog.getByRole("button", { name: /Spotify/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("el acceso rápido de YouTube navega al hub", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir YouTube" }).click();
    await expect(page).toHaveURL(/\/youtube/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Videos");
  });

  test("TECLA AI abre y muestra el estado de configuración", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "Abrir TECLA AI" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("¿Qué quieres disfrutar hoy?")).toBeVisible();
    await expect(dialog.getByText("DeepSeek todavía no está configurado")).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar TECLA AI" }).click();
    await expect(dialog).toBeHidden();
  });

  test("los atajos de teclado muestran la ayuda", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("?");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Atajos de TECLA LIVE" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
