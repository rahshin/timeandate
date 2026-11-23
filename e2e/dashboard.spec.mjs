import { expect, test } from "@playwright/test";

function tile(page, name) {
  return page.locator(".dashboard-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

async function openEditor(page, type) {
  await page.getByRole("link", { name: "Add timer or clock" }).click();
  await page.getByRole("main").getByRole("link", { name: new RegExp(`^${type}\\b`) }).click();
}

async function addClock(page, name) {
  await openEditor(page, "World Clock");
  await page.getByLabel("Name (optional)").fill(name);
  await page.getByLabel("Timezone").selectOption("UTC");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(tile(page, name)).toBeVisible();
}

test("cleared duration fields submit with zero and repeated submits create one tile", async ({ page }) => {
  await page.goto("/dashboard");
  await openEditor(page, "Countdown Timer");
  await page.getByLabel("Seconds", { exact: true }).fill("");
  await page.locator(".dashboard-form").evaluate(form => {
    const add = form.querySelector('button[type="submit"]:not([name])');
    form.requestSubmit(add);
    form.requestSubmit(add);
  });

  const timer = tile(page, "Countdown Timer");
  await expect(timer).toHaveCount(1);
  await expect(timer.getByRole("timer")).toHaveText("00:10:00");
  await page.reload();
  await expect(timer).toHaveCount(1);
  await timer.getByRole("button", { name: "Start", exact: true }).click();
  await expect(timer.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await timer.getByRole("button", { name: "Remove Countdown Timer" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(timer).toBeVisible();
});

test("countdown border traces elapsed time and follows timer states", async ({ page }) => {
  const start = Date.parse("2027-01-01T12:00:00Z");
  const at = seconds => page.clock.setFixedTime(start + seconds * 1000);
  await at(0);
  await page.goto("/dashboard");
  await openEditor(page, "Countdown Timer");
  await page.getByLabel("Minutes", { exact: true }).fill("0");
  await page.getByLabel("Seconds", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const timer = tile(page, "Countdown Timer");
  const trace = timer.locator(".dashboard-countdown-border path").last();
  const status = timer.locator(".dashboard-status");
  await expect(trace).toHaveAttribute("d", /^M /);
  await expect(trace).toHaveAttribute("stroke-dasharray", "0 1");
  await timer.getByRole("button", { name: "Start", exact: true }).click();
  await expect(status).toHaveText("Running");
  await at(25);
  await expect(trace).toHaveAttribute("stroke-dasharray", "0.5 1");
  await expect(trace).toHaveCSS("stroke", "rgb(56, 189, 248)");
  await timer.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(status).toHaveText("Paused");
  await at(35);
  await expect(trace).toHaveAttribute("stroke-dasharray", "0.5 1");
  await expect(trace).toHaveCSS("stroke", "rgb(148, 163, 184)");
  await timer.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(status).toHaveText("Running");
  await at(50);
  await expect(status).toHaveText("Running · Ending soon");
  await expect(trace).toHaveCSS("stroke", "rgb(251, 191, 36)");
  await at(55);
  await expect(status).toHaveText("Running · Final seconds");
  await expect(trace).toHaveCSS("stroke", "rgb(251, 113, 133)");
  await at(60);
  await expect(status).toHaveText("Complete");
  await expect(trace).toHaveAttribute("stroke-dasharray", "1 1");
  await expect(trace).toHaveCSS("stroke", "rgb(52, 211, 153)");
  await timer.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(trace).toHaveAttribute("stroke-dasharray", "0 1");
});

test("countdown sound choices are saved while runtime changes apply only to the current run", async ({ page }) => {
  await page.goto("/dashboard");
  await openEditor(page, "Countdown Timer");
  await page.getByLabel("Name (optional)").fill("Sound preview");
  const finalSeconds = page.getByRole("combobox", { name: "Final seconds", exact: true });
  const cueWindow = page.locator('input[name="finalSeconds"]');
  const completion = page.getByRole("combobox", { name: "When time’s up" });
  await expect(finalSeconds).toHaveValue("off");
  await expect(cueWindow).toBeHidden();
  await expect(completion).toHaveValue("chime");
  await finalSeconds.selectOption("tick");
  await expect(cueWindow).toHaveValue("5");
  await cueWindow.fill("7");
  await completion.selectOption("speech");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const timer = tile(page, "Sound preview");
  const start = timer.getByRole("button", { name: "Start", exact: true });
  const sound = timer.getByRole("button", { name: /^Sound for Sound preview/ });
  const menu = timer.locator(".dashboard-sound-menu");
  await start.click();
  await sound.click();
  await expect(menu.getByRole("radio", { name: "Ticks" })).toBeChecked();
  await menu.getByRole("radio", { name: "Off" }).check();
  await menu.getByRole("checkbox", { name: "Mute all sounds" }).check();
  await expect(sound).toHaveAccessibleName("Sound for Sound preview, muted");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await timer.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(sound).toHaveAccessibleName("Sound for Sound preview");
  await sound.click();
  await expect(menu.getByRole("radio", { name: "Ticks" })).toBeChecked();
  await expect(menu.getByRole("checkbox", { name: "Mute all sounds" })).not.toBeChecked();
  await page.keyboard.press("Escape");
  await timer.getByRole("button", { name: "Stop", exact: true }).click();
  await timer.getByRole("link", { name: "Edit Sound preview" }).click();
  await expect(finalSeconds).toHaveValue("tick");
  await expect(cueWindow).toHaveValue("7");
  await expect(completion).toHaveValue("speech");
});

test("world clock seconds persist and focus survives a dashboard update from another tab", async ({ page, context }) => {
  await page.goto("/dashboard");
  await addClock(page, "UTC Clock");
  const clock = tile(page, "UTC Clock");
  const seconds = clock.getByRole("checkbox", { name: "Seconds" });
  await seconds.check();
  await expect(clock.locator("time")).toHaveText(/^\d\d:\d\d:\d\d$/);
  await page.reload();
  await expect(seconds).toBeChecked();

  const otherTab = await context.newPage();
  await otherTab.goto("/dashboard");
  await seconds.focus();
  await addClock(otherTab, "Second Clock");
  await expect(tile(page, "Second Clock")).toBeVisible();
  await expect(seconds).toBeFocused();
  await seconds.uncheck();
  await expect(clock.locator("time")).toHaveText(/^\d\d:\d\d$/);
});

test("date countdown makes seconds automatic as the deadline approaches", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-01-01T12:00:00Z"));
  await page.goto("/dashboard");
  await openEditor(page, "Date Countdown");
  await page.getByLabel("Timezone").selectOption("UTC");
  await page.getByLabel("Target date and time").fill("2027-01-01T14:00");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const countdown = tile(page, "Date Countdown");
  const seconds = countdown.getByRole("checkbox", { name: /show seconds/i });
  await expect(seconds).toBeVisible();
  await countdown.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.setFixedTime(new Date("2027-01-01T13:59:24Z"));
  await expect(countdown.getByRole("timer")).toHaveText("36s");
  await expect(seconds).toBeHidden();
});

test("Now follows the selected timezone and saves as a future target", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-01-01T12:00:45Z"));
  await page.goto("/dashboard");
  await openEditor(page, "Date Countdown");
  await page.getByLabel("Timezone").selectOption("UTC");
  const target = page.getByLabel("Target date and time");
  await expect(target).toHaveValue("2027-01-01T12:01");
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await expect(target).toHaveValue("2027-01-01T12:00");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(tile(page, "Date Countdown").getByRole("timer")).toHaveText("15s");
});

test("an interval completes its repetitions and records the run in History", async ({ page }) => {
  await page.clock.install({ time: new Date("2027-01-01T12:00:00Z") });
  await page.goto("/dashboard");
  await openEditor(page, "Interval Timer");
  await page.getByLabel("Name (optional)").fill("Practice");
  const repetition = page.getByRole("group", { name: "Repetition duration" });
  await repetition.getByLabel("Seconds").fill("2");
  await page.getByLabel("Repetitions", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const interval = tile(page, "Practice");
  await interval.getByRole("button", { name: "Start", exact: true }).click();
  await expect(interval.getByText(/Running.*Repetition 1 of 2/)).toBeVisible();
  await page.clock.fastForward(3_000);
  await expect(interval.getByText(/Running.*Rest after repetition 1 of 2/)).toBeVisible();
  await page.clock.fastForward(4_000);
  await expect(interval.getByText("Complete", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "History", exact: true }).click();
  const run = page.getByRole("listitem").filter({ hasText: "Practice" });
  await expect(run).toHaveCount(1);
  await expect(run).toContainText("2 of 2 completed");
});
