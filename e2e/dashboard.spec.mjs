import { expect, test } from "@playwright/test";

function tile(page, name) {
  return page.locator(".dashboard-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

async function openEditor(page, type) {
  await page.getByRole("link", { name: "Add Timer" }).click();
  await page.getByRole("main").getByRole("link", { name: new RegExp(`^${type}\\b`) }).click();
}

async function pickTimezone(page, option, query) {
  await page.getByRole("button", { name: /^Timezone / }).click();
  if (query) await page.getByRole("combobox", { name: "Search city or timezone" }).fill(query);
  await page.getByRole("option", { name: option }).click();
}

async function addClock(page, name) {
  await openEditor(page, "World Clock");
  await page.getByLabel("Name (optional)").fill(name);
  await pickTimezone(page, "UTC");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(tile(page, name)).toBeVisible();
}

test("a fresh dashboard starts with editable examples that stay removed", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-07-01T12:00:00Z"));
  await page.goto("/dashboard");
  const names = ["Local Time", "25-Minute Focus", "Quick Intervals"];
  await expect(page.locator(".dashboard-card h2")).toHaveText(names);
  await expect(tile(page, "Local Time").locator("time")).toBeVisible();
  await expect(tile(page, "25-Minute Focus").getByRole("timer")).toHaveText("00:25:00");
  await expect(tile(page, "Quick Intervals").getByRole("timer")).toHaveText("00:00:30");

  for (const name of names) {
    page.once("dialog", dialog => dialog.accept());
    await tile(page, name).getByRole("button", { name: `Remove ${name}` }).click();
    await expect(tile(page, name)).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.locator(".dashboard-card")).toHaveCount(0);
});

test("dashboard options open from a compact gear and return keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/dashboard");
  const gear = page.getByRole("button", { name: "Dashboard options" });
  await expect(gear).toHaveCSS("width", "44px");
  await expect(gear).toHaveCSS("height", "44px");
  await expect(page.locator(".dashboard-switcher")).toBeHidden();
  await gear.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Dashboard options" });
  await expect(dialog.getByRole("button", { name: "Open this dashboard first" })).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(gear).toBeFocused();
  await gear.click();
  await dialog.getByRole("button", { name: "Add dashboard" }).click();
  const editor = page.getByRole("dialog", { name: "Add dashboard" });
  await editor.getByLabel("Dashboard name").fill("Work");
  await editor.getByRole("button", { name: "Add dashboard" }).click();
  await expect(page.locator(".dashboard-switcher").getByRole("button", { name: "Dashboard options" })).toBeVisible();
  await expect(page.getByText("Switch dashboard", { exact: true })).toBeVisible();
  await gear.click();
  await dialog.getByRole("button", { name: "Open this dashboard first" }).click();
  await expect(dialog.getByRole("button", { name: "Opens first" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
});

test.describe("holiday countdowns", () => {
  test.use({ locale: "en-US", timezoneId: "America/Los_Angeles" });

  test("first-run seasonal countdown persists its removal and shares presets with the editor", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-12-26T12:00:00Z"));
    await page.goto("/dashboard");
    const newYear = tile(page, "New Year’s Eve");
    await expect(page.locator(".dashboard-card")).toHaveCount(4);
    await expect(newYear).toContainText("2027-01-01 00:00");
    page.once("dialog", dialog => dialog.accept());
    await newYear.getByRole("button", { name: "Remove New Year’s Eve" }).click();
    await expect(newYear).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".dashboard-card")).toHaveCount(3);

    await openEditor(page, "Date Countdown");
    await page.getByText("Date presets", { exact: true }).click();
    await page.getByRole("combobox", { name: "Country", exact: true }).selectOption("IN");
    await page.getByRole("combobox", { name: "Preset", exact: true }).selectOption("holi");
    await expect(page.getByLabel("Target date and time")).toHaveValue("2027-03-23T00:00");
    const timezone = page.getByRole("button", { name: /^Timezone / });
    await expect(timezone).toHaveText("Device timezone · Los Angeles");
    await pickTimezone(page, /^Mumbai · India/, "Mumbai");
    await expect(page.getByLabel("Target date and time")).toHaveValue("2027-03-23T00:00");
    await expect(page.getByRole("combobox", { name: "Preset", exact: true })).toHaveValue("holi");
    await expect(timezone).toHaveText("Mumbai · India");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const holiday = tile(page, "Holi (central government calendar)");
    await expect(holiday).toContainText("Asia/Kolkata");
    await holiday.getByRole("link", { name: /Edit/ }).click();
    await expect(page.getByRole("button", { name: /^Timezone / })).toHaveText("Kolkata · Asia");
  });
});

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

