import { Capacitor } from "@capacitor/core";
import "./style.css";
import { cities, cityIds, countdown, targetInstant } from "./time.js";
import {
  durationDisplay,
  durationMilliseconds,
  durationRemaining,
  isDurationTimer,
} from "./duration.js";

const app = document.querySelector("#app");
const links = [...document.querySelectorAll("nav a")];
const isNative = Capacitor.isNativePlatform();
const dateLink = links.find(link => link.pathname === "/timer");
const durationLink = links.find(link => link.pathname === "/duration");
if (isNative) {
  dateLink.textContent = "Date countdown";
  durationLink.hidden = false;
}
const params = () => new URL(location.href).searchParams;
let redraw = () => {};
let timerDraft;
const timerKey = "timeandate.timer";
const durationKey = "timeandate.duration";
let durationTimer;

function saveTimer(key, value) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    // The active timer still works when device storage is unavailable.
  }
}

function changeUrl(url, replace = false) {
  history[replace ? "replaceState" : "pushState"](null, "", url);
  render();
}

document.querySelectorAll("[data-route]").forEach((link) =>
  link.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    const route = link.pathname;
    if (route !== location.pathname)
      changeUrl(route === "/clocks" && lastBoard ? lastBoard : route);
  }),
);

let lastBoard = "";
const dateOptions = {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
};
const timeOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

function setCities(ids) {
  const url = new URL("/clocks", location.origin);
  url.searchParams.set("cities", ids.join(","));
  changeUrl(url, true);
}

function renderClocks() {
  lastBoard = location.pathname + location.search;
  const ids = cityIds(params().get("cities"));
  app.innerHTML = `
    <section class="intro">
      <h1>World Clocks</h1>
      <p>Local time and date, side by side.</p>
    </section>
    <form class="toolbar" aria-label="Manage cities">
      <label for="city">Add a city</label>
      <select id="city" ${ids.length === Object.keys(cities).length ? "disabled" : ""}>${Object.entries(
        cities,
      )
        .filter(([id]) => !ids.includes(id))
        .map(([id, [name]]) => `<option value="${id}">${name}</option>`)
        .join("")}</select>
      <button type="submit" ${ids.length === Object.keys(cities).length ? "disabled" : ""}>Add city</button>
      <button class="secondary" id="share" type="button">Copy link</button>
      <span id="status" role="status"></span>
    </form>
    <section class="clock-grid" aria-label="Selected cities">
      ${
        ids
          .map((id) => {
            const [name, zone] = cities[id];
            return `<article class="card" data-city="${id}">
          <div class="card-heading"><h2>${name}</h2><button class="icon secondary" type="button" data-remove="${id}" aria-label="Remove ${name}">×</button></div>
          <span class="zone">${zone}</span>
          <div class="clock-face" aria-hidden="true"><i class="hour-hand"></i><i class="minute-hand"></i></div>
          <time class="clock-time"></time><p class="date"></p>
          <div class="reorder" aria-label="Reorder ${name}">
            <button class="secondary" type="button" data-move="-1" ${ids[0] === id ? "disabled" : ""} aria-label="Move ${name} earlier">Earlier</button>
            <button class="secondary" type="button" data-move="1" ${ids.at(-1) === id ? "disabled" : ""} aria-label="Move ${name} later">Later</button>
          </div>
        </article>`;
          })
          .join("") || "<p>Add a city to start your board.</p>"
      }
    </section>`;
  const entries = [...app.querySelectorAll("[data-city]")].map((card) => {
    const id = card.dataset.city;
    const timeZone = cities[id][1];
    card.querySelector("[data-remove]").onclick = () =>
      setCities(ids.filter((city) => city !== id));
    card.querySelectorAll("[data-move]").forEach((button) => {
      button.onclick = () => {
        const from = ids.indexOf(id);
        const to = from + Number(button.dataset.move);
        [ids[from], ids[to]] = [ids[to], ids[from]];
        setCities(ids);
        app
          .querySelector(`[data-city="${id}"] [data-move]:not(:disabled)`)
          ?.focus();
      };
    });
    return {
      card,
      time: new Intl.DateTimeFormat("en-GB", { ...timeOptions, timeZone }),
      date: new Intl.DateTimeFormat(undefined, { ...dateOptions, timeZone }),
    };
  });
  app.querySelector("form").onsubmit = (event) => {
    event.preventDefault();
    const id = app.querySelector("#city").value;
    if (id && !ids.includes(id)) setCities([...ids, id]);
  };
  app.querySelector("#share").onclick = async () => {
    const status = app.querySelector("#status");
    try {
      if (
        !["http:", "https:"].includes(location.protocol) ||
        isNative
      ) {
        throw new Error("No public address");
      }
      const url = new URL("/clocks", location.origin);
      url.searchParams.set("cities", ids.join(","));
      await navigator.clipboard.writeText(url.href);
      status.textContent = "Link copied.";
    } catch {
      status.textContent =
        "Copy the address from the public web app to share this board.";
    }
  };
  redraw = () => {
    const now = new Date();
    for (const { card, time, date } of entries) {
      const display = time.format(now);
      const [hour, minute] = display.split(":").map(Number);
      const clock = card.querySelector("time");
      clock.textContent = display;
      clock.dateTime = now.toISOString();
      card.querySelector(".date").textContent = date.format(now);
      card
        .querySelector(".clock-face")
        .style.setProperty("--hour", `${hour * 30 + minute / 2}deg`);
      card
        .querySelector(".clock-face")
        .style.setProperty("--minute", `${minute * 6}deg`);
    }
  };
}

