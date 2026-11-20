import "./dashboard.css";
import { Temporal } from "@js-temporal/polyfill";
import { playTone, unlockTone } from "./timeandate/audio.js";
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
  init(fields, value) {
    fillTimeZones(fields.timezone);
    if (value) {
      fields.target.value = value.wallTime;
      fields.timezone.value = value.zone;
    }
  },
  create(fields, now) {
    return { ...createDateTimer(fields.target.value, fields.timezone.value), holdAt: now, ready: true };
  },
  toggle(timer, now) {
    const { holdAt, ready, ...target } = timer;
    if (holdAt !== undefined) return target;
    return Date.parse(timer.instant) > now ? { ...target, holdAt: now } : timer;
  },
  valid: validDateTimer,
  describe(timer, now) {
    const time = timer.holdAt ?? now;
    const milliseconds = Math.max(0, Date.parse(timer.instant) - time);
    const held = timer.holdAt !== undefined;
    let display = durationDisplay(milliseconds);
    if (milliseconds >= 3_600_000) {
      const units = { years: "y", months: "mo", days: "d", hours: "h", minutes: "m" };
      display = Object.entries(countdown(timer.instant, timer.zone, Temporal.Instant.fromEpochMilliseconds(time)) ?? {})
        .filter(([, value]) => value > 0)
        .map(([unit, value]) => `${value}${units[unit]}`)
        .join(" ") || display;
    }
    return {
      display,
      status: held ? (timer.ready ? "Ready" : "Paused") : milliseconds ? "Running" : "Complete",
      action: held ? (timer.ready ? "Play" : "Resume") : milliseconds ? "Pause" : "",
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
  init(fields, value) {
    if (!value) return;
    const [hours, minutes, seconds] = durationDisplay(value.initial).split(":").map(Number);
    fields.hours.value = hours;
    fields.minutes.value = minutes;
    fields.seconds.value = seconds;
  },
  create(fields) {
    const initial = durationMilliseconds(fields.hours.valueAsNumber, fields.minutes.valueAsNumber, fields.seconds.valueAsNumber);
    if (!initial) throw new Error("Enter a duration greater than zero.");
    return { initial, remaining: initial, endAt: null, ready: true };
  },
  valid: isDurationTimer,
  describe(timer, now) {
    const remaining = durationRemaining(timer, now);
    const paused = timer.endAt === null;
    return {
      display: durationDisplay(remaining),
      status: remaining ? (paused ? (timer.ready ? "Ready" : "Paused") : "Running") : "Complete",
      action: paused && !timer.ready ? "Resume" : remaining && !paused ? "Pause" : "Play",
      detail: `Duration ${durationDisplay(timer.initial)}`,
    };
  },
  toggle(timer, now) {
    if (!durationRemaining(timer, now)) return toggleDuration(this.reset(timer, now), now);
    return { ...toggleDuration(timer, now), ready: false };
  },
  reset(timer, now) {
    const running = timer.endAt !== null && durationRemaining(timer, now) > 0;
    return { initial: timer.initial, remaining: timer.initial,
      endAt: running ? now + timer.initial : null, ready: !running };
  },
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
const dashboardsKey = "timeandate.dashboards";
const originalId = "original";
const initialDashboards = { boards: [{ id: originalId, name: "Dashboard" }], defaultId: originalId };

function readDashboards(raw) {
  try {
    const saved = JSON.parse(raw);
    if (Array.isArray(saved?.boards) && saved.boards.length &&
        saved.boards.every(board => typeof board?.id === "string" && typeof board.name === "string") &&
        new Set(saved.boards.map(board => board.id)).size === saved.boards.length &&
        saved.boards.some(board => board.id === saved.defaultId)) return saved;
  } catch {
    // Fall back to the original dashboard when storage is unavailable.
  }
  return initialDashboards;
}

let dashboards = initialDashboards;
try {
  dashboards = readDashboards(localStorage.getItem(dashboardsKey));
} catch {
  // Dashboard selection still works with storage disabled.
}
let activeId = dashboards.defaultId;

export function selectDefaultDashboard() {
  activeId = dashboards.defaultId;
}

function saveDashboards(next) {
  dashboards = next;
  try {
    localStorage.setItem(dashboardsKey, JSON.stringify(next));
  } catch {
    // Keep using the in-memory dashboards.
  }
}

function boardId(record) {
  return record.dashboardId ?? originalId;
}

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
const editPath = dashboardPath + "/edit/";

function canEdit(definition, value, now) {
  return Boolean(definition.toggle) && !definition.describe(value, now).status.startsWith("Running");
}

function renderSetupPage(root, type, types, navigate, editKey, record) {
  const dashboardId = activeId;
  const definition = Object.hasOwn(types, type) ? types[type] : undefined;
  const heading = record ? `Edit ${definition.name}` : definition?.name ?? "Add a timer or clock";
  document.title = `${heading} · Time And Date`;
  root.innerHTML = `
    <header class="intro dashboard-setup-heading">
      <a href="${definition && !record ? addPath : dashboardPath}" data-route>${definition && !record ? "Choose a different type" : "Back to dashboard"}</a>
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
          <button type="submit">${record ? "Save changes" : "Add"}</button>
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
  definition.init?.(form.elements, record?.value);
  if (record) form.elements.timerName.value = record.name;
  form.oninput = () => { error.hidden = true; };

  form.onsubmit = (event) => {
    event.preventDefault();
    if (!dashboards.boards.some(board => board.id === dashboardId)) {
      error.textContent = "This dashboard was removed. Go back to choose another dashboard.";
      error.hidden = false;
      return;
    }
    const now = Date.now();
    const current = editKey && stored.get(editKey);
    if (editKey && (!current || current !== record || !canEdit(definition, current.value, now))) {
      error.textContent = "This timer changed. Reopen it to edit its current configuration.";
      error.hidden = false;
      return;
    }
    let value;
    try {
      value = definition.create(form.elements, now);
    } catch (issue) {
      error.textContent = issue.message;
      error.hidden = false;
      return;
    }
    const key = editKey ?? prefix + crypto.randomUUID();
    saveRecord(key, { dashboardId, type, name: form.elements.timerName.value.trim(), value, created: record?.created ?? now });
    navigate(dashboardPath, true);
  };
}

export function mountDashboard(root, { path, interval, existingDate, existingDuration, countdownPath, durationPath, intervalPath, navigate }) {
  const types = { date: dateCountdown, duration: durationCountdown };
  if (interval) types.interval = interval;
  types.clock = worldClock;

  if (path.startsWith(editPath)) {
    const key = prefix + path.slice(editPath.length);
    const record = stored.get(key);
    const definition = record && Object.hasOwn(types, record.type) && types[record.type];
    if (definition && boardId(record) === activeId && definition.valid(record.value) &&
        canEdit(definition, record.value, Date.now())) {
      renderSetupPage(root, record.type, types, navigate, key, record);
      return;
    }
    navigate(dashboardPath, true);
    return;
  }

  if (path !== dashboardPath) {
    renderSetupPage(root, path.slice(addPath.length + 1), types, navigate);
    return;
  }

  document.title = "Dashboard · Time And Date";
  root.innerHTML = `
    <div class="dashboard-switcher">
      <div class="dashboard-tabs" role="group" aria-label="Choose dashboard"></div>
      <button type="button" class="dashboard-new secondary" aria-label="Add dashboard">+</button>
    </div>
    <dialog class="dashboard-create" aria-labelledby="dashboard-create-title">
      <form class="dashboard-form">
        <h2 id="dashboard-create-title">Add dashboard</h2>
        <label class="field">Dashboard name <input name="name" maxlength="80" required autofocus></label>
        <div class="dashboard-actions">
          <button type="button" class="secondary dashboard-cancel">Cancel</button>
          <button type="submit">Add dashboard</button>
        </div>
      </form>
    </dialog>
    <header class="intro dashboard-heading">
      <h1 tabindex="-1"></h1>
      <a href="${addPath}" class="dashboard-add" aria-label="Add timer or clock" data-route>+</a>
    </header>
    <div class="dashboard-actions dashboard-preferences">
      <button type="button" class="secondary dashboard-default"></button>
      <label class="dashboard-checkbox"><input type="checkbox" class="dashboard-sound"> Timer sound</label>
    </div>
    <p class="dashboard-announcement" role="status"></p>
    <p class="dashboard-empty">Use the + beside the dashboard name to add a timer or clock.</p>
    <section class="dashboard-grid" aria-label="Saved timers and clocks"></section>`;

  const add = root.querySelector(".dashboard-add");
  const grid = root.querySelector(".dashboard-grid");
  const empty = root.querySelector(".dashboard-empty");
  const cards = new Map();
  const tabs = root.querySelector(".dashboard-tabs");
  const heading = root.querySelector("h1");
  const defaultButton = root.querySelector(".dashboard-default");
  const sound = root.querySelector(".dashboard-sound");
  const announcement = root.querySelector(".dashboard-announcement");
  const create = root.querySelector(".dashboard-create");
  const createForm = create.querySelector("form");
  const nameInput = createForm.elements.name;
  let wasVisible = false;

  root.querySelector(".dashboard-new").onclick = () => {
    createForm.reset();
    nameInput.setCustomValidity("");
    create.showModal();
  };
  root.querySelector(".dashboard-cancel").onclick = () => create.close();
  nameInput.oninput = () => nameInput.setCustomValidity("");
  createForm.onsubmit = event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.setCustomValidity("Enter a dashboard name.");
      nameInput.reportValidity();
      return;
    }
    activeId = crypto.randomUUID();
    saveDashboards({ ...dashboards, boards: [...dashboards.boards, { id: activeId, name }] });
    create.close();
    refreshDashboard(true);
  };

  defaultButton.onclick = () => {
    if (dashboards.defaultId === activeId) return;
    saveDashboards({ ...dashboards, defaultId: activeId });
    updatePreferences();
  };
  sound.onchange = () => {
    if (sound.checked) unlockTone();
    const boards = dashboards.boards.map(board => board.id === activeId ? { ...board, sound: sound.checked } : board);
    saveDashboards({ ...dashboards, boards });
  };

  function updatePreferences() {
    const isDefault = dashboards.defaultId === activeId;
    defaultButton.textContent = isDefault ? "Default dashboard" : "Set as default";
    defaultButton.setAttribute("aria-disabled", String(isDefault));
    sound.checked = dashboards.boards.find(board => board.id === activeId).sound === true;
  }

  function refreshDashboard(focusTab = false) {
    if (!dashboards.boards.some(board => board.id === activeId)) activeId = dashboards.defaultId;
    const active = dashboards.boards.find(board => board.id === activeId);
    heading.textContent = active.name;
    updatePreferences();
    tabs.replaceChildren();
    for (const board of dashboards.boards) {
      const tab = document.createElement("div");
      tab.className = "dashboard-tab";
      const select = document.createElement("button");
      select.type = "button";
      select.className = "secondary";
      select.textContent = board.name;
      select.setAttribute("aria-pressed", String(board.id === activeId));
      select.onclick = () => {
        if (board.id === activeId) return;
        activeId = board.id;
        if (board.sound) unlockTone();
        refreshDashboard(true);
      };
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary dashboard-tab-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove dashboard ${board.name}`);
      remove.disabled = dashboards.boards.length === 1;
      remove.onclick = () => {
        if (!window.confirm(`Remove “${board.name}” and its saved timers and clocks?`)) return;
        const index = dashboards.boards.findIndex(item => item.id === board.id);
        const boards = dashboards.boards.filter(item => item.id !== board.id);
        const replacement = boards[Math.min(index, boards.length - 1)].id;
        saveDashboards({ boards, defaultId: dashboards.defaultId === board.id ? replacement : dashboards.defaultId });
        for (const [key, record] of stored) {
          if (boardId(record) === board.id) saveRecord(key);
        }
        if (activeId === board.id) activeId = replacement;
        refreshDashboard(true);
      };
      tab.append(select, remove);
      tabs.append(tab);
    }
    const selected = tabs.querySelector('[aria-pressed="true"]');
    selected.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (focusTab) selected.focus({ preventScroll: true });
    refresh();
  }

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
    let reset;
    let edit;

    if (path) {
      const link = document.createElement("a");
      link.href = path;
      link.dataset.route = "";
      link.textContent = "Manage timer";
      actions.append(link);
    } else {
      function timerButton(text, update) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = text;
        button.onclick = () => {
          const current = stored.get(key);
          if (!current || boardId(current) !== activeId) return;
          saveRecord(key, { ...current, value: update.call(definition, current.value, Date.now()) });
          redraw(key);
        };
        actions.append(button);
        return button;
      }

      if (definition.toggle) {
        toggle = timerButton("Play", definition.toggle);
        if (definition.reset) reset = timerButton("Reset", definition.reset);
        edit = document.createElement("a");
        edit.href = editPath + key.slice(prefix.length);
        edit.dataset.route = "";
        edit.textContent = "Edit";
        edit.setAttribute("aria-label", `Edit ${label}`);
        actions.append(edit);
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

    let previousStatus;
    cards.set(key, (now, announce) => {
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
      const changed = previousStatus?.startsWith("Running") && previousStatus !== view.status &&
        (view.status.startsWith("Complete") || view.status.startsWith("Running"));
      previousStatus = view.status;
      const description = record.name ? `${definition.name} · ${view.detail}` : view.detail;
      if (detail.textContent !== description) detail.textContent = description;
      if (clock.textContent !== view.display) clock.textContent = view.display;
      if (status.textContent !== view.status) status.textContent = view.status;
      const running = view.status.startsWith("Running");
      card.dataset.running = String(running);
      if (toggle) {
        toggle.hidden = !view.action;
        if (toggle.textContent !== view.action) toggle.textContent = view.action;
        edit.hidden = running;
        if (reset) reset.disabled = view.status.startsWith("Ready");
      }
      if (announce && changed) return `${label}. ${view.status}.`;
    });
    grid.append(card);
  }

  function redraw(commandKey) {
    const now = Date.now();
    const visible = !document.hidden;
    const messages = [];
    for (const [key, update] of cards) {
      const message = update(now, visible && wasVisible && key !== commandKey);
      if (message) messages.push(message);
    }
    wasVisible = visible;
    if (messages.length) {
      announcement.textContent = messages.join(" ");
      if (sound.checked) playTone();
    }
  }

  function refresh() {
    wasVisible = false;
    announcement.textContent = "";
    cards.clear();
    grid.replaceChildren();
    // Standalone timers have their own routes and storage, independent of dashboard cards.
    const linkedBoard = dashboards.boards.find(board => board.id === originalId) ?? dashboards.boards[0];
    const existing = activeId === linkedBoard.id ? [
      ["date", existingDate(), countdownPath],
      ["duration", existingDuration(), durationPath],
      ["interval", interval?.existing(), intervalPath],
    ] : [];
    for (const [timerType, value, path] of existing) {
      if (value) addCard(timerType, { type: timerType, value }, path);
    }
    const records = [...stored].sort(([, left], [, right]) => left.created - right.created);
    for (const [key, record] of records) {
      if (boardId(record) === activeId && Object.hasOwn(types, record.type) &&
          types[record.type].valid(record.value)) addCard(key, record);
    }
    empty.hidden = cards.size > 0;
    redraw();
  }

  function onStorage(event) {
    if (event.key === null || event.key === dashboardsKey) refreshDashboard();
    else if (event.key.startsWith("timeandate.")) refresh();
  }

  function enableSound() {
    if (sound.checked) unlockTone();
  }

  function resetAnnouncements() {
    wasVisible = false;
    announcement.textContent = "";
  }

  root.addEventListener("pointerup", enableSound);
  root.addEventListener("keydown", enableSound);
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", resetAnnouncements, true);
  refreshDashboard();
  heading.focus({ preventScroll: true });
  return {
    redraw,
    unmount() {
      root.removeEventListener("pointerup", enableSound);
      root.removeEventListener("keydown", enableSound);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", resetAnnouncements, true);
    },
  };
}

window.addEventListener("storage", event => {
  if (event.key === null || event.key === dashboardsKey) {
    dashboards = readDashboards(event.newValue);
    if (!dashboards.boards.some(board => board.id === activeId)) activeId = dashboards.defaultId;
  }
  if (event.key === null) stored.clear();
  else if (event.key.startsWith(prefix)) readRecord(event.key, event.newValue);
});