test("countdown and interval tiles cycle saved sound modes before and during a run", async ({ page }) => {
  await page.goto("/dashboard");
  for (const type of ["Countdown Timer", "Interval Timer"]) {
    await openEditor(page, type);
    const mode = page.getByRole("combobox", { name: "Sound mode" });
    const cueWindow = page.locator('input[name="finalSeconds"]');
    await expect(mode).toHaveValue("off");
    await expect(cueWindow).toBeHidden();
    await mode.selectOption("tick");
    await expect(cueWindow).toHaveValue("5");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    const timer = tile(page, type);
    const sound = timer.getByRole("button", { name: new RegExp(`^Sound for ${type}`) });
    await expect(sound).toHaveAttribute("data-sound-mode", "tick");
    await sound.hover();
    await expect.poll(() => sound.evaluate(button => getComputedStyle(button, "::after").visibility)).toBe("visible");
    await expect(sound).toHaveAttribute("data-tooltip", /Ticks\. Click for Voice\./);
    await sound.click();
    await expect(sound).toHaveAttribute("data-sound-mode", "speech");
    await expect(sound).toHaveAttribute("data-tooltip", /Voice\. Click for Off\./);
    await timer.getByRole("button", { name: "Start", exact: true }).click();
    await expect(timer.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await sound.click();
    await expect(sound).toHaveAttribute("data-sound-mode", "off");
    await sound.click();
    await expect(sound).toHaveAttribute("data-sound-mode", "tick");
    await timer.getByRole("button", { name: "Stop", exact: true }).click();
    const edit = timer.getByRole("link", { name: `Edit ${type}` });
    await edit.hover();
    await expect.poll(() => edit.evaluate(link => getComputedStyle(link, "::after").visibility)).toBe("visible");
    await expect(edit).toHaveAttribute("data-tooltip", `Edit ${type}`);
    await edit.click();
    await expect(mode).toHaveValue("tick");
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
  }
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
  await pickTimezone(page, "UTC");
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
  const target = page.getByLabel("Target date and time");
  const initialTarget = await target.inputValue();
  await pickTimezone(page, "UTC");
  await expect(target).toHaveValue(initialTarget);
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

test("dashboard mute stops timer cues and preserves the tile sound mode", async ({ page }) => {
  await page.addInitScript(() => {
    window.tones = 0;
    window.AudioContext = class {
      state = "running";
      createOscillator() {
        return {
          frequency: {}, connect() {}, addEventListener() {}, stop() {},
          start() { window.tones++; },
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
        };
      }
    };
  });
  const start = Date.parse("2027-07-01T12:00:00Z");
  await page.clock.setFixedTime(start);
  await page.goto("/dashboard");
  const timer = tile(page, "25-Minute Focus");
  const mode = timer.getByRole("button", { name: /^Sound for 25-Minute Focus/ });
  await mode.click();
  await expect(mode).toHaveAttribute("data-sound-mode", "tick");
  await timer.getByRole("button", { name: "Start", exact: true }).click();
  await expect(timer.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.clock.setFixedTime(start + 25 * 60_000 - 3000);
  const mute = page.getByRole("button", { name: "Mute Dashboard", exact: true });
  await expect(mute).toHaveAttribute("data-audible", "true");
  await mute.click();
  const unmute = page.getByRole("button", { name: "Unmute Dashboard", exact: true });
  await expect(unmute).toHaveAttribute("data-muted", "true");
  await expect(unmute).toHaveAttribute("data-audible", "false");
  const tones = await page.evaluate(() => window.tones);
  expect(tones).toBeGreaterThan(0);
  await page.clock.setFixedTime(start + 25 * 60_000 + 1000);
  await expect(timer.locator(".dashboard-status")).toHaveText("Complete");
  expect(await page.evaluate(() => window.tones)).toBe(tones);
  await page.reload();
  await expect(unmute).toBeVisible();
  await expect(mode).toHaveAttribute("data-sound-mode", "tick");
});

test("long date countdowns fit on one line and grow when the tile gets wider", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.clock.setFixedTime(new Date("2027-01-01T12:00:00Z"));
  await page.goto("/dashboard");
  await openEditor(page, "Date Countdown");
  await pickTimezone(page, "UTC");
  await page.getByLabel("Target date and time").fill("9876-11-29T21:59");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const timer = tile(page, "Date Countdown").getByRole("timer");
  await expect(timer).toHaveText("7849y 10mo 28d 9h 59m");
  const dimensions = () => timer.evaluate(element => ({
    fits: element.firstElementChild.getBoundingClientRect().width <= element.clientWidth + 1,
    fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
  }));
  await timer.evaluate(element => { element.closest(".dashboard-card").style.width = "150px"; });
  await expect.poll(async () => (await dimensions()).fits).toBe(true);
  await expect.poll(() => timer.evaluate(element => element.style.fontSize)).not.toBe("");
  const narrow = (await dimensions()).fontSize;
  await page.setViewportSize({ width: 740, height: 720 });
  await timer.evaluate(element => { element.closest(".dashboard-card").style.removeProperty("width"); });
  await expect.poll(async () => (await dimensions()).fontSize).toBeGreaterThan(narrow);
  await expect.poll(async () => (await dimensions()).fits).toBe(true);
});

test("date presets include timed events in the selected timezone", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-23T12:00:00Z"));
  await page.goto("/dashboard");
  await openEditor(page, "Date Countdown");
  await page.getByText("Date presets", { exact: true }).click();
  await page.getByRole("combobox", { name: "Country", exact: true }).selectOption("US");
  await pickTimezone(page, /^New York · America/, "America/New_York");
  const presets = page.getByRole("combobox", { name: "Preset", exact: true });
  await expect(presets.getByRole("option", { name: /^Christmas/ })).toHaveCount(1);
  await presets.selectOption("us-general-election");
  await expect(page.getByLabel("Target date and time")).toHaveValue("2028-11-07T20:00");
  await expect(page.getByRole("button", { name: /^Timezone / })).toHaveText("New York · America");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(tile(page, "U.S. General Election Day")).toContainText("2028-11-07 20:00 · America/New York");
});
