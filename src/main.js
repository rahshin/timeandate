import { Capacitor } from "@capacitor/core";
import "./style.css";
import { cities, cityIds, countdown, targetInstant } from "./time.js";

const app = document.querySelector("#app");
const links = [...document.querySelectorAll("nav a")];
const params = () => new URL(location.href).searchParams;
let redraw = () => {};
let timerDraft;
const timerKey = "timeandate.timer";

function saveTimer() {
  try {
    if (timerDraft) localStorage.setItem(timerKey, JSON.stringify(timerDraft));
    else localStorage.removeItem(timerKey);
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
        Capacitor.isNativePlatform()
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

function renderTimer() {
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZones = [
    ...new Set([localZone, "UTC", ...Intl.supportedValuesOf("timeZone")]),
  ].sort();
  app.innerHTML = `
    <section class="intro"><h1>Timer</h1><p>Count down to a date in any timezone.</p></section>
    <form class="timer-form card">
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
  const form = app.querySelector("form");
  const zone = form.querySelector("#timezone");
  const target = form.querySelector("#target");
  const error = form.querySelector("#error");
  const status = app.querySelector("#timer-status");
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
      saveTimer();
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
    saveTimer();
    render();
  };
  redraw = () => {
    const parts = timerDraft && countdown(timerDraft.instant, timerDraft.zone);
    for (const unit of Object.keys(units))
      app.querySelector(`[data-unit="${unit}"]`).textContent =
        parts?.[unit] ?? (timerDraft ? "0" : "—");
    const title =
      parts &&
      Object.entries(parts)
        .filter(([, value]) => value)
        .map(([key, value]) => `${value}${units[key]}`)
        .join(" ");
    document.title = title
      ? `${title} · Time And Date`
      : timerDraft
        ? "Time is up · Time And Date"
        : "Timer · Time And Date";
    const label = timerDraft
      ? parts
        ? ""
        : "Time is up."
      : "Set a target to start.";
    if (status.textContent !== label) status.textContent = label;
  };
}

function render() {
  const isTimer = location.pathname === "/timer";
  document.title = isTimer
    ? "Timer · Time And Date"
    : "World Clocks · Time And Date";
  for (const link of links) {
    if (link.pathname === (isTimer ? "/timer" : "/clocks"))
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (isTimer) renderTimer();
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
window.addEventListener("popstate", render);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) redraw();
});
setInterval(() => redraw(), 1000);
render();
