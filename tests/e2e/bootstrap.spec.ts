import { expect, test } from "@playwright/test";
import catalog from "../../src/data/catalog.json";

test("dashboard loads the mock catalog, runs the demo plan and fits the viewport", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Аким на 5 часов");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Как изменится город от ваших решений?");
  await expect(page.getByText("Демо-сценарии")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("body")).toHaveCSS("margin-top", "0px");
  await expect(page.getByRole("heading", { name: "Мероприятия" })).toBeVisible();

  await page.getByRole("button", { name: "Загрузить демо-план" }).click();
  await expect(page.getByRole("complementary", { name: "Состояние плана" }).getByText("5 / 5")).toBeVisible();
  await page.getByRole("button", { name: "Рассчитать результат" }).click();
  await expect(page.getByText("Astana Quality of Life Score")).toBeVisible();

  const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fitsViewport).toBe(true);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("bootstrap.png"), fullPage: true });
});

test("catalog endpoint returns the shared envelope and data without an API key", async ({ request }) => {
  const response = await request.get("/api/catalog");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toEqual({ ok: true, data: catalog });
});
