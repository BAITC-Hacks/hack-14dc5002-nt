import { expect, test } from "@playwright/test";
import catalog from "../../src/data/catalog.json";

test("bootstrap page loads, identifies mocks and fits the viewport", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Аким на 5 часов");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Симулятор городских решений");
  await expect(page.getByRole("status")).toHaveText("Демо: mock-ответы");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("body")).toHaveCSS("margin-top", "0px");
  await expect(page.getByRole("status")).toHaveCSS("background-color", "rgb(255, 245, 216)");

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