const units = { years: "y", months: "mo", days: "d", hours: "h", minutes: "m" };

function renderDateTimer(panel) {
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZones = [
    ...new Set([localZone, "UTC", ...Intl.supportedValuesOf("timeZone")]),
  ].sort();
  panel.innerHTML = `
    <h2>Date countdown</h2>
    <form class="timer-form card" aria-label="Date countdown">
      <div class="field"><label for="target">Target date and time</label><input id="target" type="datetime-local" step="60" required></div>
      <div class="field"><label for="timezone">Timezone</label><select id="timezone"></select></div>
      <button type="submit">Start countdown</button>
      <button class="secondary" id="clear" type="button">Clear</button>
      <p id="error" role="alert" hidden></p>
    </form>
    <section class="timer-display" aria-label="Time remaining">
      ${Object.keys(units)
        .map(
          (unit) =>
            `<div class="card measure"><strong data-unit="${unit}">—</strong><span>${unit}</span></div>`,
        )
        .join("")}
    </section>
    <p id="timer-status" role="status"></p>`;
  const form = panel.querySelector("form");
  const zone = form.querySelector("#timezone");
  const target = form.querySelector("#target");
  const error = form.querySelector("#error");
  const status = panel.querySelector("#timer-status");
  for (const id of timeZones) zone.add(new Option(id.replaceAll("_", " "), id));
  zone.value = timerDraft?.zone || localZone;
  target.value = timerDraft?.wallTime || "";
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      const instant = targetInstant(target.value, zone.value);
      if (!countdown(instant, zone.value))
        throw new Error("Date already passed");
      timerDraft = { wallTime: target.value, zone: zone.value, instant };
      saveTimer(timerKey, timerDraft);
      error.hidden = true;
      redraw();
    } catch (issue) {
      error.textContent =
        issue.message === "Date already passed"
          ? "Choose a date and time in the future."
          : "This local time is invalid or ambiguous in the selected timezone. Choose a different time.";
      error.hidden = false;
    }
  };
  form.querySelector("#clear").onclick = () => {
    timerDraft = undefined;
    saveTimer(timerKey, timerDraft);
    target.value = "";
    zone.value = localZone;
    error.hidden = true;
    redraw();
  };
  return () => {
    const parts = timerDraft && countdown(timerDraft.instant, timerDraft.zone);
    for (const unit of Object.keys(units))
      panel.querySelector(`[data-unit="${unit}"]`).textContent =
        parts?.[unit] ?? (timerDraft ? "0" : "—");
    const title =
      parts &&
      Object.entries(parts)
        .filter(([, value]) => value)
        .map(([key, value]) => `${value}${units[key]}`)
        .join(" ");
    const label = timerDraft
      ? parts
        ? ""
        : "Time is up."
      : "Set a target to start.";
    if (status.textContent !== label) status.textContent = label;
    return title || (timerDraft ? "Date countdown ended" : "");
  };
}

