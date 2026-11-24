import { expect, test } from "@playwright/test";

test.use({ timezoneId: "America/Los_Angeles", viewport: { width: 390, height: 844 } });

test("standalone countdown searches, dismisses, restores, and resets its timezone", { tag: "@web-only" }, async ({ page }) => {
  await page.goto("/countdown");
  const trigger = page.getByRole("button", { name: /^Timezone / });
  const search = page.getByRole("combobox", { name: "Search city or timezone" });
  const target = page.getByLabel("Target date and time");

  await expect(trigger).toHaveText("Your Timezone · Los Angeles");
  await target.fill("2038-01-01T00:00");
  await trigger.click();
  await expect(search).toBeFocused();
  await expect(page.getByRole("option", { name: "UTC", exact: true })).toBeVisible();
  await search.press("Enter");
  await expect(search).toBeVisible();

  await search.fill("Portland");
  await expect(page.getByRole("option", { name: /Portland · Oregon/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Portland · Maine/ })).toBeVisible();
  await search.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText("Your Timezone · Los Angeles");

  await trigger.click();
  await search.fill("no-such-location");
  await expect(page.getByText("No matching cities or timezones")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toBeFocused();
  await search.press("Tab");
  await expect(search).toBeHidden();
  await expect(page.getByRole("button", { name: "Start countdown" })).toBeFocused();

  await trigger.click();
  await search.fill("Bombay");
  await expect(page.getByRole("option", { name: /^Mumbai · India/ })).toBeVisible();
  await search.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText("Mumbai · India");
  await expect(target).toHaveValue("2038-01-01T00:00");

  await page.getByRole("button", { name: "Start countdown" }).click();
  await page.reload();
  await expect(trigger).toHaveText("Kolkata · Asia");
  await expect(target).toHaveValue("2038-01-01T00:00");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(trigger).toHaveText("Your Timezone · Los Angeles");
  await expect(target).toHaveValue("");
});
