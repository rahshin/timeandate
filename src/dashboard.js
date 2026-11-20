import "./dashboard.css";
import { clockFormatters, countdown, createDateTimer, fillTimeZones, validDateTimer } from "./time.js";
import {
  durationDisplay,
  durationMilliseconds,
  durationRemaining,
  isDurationTimer,
  toggleDuration,
} from "./duration.js";

const dateCountdown = {
  name: "Countdown Timer",
  description: "Count down to a date and time in a selected timezone.",
  fields: `
    <label class="field">Target date and time <input name="target" type="datetime-local" required></label>
    <label class="field">Timezone <select name="timezone"></select></label>`,
  init: fields => fillTimeZones(fields.timezone),
  create: fields => createDateTimer(fields.target.value, fields.timezone.value),
  valid: validDateTimer,
  describe(timer, now) {
    const milliseconds = Math.max(0, Date.parse(timer.instant) - now);
    let display = durationDisplay(milliseconds);
    if (milliseconds >= 3_600_000) {
      const units = { years: "y", months: "mo", days: "d", hours: "h", minutes: "m" };
      display = Object.entries(countdown(timer.instant, timer.zone) ?? {})
        .filter(([, value]) => value > 0)
        .map(([unit, value]) => `${value}${units[unit]}`)
        .join(" ") || display;
    }
    return {
      display,
      status: milliseconds ? "Running" : "Complete",
      detail: `${timer.wallTime.replace("T", " ")} · ${timer.zone.replaceAll("_", " ")}`,
    };
  },
};

const durationCountdown = {
  name: "Duration Countdown",
  description: "Count down a set number of hours, minutes, and seconds.",
  fields: `
    <div class="duration-fields">
      <label class="field">Hours <input name="hours" type="number" min="0" max="999" step="1" value="0" required></label>
      <label class="field">Minutes <input name="minutes" type="number" min="0" max="59" step="1" value="10" required></label>
      <label class="field">Seconds <input name="seconds" type="number" min="0" max="59" step="1" value="0" required></label>
    </div>`,
  create(fields, now) {
    const initial = durationMilliseconds(fields.hours.valueAsNumber, fields.minutes.valueAsNumber, fields.seconds.valueAsNumber);
    if (!initial) throw new Error("Enter a duration greater than zero.");
    return { initial, remaining: initial, endAt: now + initial };
  },
  valid: isDurationTimer,
  describe(timer, now) {
    const remaining = durationRemaining(timer, now);
    const paused = timer.endAt === null;
    return {
      display: durationDisplay(remaining),
      status: remaining ? (paused ? "Paused" : "Running") : "Complete",
      action: remaining ? (paused ? "Resume" : "Pause") : "",
      detail: `Duration ${durationDisplay(timer.initial)}`,
    };
  },
  toggle: toggleDuration,
};

const worldClock = {
  name: "World Clock",
  description: "Show the current time and date in a timezone.",
  fields: `
    <label class="field">Timezone <select name="timezone" required></select></label>
    <label class="dashboard-checkbox">
      <input type="checkbox" name="showSeconds"> Show seconds
    </label>`,
  init: fields => fillTimeZones(fields.timezone),
  create(fields) {
    const value = { zone: fields.timezone.value, showSeconds: fields.showSeconds.checked };
    if (!this.valid(value)) throw new Error("Choose a valid timezone.");
    return value;
  },
  valid(value) {
    if (!value?.zone || typeof value.zone !== "string" || typeof value.showSeconds !== "boolean") return false;
    try {
      clockFormatters(value.zone);
      return true;
    } catch {
      return false;
    }
  },
};

const prefix = "timeandate.dashboard.";
const stored = new Map();

function readRecord(key, raw) {
  try {
    const record = JSON.parse(raw);
    if (record && typeof record.name === "string" && Number.isFinite(record.created)) {
      stored.set(key, record);
      return;
    }
  } catch {
    // Ignore malformed records.
  }
  stored.delete(key);
}

try {
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) readRecord(key, localStorage.getItem(key));
  }
} catch {
  // Timers still work in memory when storage is unavailable.
}

function saveRecord(key, record) {
  if (record) stored.set(key, record);
  else stored.delete(key);
  try {
    if (record) localStorage.setItem(key, JSON.stringify(record));
    else localStorage.removeItem(key);
  } catch {
    // Keep using the in-memory record.
  }
}

export const dashboardPath = "/dashboard";
const addPath = dashboardPath + "/add";

function renderAddPage(root, type, types, navigate) {
  const definition = Object.hasOwn(types, type) ? types[type] : undefined;
  const heading = definition?.name ?? "Add a timer or clock";
  document.title = `${heading} · Time And Date`;
  root.innerHTML = `
    <header class="intro dashboard-setup-heading">
      <a href="${definition ? addPath : dashboardPath}" data-route>${definition ? "Choose a different type" : "Back to dashboard"}</a>
      <h1 tabindex="-1">${heading}</h1>
      <p>${definition ? definition.description : "Choose what to add to your dashboard."}</p>
    </header>
    ${definition ? `
      <form class="card dashboard-form">
        <label class="field">Name (optional) <input name="timerName" maxlength="80"></label>
        ${definition.fields}
        <p class="dashboard-error" role="alert" hidden></p>
        <div class="dashboard-actions">
          <a href="${dashboardPath}" data-route>Cancel</a>
          <button type="submit">Add</button>
        </div>
      </form>` : `
      <ul class="dashboard-grid dashboard-types">
        ${Object.entries(types).map(([key, timer]) => `
          <li>
            <a class="card" href="${addPath}/${key}" data-route>
              <strong>${timer.name}</strong>
              <span>${timer.description}</span>
            </a>
          </li>`).join("")}
      </ul>`}`;

  root.querySelector("h1").focus();
  if (!definition) return;
  const form = root.querySelector("form");
  const error = form.querySelector(".dashboard-error");
  definition.init?.(form.elements);
  form.oninput = () => { error.hidden = true; };

  form.onsubmit = (event) => {
    event.preventDefault();
    const now = Date.now();
    let value;
    try {
      value = definition.create(form.elements, now);
    } catch (issue) {
      error.textContent = issue.message;
      error.hidden = false;
      return;
    }
    const key = prefix + crypto.randomUUID();
    saveRecord(key, { type, name: form.elements.timerName.value.trim(), value, created: now });
    navigate(dashboardPath, true);
  };
}