function renderDurationTimer(panel) {
  panel.innerHTML = `
    <h2>Duration timer</h2>
    <form class="timer-form card" aria-label="Duration timer">
      <div class="duration-fields">
        <div class="field"><label for="duration-hours">Hours</label><input id="duration-hours" name="hours" type="number" min="0" max="999" step="1" value="0" required></div>
        <div class="field"><label for="duration-minutes">Minutes</label><input id="duration-minutes" name="minutes" type="number" min="0" max="59" step="1" value="10" required></div>
        <div class="field"><label for="duration-seconds">Seconds</label><input id="duration-seconds" name="seconds" type="number" min="0" max="59" step="1" value="0" required></div>
      </div>
      <button type="submit">Start timer</button>
      <button type="button" class="secondary" id="duration-toggle" disabled>Pause</button>
      <button type="button" class="secondary" id="duration-reset" disabled>Reset</button>
      <p id="duration-error" role="alert" hidden></p>
    </form>
    <div class="card duration-clock" role="timer" aria-label="Duration remaining"></div>
    <p id="duration-status" role="status"></p>`;
  const form = panel.querySelector("form");
  const fields = ["hours", "minutes", "seconds"].map(name => form.elements.namedItem(name));
  const toggle = panel.querySelector("#duration-toggle");
  const reset = panel.querySelector("#duration-reset");
  const error = panel.querySelector("#duration-error");
  const clock = panel.querySelector(".duration-clock");
  const status = panel.querySelector("#duration-status");

  if (durationTimer) {
    durationDisplay(durationTimer.initial).split(":").forEach((value, index) => {
      fields[index].value = Number(value);
    });
  }

  function setDuration(value) {
    durationTimer = value;
    saveTimer(durationKey, value);
    error.hidden = true;
    redraw();
  }

  form.onsubmit = event => {
    event.preventDefault();
    const remaining = durationMilliseconds(...fields.map(field => field.valueAsNumber));
    if (!remaining) {
      error.textContent = "Enter a duration greater than zero.";
      error.hidden = false;
      return;
    }
    setDuration({ initial: remaining, remaining, endAt: Date.now() + remaining });
  };
  toggle.onclick = () => {
    const now = Date.now();
    const remaining = durationRemaining(durationTimer, now);
    if (!remaining) return redraw();
    setDuration({
      ...durationTimer,
      remaining,
      endAt: durationTimer.endAt === null ? now + remaining : null,
    });
  };
  reset.onclick = () => setDuration(undefined);

  return () => {
    const remaining = durationRemaining(durationTimer);
    const display = durationDisplay(remaining);
    const paused = durationTimer?.endAt === null;
    if (clock.textContent !== display) clock.textContent = display;
    toggle.disabled = remaining === 0;
    toggle.textContent = paused ? "Resume" : "Pause";
    reset.disabled = !durationTimer;
    const label = !durationTimer ? "" : !remaining ? "Timer complete." : paused ? "Timer paused." : "Timer running.";
    if (status.textContent !== label) status.textContent = label;
    return durationTimer ? (remaining ? `${display}${paused ? " paused" : ""}` : "Timer complete") : "";
  };
}

function renderTimers(durationOnly) {
  const showDate = !isNative || !durationOnly;
  const showDuration = !isNative || durationOnly;
  const heading = !isNative ? "Timer" : durationOnly ? "Duration timer" : "Date countdown";
  app.innerHTML = `
    <section class="intro">
      <h1>${heading}</h1>
      ${isNative ? "" : "<p>Count down to a date and time, or set a timer for a duration.</p>"}
    </section>
    <div class="timer-panels${isNative ? " native-timer" : ""}">
      ${showDate ? '<section id="date-panel"></section>' : ""}
      ${showDuration ? '<section id="duration-panel"></section>' : ""}
    </div>`;
  const date = showDate ? renderDateTimer(app.querySelector("#date-panel")) : null;
  const duration = showDuration ? renderDurationTimer(app.querySelector("#duration-panel")) : null;
  redraw = () => {
    const dateTitle = date?.();
    const durationTitle = duration?.();
    const titles = durationRemaining(durationTimer) > 0
      ? [durationTitle, dateTitle]
      : [dateTitle, durationTitle];
    document.title = `${titles.filter(Boolean).join(" / ") || heading} · Time And Date`;
  };
}

function render() {
  const durationOnly = location.pathname === "/duration";
  const isTimer = location.pathname === "/timer" || durationOnly;
  const activePath = isTimer ? (isNative && durationOnly ? "/duration" : "/timer") : "/clocks";
  document.title = isTimer
    ? "Timer · Time And Date"
    : "World Clocks · Time And Date";
  for (const link of links) {
    if (link.pathname === activePath)
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (isTimer) renderTimers(durationOnly);
  else renderClocks();
  redraw();
}

try {
  const saved = JSON.parse(localStorage.getItem(timerKey));
  if (saved && targetInstant(saved.wallTime, saved.zone) === saved.instant)
    timerDraft = saved;
} catch {
  // Ignore stale or unavailable device storage.
}
try {
  const saved = JSON.parse(localStorage.getItem(durationKey));
  if (isDurationTimer(saved)) durationTimer = saved;
} catch {
  // Ignore stale or unavailable device storage.
}
window.addEventListener("popstate", render);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) redraw();
});
setInterval(() => redraw(), 1000);
render();
