import "./dashboard.css";
import { dashboardCountdown, dashboardSessionInterval } from "./dashboard-sessions.js";
import { Temporal } from "@js-temporal/polyfill";
import { playTone, unlockTone } from "./timeandate/audio.js";
import { clockFormatters, countdown, createDateTimer, fillTimeZones, validDateTimer } from "./time.js";
import { durationDisplay } from "./duration.js";
import {
  cardPrefix as prefix, checkpointSessions, commandSession, dataKey, openDashboardData, originalId,
  presetSession, savePreset, sessionDefinition,
} from "./dashboard-data.js";

const dateCountdown = {
  name: "Date Countdown",
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

let dashboards;
let stored;
let localData;
let activeId;
const repository = openDashboardData((next, previous, commandKey) => {
  dashboards = next.dashboards;
  stored = new Map(Object.entries(next.cards));
  localData = next;
  if (previous) window.dispatchEvent(new CustomEvent("dashboarddata", { detail: { previous, commandKey } }));
});

export const dashboardReady = repository.ready;

function boardId(record) {
  return record.dashboardId ?? originalId;
}

export const dashboardPath = "/dashboard";
const addPath = dashboardPath + "/add";
const historyPath = dashboardPath + "/history";
const editPath = dashboardPath + "/edit/";

function boardUrl(id, path = dashboardPath) {
  return `${path}?board=${encodeURIComponent(id)}`;
}

const penIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20z"/></svg>';
const removeIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

function canEdit(type, status) {
  return !status.startsWith("Running") && !(type === "interval" && status.startsWith("Paused"));
}

function renderSetupPage(root, type, types, navigate, editKey, record, editDefinition) {
  const dashboardId = activeId;
  const home = boardUrl(dashboardId);
  const definition = editDefinition ?? (Object.hasOwn(types, type) ? types[type] : undefined);
  const supportsPresets = definition && definition === sessionDefinition(type);
  const heading = record ? `Edit ${definition.name}` : definition?.name ?? "Add a timer or clock";
  document.title = `${heading} · Time And Date`;
  root.innerHTML = `
    <header class="intro dashboard-setup-heading">
      <a href="${definition && !record ? boardUrl(dashboardId, addPath) : home}" data-route>${definition && !record ? "Choose a different type" : "Back to dashboard"}</a>
      <h1 tabindex="-1">${heading}</h1>
      <p>${definition ? definition.description : "Choose what to add to your dashboard."}</p>
    </header>
    ${definition ? `
      <form class="card dashboard-form">
        ${supportsPresets ? `<label class="field">Preset <select name="preset"></select></label>` : ""}
        <label class="field">Name (optional) <input name="timerName" maxlength="80"></label>
        ${definition.fields}
        <p class="dashboard-error" role="alert" hidden></p>
        <div class="dashboard-actions">
          <a href="${home}" data-route>Cancel</a>
          <button type="submit">${record ? "Save changes" : "Add"}</button>
        </div>
        ${supportsPresets ? `<div class="dashboard-actions">
          <button type="submit" class="secondary" name="savePreset">Save as preset</button>
          <button type="submit" class="secondary" name="updatePreset" hidden>Update preset</button>
          <button type="button" class="secondary" name="deletePreset" hidden>Delete preset</button>
        </div><p class="dashboard-preset-status" role="status"></p>` : ""}
      </form>` : `
      <ul class="dashboard-grid dashboard-types">
        ${Object.entries(types).map(([key, timer]) => `
          <li>
            <a class="card" href="${boardUrl(dashboardId, addPath + "/" + key)}" data-route>
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
  form.addEventListener("invalid", event => {
    const advanced = event.target.closest("details");
    if (advanced) advanced.open = true;
  }, true);

  const fields = form.elements;
  const presetStatus = form.querySelector(".dashboard-preset-status");
  let refreshPresets;
  function renderPresets(selected = "") {
    if (!supportsPresets) return;
    fields.preset.replaceChildren(new Option("Custom settings", ""));
    for (const [id, preset] of Object.entries(localData.presets)) {
      if (preset.type === type) fields.preset.add(new Option(preset.name, id));
    }
    fields.preset.value = selected;
    if (!fields.preset.value) fields.preset.value = "";
    fields.updatePreset.hidden = fields.deletePreset.hidden = !fields.preset.value;
  }

  if (supportsPresets) {
    renderPresets();
    fields.preset.onchange = () => {
      renderPresets(fields.preset.value);
      presetStatus.textContent = "";
      const preset = localData.presets[fields.preset.value];
      if (!preset) return;
      fields.timerName.value = preset.name;
      definition.init(fields, presetSession(preset));
    };
    fields.deletePreset.onclick = async () => {
      const id = fields.preset.value;
      const preset = localData.presets[id];
      if (!preset || !window.confirm(`Delete preset “${preset.name}”?`)) return;
      const removed = await repository.change(data => {
        if (!data.presets[id]) return false;
        delete data.presets[id];
        return true;
      });
      renderPresets();
      presetStatus.textContent = removed ? "Preset deleted." : "Preset was already deleted.";
    };
    refreshPresets = ({ detail: { previous } }) => {
      if (JSON.stringify(previous.presets) !== JSON.stringify(localData.presets)) renderPresets(fields.preset.value);
    };
    window.addEventListener("dashboarddata", refreshPresets);
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const now = Date.now();
    const name = fields.timerName.value.trim();
    let value;
    try {
      value = definition.create(fields, now);
    } catch (issue) {
      error.textContent = issue.message;
      error.hidden = false;
      return;
    }
    const action = event.submitter?.name;
    if (supportsPresets && ["savePreset", "updatePreset"].includes(action)) {
      if (!name) {
        error.textContent = "Enter a name for the preset.";
        error.hidden = false;
        fields.timerName.focus();
        return;
      }
      const editing = action === "updatePreset";
      const id = editing ? fields.preset.value : crypto.randomUUID();
      const saved = await repository.change(data => {
        if (editing && !data.presets[id]) return false;
        savePreset(data, id, type, name, value);
        return true;
      });
      renderPresets(id);
      presetStatus.textContent = saved ? "Preset saved." : "This preset was deleted in another tab.";
      return;
    }
    const key = editKey ?? prefix + crypto.randomUUID();
    const saved = await repository.change(data => {
      if (!data.dashboards.boards.some(board => board.id === dashboardId)) {
        error.textContent = "This dashboard was removed. Go back to choose another dashboard.";
        return false;
      }
      const current = data.cards[key];
      // Compare settings and session state while allowing background checkpoint timestamps to change.
      if (editKey && (!current || JSON.stringify(current.value) !== JSON.stringify(record.value) ||
          current.name !== record.name || !canEdit(type, definition.describe(current.value, Date.now()).status))) {
        error.textContent = "This timer changed. Reopen it to edit its current configuration.";
        return false;
      }
      if (editKey) checkpointSessions(data, Date.now());
      data.cards[key] = { ...current, dashboardId, type, name, value, created: record?.created ?? now };
      return true;
    });
    if (saved && form.isConnected) navigate(home, true);
    else error.hidden = false;
  };
  return { redraw() {}, unmount: () => window.removeEventListener("dashboarddata", refreshPresets) };
}

export function mountDashboard(root, { path, requestedBoard, interval, linkedTimers, navigate }) {
  const viewingHistory = path === historyPath;
  if (requestedBoard !== null && !dashboards.boards.some(board => board.id === requestedBoard)) {
    navigate(viewingHistory ? historyPath : dashboardPath, true);
    return;
  }
  activeId = requestedBoard ?? dashboards.defaultId;
  const types = { date: dateCountdown, duration: dashboardCountdown, interval: dashboardSessionInterval, clock: worldClock };
  function savedDefinition(record) {
    if (record.type === "interval" && interval && !types.interval.valid(record.value) && interval.valid(record.value)) return interval;
    if (Object.hasOwn(types, record.type)) return types[record.type];
  }

  if (path.startsWith(editPath)) {
    const key = prefix + path.slice(editPath.length);
    const record = stored.get(key);
    const definition = record && savedDefinition(record);
    if (definition?.toggle && boardId(record) === activeId && definition.valid(record.value) &&
        canEdit(record.type, definition.describe(record.value, Date.now()).status)) {
      return renderSetupPage(root, record.type, types, navigate, key, record, definition);
    }
    navigate(boardUrl(activeId), true);
    return;
  }

  if (path !== dashboardPath && !viewingHistory) {
    return renderSetupPage(root, path.slice(addPath.length + 1), types, navigate);
  }

  root.innerHTML = `
    <div class="dashboard-switcher">
      <div class="dashboard-tabs" role="group" aria-label="Choose dashboard"></div>
      <button type="button" class="dashboard-new secondary" aria-label="Add dashboard">+</button>
      <a class="dashboard-history-tab" data-route>History</a>
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
      <div class="dashboard-heading-controls" ${viewingHistory ? "hidden" : ""}>
        <button type="button" class="dashboard-icon dashboard-rename secondary" aria-label="Rename dashboard" title="Rename dashboard">${penIcon}</button>
        <a href="${boardUrl(activeId, addPath)}" class="dashboard-add" aria-label="Add timer or clock" data-route>+</a>
      </div>
    </header>
    <section class="dashboard-board-view" ${viewingHistory ? "hidden" : ""}>
    <div class="dashboard-actions dashboard-preferences">
      <button type="button" class="secondary dashboard-default"></button>
      <label class="dashboard-checkbox"><input type="checkbox" class="dashboard-sound"> Timer sound</label>
    </div>
    <p class="dashboard-announcement" role="status"></p>
    <p class="dashboard-empty">Use the + beside the dashboard name to add a timer or clock.</p>
    <section class="dashboard-grid" aria-label="Saved timers and clocks"></section>
    </section>
    <section class="dashboard-history" aria-label="Timer history" ${viewingHistory ? "" : "hidden"}>
      <label class="field dashboard-history-filter">Filter by timer name <input type="search"></label>
      <p class="dashboard-history-empty">No ended timer sessions yet.</p>
      <ul class="dashboard-history-list"></ul>
    </section>`;

  const add = root.querySelector(".dashboard-add");
  const grid = root.querySelector(".dashboard-grid");
  const empty = root.querySelector(".dashboard-empty");
  const cards = new Map();
  const tabs = root.querySelector(".dashboard-tabs");
  const historyTab = root.querySelector(".dashboard-history-tab");
  const filter = root.querySelector(".dashboard-history-filter input");
  if (viewingHistory) {
    historyTab.setAttribute("aria-current", "page");
    filter.oninput = renderHistory;
  }
  const heading = root.querySelector("h1");
  const defaultButton = root.querySelector(".dashboard-default");
  const sound = root.querySelector(".dashboard-sound");
  const announcement = root.querySelector(".dashboard-announcement");
  const create = root.querySelector(".dashboard-create");
  const createForm = create.querySelector("form");
  const nameInput = createForm.elements.name;
  let wasVisible = false;

  let renamingId;
  function openDashboardDialog(board) {
    renamingId = board?.id;
    nameInput.value = board?.name ?? "";
    create.querySelector("h2").textContent = board ? "Rename dashboard" : "Add dashboard";
    createForm.querySelector('[type="submit"]').textContent = board ? "Save name" : "Add dashboard";
    nameInput.setCustomValidity("");
    create.showModal();
  }

  root.querySelector(".dashboard-new").onclick = () => openDashboardDialog();
  root.querySelector(".dashboard-rename").onclick = () => {
    openDashboardDialog(dashboards.boards.find(board => board.id === activeId));
  };
  root.querySelector(".dashboard-cancel").onclick = () => create.close();
  nameInput.oninput = () => nameInput.setCustomValidity("");
  createForm.onsubmit = async event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.setCustomValidity("Enter a dashboard name.");
      nameInput.reportValidity();
      return;
    }
    const rename = renamingId !== undefined;
    const id = renamingId ?? crypto.randomUUID();
    const saved = await repository.change(({ dashboards }) => {
      if (rename) {
        const board = dashboards.boards.find(board => board.id === id);
        if (!board) return false;
        board.name = name;
      } else dashboards.boards.push({ id, name });
      return true;
    });
    if (!create.isConnected) return;
    create.close();
    if (saved && !rename) navigate(boardUrl(id));
  };

  defaultButton.onclick = () => {
    const id = activeId;
    void repository.change(({ dashboards }) => {
      if (dashboards.defaultId === id || !dashboards.boards.some(board => board.id === id)) return false;
      dashboards.defaultId = id;
      return true;
    });
  };
  sound.onchange = () => {
    const id = activeId;
    const enabled = sound.checked;
    if (enabled) unlockTone();
    void repository.change(({ dashboards }) => {
      const board = dashboards.boards.find(board => board.id === id);
      if (!board) return false;
      board.sound = enabled;
      return true;
    });
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
    heading.textContent = viewingHistory ? "Timer history" : active.name;
    document.title = `${heading.textContent} · Time And Date`;
    historyTab.href = boardUrl(activeId, historyPath);
    add.href = boardUrl(activeId, addPath);
    updatePreferences();
    tabs.replaceChildren();
    for (const board of dashboards.boards) {
      const tab = document.createElement("div");
      tab.className = "dashboard-tab";
      const select = document.createElement("a");
      select.href = boardUrl(board.id);
      select.dataset.route = "";
      select.textContent = board.name;
      if (!viewingHistory && board.id === activeId) select.setAttribute("aria-current", "page");
      if (board.sound) select.onclick = unlockTone;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary dashboard-tab-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove dashboard ${board.name}`);
      remove.disabled = dashboards.boards.length === 1;
      remove.onclick = async () => {
        if (!window.confirm(`Remove “${board.name}” and its saved timers and clocks?`)) return;
        const wasActive = activeId === board.id;
        let replacement;
        const removed = await repository.change(data => {
          const boards = data.dashboards.boards;
          const index = boards.findIndex(item => item.id === board.id);
          if (index < 0 || boards.length === 1) return false;
          checkpointSessions(data, Date.now());
          boards.splice(index, 1);
          replacement = boards[Math.min(index, boards.length - 1)].id;
          if (data.dashboards.defaultId === board.id) data.dashboards.defaultId = replacement;
          for (const [key, record] of Object.entries(data.cards)) {
            if (boardId(record) === board.id) delete data.cards[key];
          }
          return true;
        });
        if (removed && root.contains(heading)) {
          if (wasActive) navigate(boardUrl(replacement, viewingHistory ? historyPath : dashboardPath), true);
          else refreshDashboard(true);
        }
      };
      tab.append(select, remove);
      tabs.append(tab);
    }
    const selected = viewingHistory ? historyTab : tabs.querySelector('[aria-current="page"]');
    selected.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (focusTab) selected.focus({ preventScroll: true });
    refresh();
  }

  function addCard(key, record, path, definition = savedDefinition(record)) {
    const isClock = record.type === "clock";
    const formats = isClock ? clockFormatters(record.value.zone, record.value.showSeconds) : undefined;
    const zone = isClock ? record.value.zone.replaceAll("_", " ") : "";
    const card = document.createElement("article");
    card.className = "card dashboard-card";
    card.innerHTML = `
      <div class="dashboard-card-heading">
        <h2></h2>
        <div class="dashboard-card-controls">
        ${isClock ? "" : `<button type="button" class="secondary dashboard-icon dashboard-mute">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M11 4 5 9H2v6h3l6 5z"/>
            <path class="dashboard-speaker-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>
            <path class="dashboard-speaker-cross" d="m16 9 6 6m0-6-6 6"/>
          </svg>
        </button>`}
        ${!path && definition.toggle ? `<a class="dashboard-icon dashboard-edit" data-route>${penIcon}</a>` : ""}
        ${!path ? `<button type="button" class="secondary dashboard-icon dashboard-remove">${removeIcon}</button>` : ""}
        </div>
      </div>
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
    const mute = card.querySelector(".dashboard-mute");
    const linkedMute = () => dashboards.mutedLinkedTimers?.[key] === true;
    if (mute) {
      mute.setAttribute("aria-label", `Mute alerts for ${label}`);
      mute.onclick = () => {
        const id = activeId;
        void repository.change(data => {
          if (path) {
            const muted = data.dashboards.mutedLinkedTimers ??= {};
            muted[key] = muted[key] !== true;
          } else {
            const current = data.cards[key];
            if (!current || boardId(current) !== id) return false;
            current.muted = current.muted !== true;
          }
          return true;
        });
      };
    }
    let toggle;
    let reset;
    let edit;
    const commandButtons = [];

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
          const expected = stored.get(key);
          if (!expected) return;
          const id = activeId;
          const action = button.dataset.action;
          void repository.change(data => {
            const current = data.cards[key];
            if (!current || boardId(current) !== id) return false;
            const now = Date.now();
            if (definition === sessionDefinition(current.type)) {
              return commandSession(data, key, action, expected.value, now);
            }
            current.value = update.call(definition, current.value, now);
            return true;
          }, key);
        };
        actions.append(button);
        return button;
      }

      if (definition.toggle) {
        toggle = timerButton("Play", definition.toggle);
        if (definition.reset) reset = timerButton("Reset", definition.reset);
        for (const [action, label] of Object.entries(definition.commands ?? {})) {
          const button = timerButton(label, (value, now) => definition.command(value, action, now));
          button.dataset.action = action;
          commandButtons.push([action, button]);
        }
        edit = card.querySelector(".dashboard-edit");
        edit.href = boardUrl(activeId, editPath + key.slice(prefix.length));
        edit.setAttribute("aria-label", `Edit ${label}`);
        edit.title = `Edit ${label}`;
      }
      const remove = card.querySelector(".dashboard-remove");
      remove.setAttribute("aria-label", `Remove ${label}`);
      remove.title = `Remove ${label}`;
      remove.onclick = async () => {
        if (!window.confirm(`Remove “${label}”?`)) return;
        await repository.change(data => {
          if (!data.cards[key]) return false;
          checkpointSessions(data, Date.now());
          delete data.cards[key];
          return true;
        });
        add.focus();
      };
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
      const muted = path ? linkedMute() : current.muted === true;
      const pressed = String(muted);
      if (mute.getAttribute("aria-pressed") !== pressed) {
        mute.setAttribute("aria-pressed", pressed);
        mute.title = muted ? "Unmute timer alerts" : "Mute timer alerts";
      }
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
        if (view.primaryAction) toggle.dataset.action = view.primaryAction;
        if (toggle.textContent !== view.action) toggle.textContent = view.action;
        edit.hidden = !canEdit(record.type, view.status);
        if (reset) reset.disabled = view.status.startsWith("Ready");
        const focused = document.activeElement;
        for (const [action, button] of commandButtons) button.hidden = !view.available.includes(action);
        if (!path && (focused === edit || focused?.parentElement === actions) && focused.hidden) toggle.focus();
      }
      if (announce && changed && !muted) return `${label}. ${view.status}.`;
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
    if (viewingHistory) return;
    wasVisible = false;
    announcement.textContent = "";
    cards.clear();
    grid.replaceChildren();
    // Standalone timers have their own routes and storage, independent of dashboard cards.
    const linkedBoard = dashboards.boards.find(board => board.id === originalId) ?? dashboards.boards[0];
    const existing = activeId === linkedBoard.id ? linkedTimers?.() ?? [] : [];
    for (const [timerType, value, path] of existing) {
      if (value) addCard(timerType, { type: timerType, value }, path, timerType === "interval" ? interval : types[timerType]);
    }
    const records = [...stored].sort(([, left], [, right]) => left.created - right.created);
    for (const [key, record] of records) {
      if (boardId(record) !== activeId) continue;
      const definition = savedDefinition(record);
      if (definition?.valid(record.value)) addCard(key, record, undefined, definition);
    }
    empty.hidden = cards.size > 0;
    redraw();
  }

  function renderHistory() {
    if (!viewingHistory) return;
    const list = root.querySelector(".dashboard-history-list");
    const emptyHistory = root.querySelector(".dashboard-history-empty");
    const query = filter.value.trim().toLocaleLowerCase();
    list.replaceChildren();
    for (const entry of localData.history) {
      const timerName = entry.name || sessionDefinition(entry.type).name;
      if (!timerName.toLocaleLowerCase().includes(query)) continue;
      const item = document.createElement("li");
      const date = new Date(entry.endedAt);
      const time = document.createElement("time");
      time.dateTime = date.toISOString();
      time.textContent = date.toLocaleString();
      const title = document.createElement("strong");
      title.textContent = timerName;
      const boardName = dashboards.boards.find(board => board.id === entry.dashboardId)?.name ?? entry.dashboardName;
      const context = document.createElement("span");
      context.className = "dashboard-history-board";
      context.textContent = boardName ?? "";
      const summary = document.createElement("span");
      const outcome = entry.status === "stopped" ? "Stopped early" : "Complete";
      const parts = [outcome];
      if (entry.type === "interval") {
        const { completed, skipped, interrupted, unattempted } = entry.statistics;
        parts.push(`${completed} of ${entry.config.repetitions} completed`);
        if (skipped) parts.push(`${skipped} skipped`);
        if (interrupted) parts.push(`${interrupted} interrupted`);
        if (unattempted) parts.push(`${unattempted} unattempted`);
      }
      summary.textContent = parts.filter(Boolean).join(" · ");
      item.append(time, title);
      if (boardName) item.append(context);
      item.append(summary);
      list.append(item);
    }
    emptyHistory.hidden = list.childElementCount > 0;
    emptyHistory.textContent = query ? "No sessions match this timer name." : "No ended timer sessions yet.";
  }

  function onData(event) {
    const { previous, commandKey } = event.detail;
    const dashboardsChanged = JSON.stringify(previous.dashboards) !== JSON.stringify(dashboards);
    if (dashboardsChanged) {
      if (requestedBoard !== null && !dashboards.boards.some(board => board.id === requestedBoard)) {
        navigate(viewingHistory ? historyPath : dashboardPath, true);
        return;
      }
      refreshDashboard();
    } else {
      const keys = Object.keys(localData.cards);
      const structuralChange = keys.length !== Object.keys(previous.cards).length || keys.some(key => {
        const card = localData.cards[key];
        const old = previous.cards[key];
        return !old || card.name !== old.name || card.type !== old.type || card.dashboardId !== old.dashboardId ||
          (card.type === "clock" && JSON.stringify(card.value) !== JSON.stringify(old.value));
      });
      if (structuralChange) refresh();
      else redraw(commandKey);
    }
    if (viewingHistory && (dashboardsChanged || JSON.stringify(previous.history) !== JSON.stringify(localData.history))) renderHistory();
  }

  function onStorage(event) {
    if (event.key?.startsWith("timeandate.") && event.key !== dataKey) refresh();
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
  window.addEventListener("dashboarddata", onData);
  document.addEventListener("visibilitychange", resetAnnouncements, true);
  refreshDashboard();
  renderHistory();
  heading.focus({ preventScroll: true });
  return {
    redraw,
    unmount() {
      root.removeEventListener("pointerup", enableSound);
      root.removeEventListener("keydown", enableSound);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dashboarddata", onData);
      document.removeEventListener("visibilitychange", resetAnnouncements, true);
    },
  };
}