export function mountDashboard(root, { path, interval, existingDate, existingDuration, countdownPath, durationPath, intervalPath, navigate }) {
  const types = { date: dateCountdown, duration: durationCountdown };
  if (interval) types.interval = interval;
  types.clock = worldClock;

  if (path !== dashboardPath) {
    renderAddPage(root, path.slice(addPath.length + 1), types, navigate);
    return;
  }

  document.title = "Dashboard · Time And Date";
  root.innerHTML = `
    <header class="intro dashboard-heading">
      <h1 tabindex="-1">Dashboard</h1>
      <a href="${addPath}" class="dashboard-add" aria-label="Add timer or clock" data-route>+</a>
    </header>
    <p class="dashboard-empty">Select + to add a timer or clock.</p>
    <section class="dashboard-grid" aria-label="Saved timers and clocks"></section>`;

  const add = root.querySelector(".dashboard-add");
  const grid = root.querySelector(".dashboard-grid");
  const empty = root.querySelector(".dashboard-empty");
  const cards = new Map();

  function addCard(key, record, path) {
    const definition = types[record.type];
    const isClock = record.type === "clock";
    const formats = isClock ? clockFormatters(record.value.zone, record.value.showSeconds) : undefined;
    const zone = isClock ? record.value.zone.replaceAll("_", " ") : "";
    const card = document.createElement("article");
    card.className = "card dashboard-card";
    card.innerHTML = `
      <h2></h2>
      <p class="dashboard-detail"></p>
      ${isClock
        ? '<time class="dashboard-clock"></time>'
        : '<p class="dashboard-clock" role="timer" aria-label="Time remaining"></p>'}
      <p class="dashboard-status"></p>
      <div class="dashboard-actions"></div>`;
    const title = card.querySelector("h2");
    const detail = card.querySelector(".dashboard-detail");
    const clock = card.querySelector(".dashboard-clock");
    const status = card.querySelector(".dashboard-status");
    const actions = card.querySelector(".dashboard-actions");
    const label = record.name || (isClock ? zone.split("/").at(-1) : definition.name);
    title.textContent = label;
    if (isClock) detail.textContent = zone;
    let toggle;

    if (path) {
      const link = document.createElement("a");
      link.href = path;
      link.dataset.route = "";
      link.textContent = "Manage timer";
      actions.append(link);
    } else {
      if (definition.toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "secondary";
        toggle.onclick = () => {
          const current = stored.get(key);
          if (!current) return;
          saveRecord(key, { ...current, value: definition.toggle(current.value, Date.now()) });
          redraw();
        };
        actions.append(toggle);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${label}`);
      remove.onclick = () => {
        saveRecord(key);
        refresh();
        add.focus();
      };
      actions.append(remove);
    }

    cards.set(key, now => {
      if (formats) {
        const display = formats.time.format(now);
        const date = formats.date.format(now);
        if (clock.textContent !== display) clock.textContent = display;
        clock.dateTime = new Date(now).toISOString();
        if (status.textContent !== date) status.textContent = date;
        return;
      }
      const current = path ? record : stored.get(key);
      if (!current) return;
      const view = definition.describe(current.value, now);
      const description = record.name ? `${definition.name} · ${view.detail}` : view.detail;
      if (detail.textContent !== description) detail.textContent = description;
      if (clock.textContent !== view.display) clock.textContent = view.display;
      if (status.textContent !== view.status) status.textContent = view.status;
      card.dataset.running = String(view.status.startsWith("Running"));
      if (toggle) {
        toggle.hidden = !view.action;
        if (toggle.textContent !== view.action) toggle.textContent = view.action;
      }
    });
    grid.append(card);
  }

  function redraw() {
    const now = Date.now();
    for (const update of cards.values()) update(now);
  }

  function refresh() {
    cards.clear();
    grid.replaceChildren();
    const existing = [
      ["date", existingDate(), countdownPath],
      ["duration", existingDuration(), durationPath],
      ["interval", interval?.existing(), intervalPath],
    ];
    for (const [timerType, value, path] of existing) {
      if (value) addCard(timerType, { type: timerType, value }, path);
    }
    const records = [...stored].sort(([, left], [, right]) => left.created - right.created);
    for (const [key, record] of records) {
      if (Object.hasOwn(types, record.type) && types[record.type].valid(record.value)) addCard(key, record);
    }
    empty.hidden = cards.size > 0;
    redraw();
  }

  function onStorage(event) {
    if (event.key === null || event.key.startsWith("timeandate.")) refresh();
  }

  window.addEventListener("storage", onStorage);
  refresh();
  root.querySelector("h1").focus();
  return { redraw, unmount: () => window.removeEventListener("storage", onStorage) };
}

window.addEventListener("storage", event => {
  if (event.key === null) stored.clear();
  else if (event.key.startsWith(prefix)) readRecord(event.key, event.newValue);
});
