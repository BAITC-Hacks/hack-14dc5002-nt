import { expect, test, type Page } from "@playwright/test";
import requests from "../../src/mocks/requests.json";

const storageKey = "akim-five-hours:base-snapshot:v1";

async function runDemoPlan(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Загрузить демо-план" }).click();
  await page.getByRole("button", { name: "Рассчитать результат" }).click();
  await expect(page.getByRole("region", { name: "Результат плана" }).locator(".score-value")).toHaveText("57");
  await expect(page.getByRole("complementary", { name: "Состояние плана" }).locator(".budget-value")).toHaveText("90 / 100");
}

test("mock cancellation confirms the chosen replacement and keeps the original snapshot on reload", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await runDemoPlan(page);

  const storedBase = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(storedBase).not.toBeNull();
  const events = page.getByRole("region", { name: "Что изменилось?" });
  const cancellation = events.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Строительство школы отменено: участок недоступен", exact: true }),
  });
  await cancellation.getByRole("button", { name: "Смоделировать событие" }).click();

  const draft = events.locator(".draft-strip");
  await expect(draft.getByText("4 мероприятия · без результата", { exact: true })).toBeVisible();
  await expect(draft.getByText("40 единиц", { exact: true })).toBeVisible();
  await expect(draft.locator(".score-value")).toHaveCount(0);
  const confirm = events.getByRole("button", { name: "Подтвердить выбранную замену" });
  await expect(confirm).toBeDisabled();
  await expect(events.locator(".comparison-panel")).toHaveCount(0);

  // The first candidate has the same score but is a different, unsupported mock swap.
  const modular = events.getByRole("button", { name: /^Модульные учебные корпуса/ });
  await expect(modular).toContainText("56,6");
  await expect(modular).toContainText("предварительный результат · 96 ед.");
  await modular.click();
  await expect(modular).toHaveAttribute("aria-pressed", "true");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  const comparison = events.locator(".comparison-panel");
  await expect(comparison.getByText("Исходный снимок сохранён", { exact: true })).toBeVisible();
  const original = comparison.getByRole("article").filter({ has: page.getByText("Исходный", { exact: true }) });
  const replacement = comparison.getByRole("article").filter({ has: page.getByText("После замены", { exact: true }) });
  await expect(original.locator("strong")).toHaveText("57");
  await expect(original.locator("small")).toHaveText("90 из 100 единиц");
  await expect(replacement.locator("strong")).toHaveText("56,6");
  await expect(replacement.locator("small")).toHaveText("96 из 100 единиц");
  await expect(comparison.locator(".score-delta strong")).toHaveText("-0,4");
  await expect(page.getByRole("region", { name: "Результат плана" }).locator(".score-value")).toHaveText("57");

  await comparison.getByRole("button", { name: "Получить объяснение" }).click();
  await expect(comparison.getByText("Шаблонное объяснение", { exact: true })).toBeVisible();
  await expect(comparison.getByText("Отмена школы компенсирована заменой на модульные учебные корпуса.", { exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(storedBase);

  await page.reload();
  await expect(page.getByRole("region", { name: "Результат плана" }).locator(".score-value")).toHaveText("57");
  await expect(page.getByRole("complementary", { name: "Состояние плана" }).locator(".budget-value")).toHaveText("90 / 100");
  await expect(events.locator(".event-source")).toContainText("57 балла");
  await expect(events.locator(".event-source")).toContainText("90 из 100 единиц");
  await expect(events.locator(".comparison-panel")).toHaveCount(0);
  await expect(events.locator(".event-workspace")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("a four-action mock plan has no score and cannot open an event", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Загрузить демо-план" }).click();
  await page.getByRole("button", { name: "Убрать: Строительство школы", exact: true }).click();
  const state = page.getByRole("complementary", { name: "Состояние плана" });
  await expect(state.getByText("4 / 5", { exact: true })).toBeVisible();
  await expect(state.locator(".budget-value")).toHaveText("60 / 100");
  await page.getByRole("button", { name: "Рассчитать результат" }).click();

  const result = page.getByRole("region", { name: "Результат плана" });
  await expect(result.getByRole("status")).toContainText("Некорректный план не получает балл.");
  await expect(result.getByText("Нужно выбрать ровно пять мероприятий.", { exact: true })).toBeVisible();
  await expect(result.locator(".score-value")).toHaveCount(0);
  await expect(result.getByText("Astana Quality of Life Score", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Смоделировать событие" })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test("a stored plan from another model version is not silently recalculated", async ({ page }) => {
  await page.addInitScript(({ key, plan }) => {
    localStorage.setItem(key, JSON.stringify({
      plan: { ...plan, modelVersion: "previous-model-version" },
      modelVersion: "previous-model-version",
      savedAt: "2026-09-23T00:00:00.000Z",
    }));
  }, { key: storageKey, plan: requests.simulateValid });
  await page.goto("/");

  await expect(page.getByRole("status").filter({ hasText: "Сохранённый результат относится к версии previous-model-version" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Результат плана" }).locator(".score-value")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Состояние плана" }).getByText("0 / 5", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Смоделировать событие" })).toHaveCount(0);
});
