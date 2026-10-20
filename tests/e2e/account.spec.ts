import { expect, test } from "@playwright/test";

test.describe("cuenta y sincronización PostgreSQL", () => {
  test("registro, sincronización, cierre y nuevo inicio de sesión", async ({ page }) => {
    const email = `e2e.${Date.now()}@tecla.local`;
    const password = "TeclaE2E2026";

    await page.goto("/settings#cuenta");
    await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.getByLabel("Nombre (opcional)").fill("Cuenta E2E");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();

    await expect(page.getByText("Cuenta activa")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole("button", { name: "Sincronizar ahora" }).click();
    await expect(page.getByText("Biblioteca sincronizada")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();

    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Cuenta activa")).toBeVisible({ timeout: 20_000 });
  });
});
