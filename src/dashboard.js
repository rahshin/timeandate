import "./dashboard.css";
import {
  dashboardCountdown, dashboardSessionInterval, timerSoundChoices, timerSoundMode,
} from "./dashboard-sessions.js";
import { playTick, playTone, unlockTone } from "./timeandate/audio.js";
import {
  clockFormatters, createDateTimer, dateCountdownDisplay, dateCountdownShortcut, dateCountdownUsesAutomaticSeconds,
  fillTimeZones, validDateTimer,
} from "./time.js";
import { createForegroundCues, createWakeController } from "./foreground-cues.js";
import { hasForegroundCues } from "./foreground-cue-policy.js";
import { foregroundPlatform } from "./foreground-platform.js";
import { upcomingHolidays } from "./dashboard-holidays.js";
import { advanceSession } from "./timer-session.js";
import {
  cardPrefix as prefix, checkpointSessions, commandSession, dataKey, offBoardRuns, openDashboardData, originalId,
  presetSession, savePreset, sessionDefinition, unfinishedCards,
} from "./dashboard-data.js";

const dateCountdown = {
  name: "Date Countdown",
  description: "Count down to a date and time in a selected timezone.",
  fields: `
    <details>
      <summary>Holiday presets</summary>
      <label class="field">Country <select name="holidayCountry">
        <option value="US">United States</option>
        <option value="IN">India</option>
      </select></label>
      <label class="field">Holiday <select name="holidayPreset"></select></label>
    </details>
    <label class="field">Target date and time <input name="target" type="datetime-local" required></label>
    <div class="dashboard-actions">
      <button type="button" class="secondary" name="targetNow">Now</button>
      <button type="button" class="secondary" name="targetToday">Today</button>
    </div>
    <label class="field">Timezone <select name="timezone"></select></label>`,
  init(fields, value) {
    fillTimeZones(fields.timezone);
    if (value) {
      fields.target.value = value.wallTime;
      fields.timezone.value = value.zone;
    } else {
      fields.target.value = dateCountdownShortcut("today", "", fields.timezone.value);
      fields.target.dataset.autoFilled = "";
    }
    const setTarget = shortcut => {
      fields.target.value = dateCountdownShortcut(shortcut, fields.target.value, fields.timezone.value);
      fields.target.dispatchEvent(new Event("input", { bubbles: true }));
      if (shortcut === "now") fields.target.dataset.autoFilled = "";
    };
    fields.target.addEventListener("input", () => { delete fields.target.dataset.autoFilled; });
    fields.timezone.addEventListener("change", () => {
      if (fields.target.hasAttribute("data-auto-filled")) {
        fields.target.value = dateCountdownShortcut("today", "", fields.timezone.value);
      }
    });
    const country = new Intl.Locale(navigator.language || "en").region;
    if (country === "IN") fields.holidayCountry.value = country;
    let holidays;
    const refreshHolidays = () => {
      holidays = upcomingHolidays(fields.holidayCountry.value, fields.timezone.value);
      fields.holidayPreset.replaceChildren(new Option("Choose a holiday", ""));
      for (const { id, name, value } of holidays) {
        fields.holidayPreset.add(new Option(`${name} · ${value.wallTime.slice(0, 10)}`, id));
      }
    };
    refreshHolidays();
    fields.holidayCountry.onchange = refreshHolidays;
    fields.timezone.addEventListener("change", refreshHolidays);
    fields.target.addEventListener("input", () => { fields.holidayPreset.value = ""; });
    fields.holidayPreset.onchange = () => {
      const holiday = holidays.find(({ id }) => id === fields.holidayPreset.value);
      if (!holiday) return;
      fields.timerName.value = holiday.name;
      fields.target.value = holiday.value.wallTime;
      fields.target.dispatchEvent(new Event("input", { bubbles: true }));
      fields.holidayPreset.value = holiday.id;
    };
    fields.targetNow.onclick = () => setTarget("now");
    fields.targetToday.onclick = () => setTarget("today");
  },
  create(fields, now, previous) {
    const target = createDateTimer(fields.target.value, fields.timezone.value);
    return { ...target, holdAt: now, ready: true, showSeconds: previous?.showSeconds === true };
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
    return {
      display: dateCountdownDisplay(timer, time),
      status: held ? (timer.ready ? "Ready" : "Paused") : milliseconds ? "Running" : "Complete",
      action: held ? (timer.ready ? "Start" : "Resume") : milliseconds ? "Pause" : "",
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
const platform = foregroundPlatform();
const wake = createWakeController(platform.requestWake);
const repository = openDashboardData((next, previous, commandKey) => {
  dashboards = next.dashboards;
  stored = new Map(Object.entries(next.cards));
  localData = next;
  if (previous) window.dispatchEvent(new CustomEvent("dashboarddata", { detail: { previous, commandKey } }));
});

export const dashboardReady = repository.ready;

const persistenceNotice = '<p class="dashboard-persistence" role="status" hidden></p>';

function showPersistenceStatus(root) {
  const notice = root.querySelector(".dashboard-persistence");
  if (!repository.isVolatile() || !notice.hidden) return;
  notice.hidden = false;
  notice.textContent = "Changes aren’t being saved. You can keep using timers here, but changes may be lost if you reload or close the app.";
}

function boardId(record) {
  return record.dashboardId ?? originalId;
}

export const dashboardPath = "/dashboard";
const addPath = dashboardPath + "/add";
export const historyPath = dashboardPath + "/history";
const editPath = dashboardPath + "/edit/";

function boardUrl(id, path = dashboardPath) {
  return `${path}?board=${encodeURIComponent(id)}`;
}

const speakerIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 4 5 9H2v6h3l6 5z"/>
  <path class="dashboard-speaker-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>
  <path class="dashboard-speaker-cross" d="m16 9 6 6m0-6-6 6"/>
</svg>`;

const penIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20z"/></svg>';

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
    ${persistenceNotice}
    ${definition ? `
      <form class="card dashboard-form" novalidate>
        ${supportsPresets ? `<label class="field">Preset <select name="preset"></select></label>` : ""}
        <label class="field">Name (optional) <input name="timerName" maxlength="80"></label>
        ${definition.fields}
        <p class="dashboard-error" role="alert" hidden></p>
        <div class="dashboard-actions">
          <a href="${home}" data-route ${record ? "" : 'data-dashboard-focus="add"'}>Cancel</a>
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
  const showPersistence = () => showPersistenceStatus(root);
  const unmount = () => window.removeEventListener("dashboarddata", showPersistence);
  showPersistence();
  window.addEventListener("dashboarddata", showPersistence);
  if (!definition) return { redraw() {}, unmount };
  const form = root.querySelector("form");
  const error = form.querySelector(".dashboard-error");
  definition.init?.(form.elements, record?.value);
  if (record) form.elements.timerName.value = record.name;
  form.oninput = () => { error.hidden = true; };
  function fillEmptyTimerField(field) {
    if (!(field instanceof HTMLInputElement) || !field.required || !field.validity.valueMissing ||
        field.validity.badInput) return;
    if (field.type === "number") field.value = field.min || "0";
    if (definition === dateCountdown && field === form.elements.target) {
      field.value = dateCountdownShortcut("today", "", form.elements.timezone.value);
      field.dataset.autoFilled = "";
    }
  }
  form.addEventListener("focusout", event => fillEmptyTimerField(event.target));
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

  async function saveTimer(submitter) {
    const now = Date.now();
    const name = fields.timerName.value.trim();
    let value;
    try {
      if (definition === dateCountdown && fields.target.hasAttribute("data-auto-filled")) {
        fields.target.value = dateCountdownShortcut("today", "", fields.timezone.value);
      }
      value = definition.create(fields, now, record?.value);
    } catch (issue) {
      error.textContent = issue.message;
      error.hidden = false;
      return;
    }
    const action = submitter?.name;
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
    if (saved && form.isConnected) navigate(home, true, editKey ? undefined : key);
    else error.hidden = false;
  }
  let saving = false;
  form.onsubmit = async event => {
    event.preventDefault();
    if (saving) return;
    for (const field of fields) fillEmptyTimerField(field);
    if (!form.reportValidity()) return;
    saving = true;
    try {
      await saveTimer(event.submitter);
    } catch {
      error.textContent = "Could not save. Try again.";
      error.hidden = false;
    } finally {
      saving = false;
    }
  };
  return { redraw() {}, unmount() {
    unmount();
    window.removeEventListener("dashboarddata", refreshPresets);
  } };
}

export function mountDashboard(root, { path, requestedBoard, requestedTimer, interval, linkedTimers, navigate, focusTarget }) {
  const viewingHistory = path === historyPath;
  if (requestedBoard !== null && !dashboards.boards.some(board => board.id === requestedBoard)) {
    navigate(viewingHistory ? historyPath : dashboardPath, true);
    return;
  }
  activeId = requestedBoard ?? dashboards.defaultId;
  function updateHistoryLink() {
    document.querySelector(".dashboard-history-tab").href = viewingHistory
      ? location.pathname + location.search
      : boardUrl(activeId, historyPath);
  }
  updateHistoryLink();
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
    <div class="dashboard-switcher" ${viewingHistory ? "hidden" : ""}>
      <div class="dashboard-tabs" role="group" aria-label="Dashboards"></div>
      <details class="dashboard-board-picker">
        <summary>Switch dashboard</summary>
        <div class="dashboard-board-links"></div>
      </details>
      <button type="button" class="dashboard-options secondary" aria-label="Dashboard options" aria-haspopup="dialog" title="Dashboard options">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9.8 3h4.4l.6 2.6 1.7 1 2.6-.8 2.2 3.8-2 1.8v2l2 1.8-2.2 3.8-2.6-.8-1.7 1-.6 2.6H9.8l-.6-2.6-1.7-1-2.6.8-2.2-3.8 2-1.8v-2l-2-1.8 2.2-3.8 2.6.8 1.7-1z" transform="translate(0 -.4)"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>
    <dialog class="dashboard-create dashboard-settings" aria-labelledby="dashboard-settings-title">
      <div class="dashboard-form">
        <h2 id="dashboard-settings-title">Dashboard options</h2>
        <p class="dashboard-settings-name"></p>
        <button type="button" class="dashboard-default secondary"></button>
        <button type="button" class="dashboard-rename secondary">Rename dashboard</button>
        <button type="button" class="dashboard-new secondary">Add dashboard</button>
        <button type="button" class="dashboard-delete secondary">Remove dashboard</button>
        <div class="dashboard-actions"><button type="button" class="dashboard-settings-close secondary">Close</button></div>
      </div>
    </dialog>
    <dialog class="dashboard-create dashboard-editor" aria-labelledby="dashboard-create-title">
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
      <div class="dashboard-title">
        <h1 tabindex="-1"></h1>
        ${viewingHistory ? "" : '<button type="button" class="dashboard-board-sound dashboard-title-sound secondary" hidden></button>'}
      </div>
      ${viewingHistory
        ? '<a class="dashboard-return" data-route>Back to dashboard</a>'
        : `<div class="dashboard-heading-actions"><a href="${boardUrl(activeId, addPath)}" class="dashboard-add" data-route>Add Timer</a></div>`}
    </header>
    ${persistenceNotice}
    <dialog class="dashboard-create dashboard-removal-block" aria-labelledby="dashboard-removal-title">
      <div class="dashboard-form">
        <h2 id="dashboard-removal-title">Unfinished timers</h2>
        <p></p>
        <div class="dashboard-actions">
          <a data-route>View dashboard</a>
          <button type="button" class="secondary">Close</button>
        </div>
      </div>
    </dialog>
    <section class="dashboard-board-view" ${viewingHistory ? "hidden" : ""}>
    <aside class="dashboard-off-board" aria-label="Timers on other dashboards" hidden></aside>
    <p class="dashboard-announcement" role="status"></p>
    <p class="dashboard-empty">Add a timer for a duration, a routine, or a date. You can also add a world clock.</p>
    <section class="dashboard-grid" aria-label="Saved timers and clocks"></section>
    </section>
    <section class="dashboard-history" aria-label="Timer history" ${viewingHistory ? "" : "hidden"}>
      <p class="dashboard-history-scope">Completed and stopped Countdown and Interval Timer runs from all dashboards in this app.</p>
      <label class="field dashboard-history-filter">Filter by timer name <input type="search"></label>
      <p class="dashboard-history-empty">No ended timer sessions yet.</p>
      <ul class="dashboard-history-list"></ul>
    </section>`;

  const add = root.querySelector(".dashboard-add");
  const grid = root.querySelector(".dashboard-grid");
  const empty = root.querySelector(".dashboard-empty");
  const offBoard = root.querySelector(".dashboard-off-board");
  const cards = new Map();
  const switcher = root.querySelector(".dashboard-switcher");
  const tabs = root.querySelector(".dashboard-tabs");
  const boardPicker = root.querySelector(".dashboard-board-picker");
  const boardLinks = boardPicker.querySelector(".dashboard-board-links");
  const returnLink = root.querySelector(".dashboard-return");
  const settings = root.querySelector(".dashboard-settings");
  const options = root.querySelector(".dashboard-options");
  const deleteBoard = root.querySelector(".dashboard-delete");
  const filter = root.querySelector(".dashboard-history-filter input");
  if (viewingHistory) {
    filter.oninput = renderHistory;
  }
  const heading = root.querySelector("h1");
  const defaultButton = root.querySelector(".dashboard-default");
  const titleSound = root.querySelector(".dashboard-title-sound");
  const activeBoard = () => dashboards.boards.find(board => board.id === activeId);
  let audibleBoard;
  let soundIndicatorTimer;
  const announcement = root.querySelector(".dashboard-announcement");
  const create = root.querySelector(".dashboard-editor");
  const createForm = create.querySelector("form");
  const nameInput = createForm.elements.name;
  let wasVisible = false;

  const removalBlock = root.querySelector(".dashboard-removal-block");
  const owningBoardLink = removalBlock.querySelector("a");
  removalBlock.querySelector("button").onclick = () => removalBlock.close();
  function showRemovalBlock(board, keys, removingBoard) {
    const names = keys.map(key => {
      const record = stored.get(key);
      return record?.name || sessionDefinition(record?.type)?.name;
    }).filter(Boolean);
    const guidance = removingBoard
      ? "Stop the unfinished timers before removing this dashboard."
      : "Stop this timer before removing it.";
    removalBlock.querySelector("p").textContent = names.length ? `${guidance} ${names.join(", ")}.` : guidance;
    owningBoardLink.hidden = !viewingHistory && board === activeId;
    owningBoardLink.href = boardUrl(board);
    if (removalBlock.isConnected && !removalBlock.open) removalBlock.showModal();
  }

  let renamingId;
  function openDashboardDialog(board) {
    renamingId = board?.id;
    nameInput.value = board?.name ?? "";
    create.querySelector("h2").textContent = board ? "Rename dashboard" : "Add dashboard";
    createForm.querySelector('[type="submit"]').textContent = board ? "Save name" : "Add dashboard";
    nameInput.setCustomValidity("");
    create.showModal();
  }

  options.onclick = () => settings.showModal();
  root.querySelector(".dashboard-settings-close").onclick = () => settings.close();
  boardPicker.onkeydown = event => {
    if (event.key !== "Escape" || !boardPicker.open) return;
    boardPicker.open = false;
    boardPicker.querySelector("summary").focus();
  };
  root.querySelector(".dashboard-new").onclick = () => {
    settings.close();
    openDashboardDialog();
  };
  root.querySelector(".dashboard-rename").onclick = () => {
    settings.close();
    openDashboardDialog(dashboards.boards.find(board => board.id === activeId));
  };
  root.querySelector(".dashboard-cancel").onclick = () => create.close();
  create.addEventListener("close", () => {
    if (create.isConnected) options.focus();
  });
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
  function configureBoardSound(button, board) {
    button.innerHTML = speakerIcon;
    button.dataset.soundBoard = board.id;
    button.dataset.muted = String(board.muted === true);
    button.dataset.audible = String(audibleBoard === board.id && !board.muted);
    const label = `${board.muted ? "Unmute" : "Mute"} ${board.name}`;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.onclick = () => {
      if (board.muted) unlockTone();
      void repository.change(({ dashboards }) => {
        const saved = dashboards.boards.find(candidate => candidate.id === board.id);
        if (!saved) return false;
        saved.muted = !saved.muted;
        return true;
      });
    };
  }

  function clearSoundIndicator() {
    clearTimeout(soundIndicatorTimer);
    audibleBoard = undefined;
    for (const button of root.querySelectorAll('[data-audible="true"]')) button.dataset.audible = "false";
  }

  function indicateSound() {
    clearSoundIndicator();
    audibleBoard = activeId;
    for (const button of root.querySelectorAll("[data-sound-board]")) {
      if (button.dataset.soundBoard === activeId) button.dataset.audible = "true";
    }
    soundIndicatorTimer = setTimeout(clearSoundIndicator, 900);
  }

  function playDashboardTone(play) {
    if (play()) indicateSound();
  }

  function updatePreferences() {
    const isDefault = dashboards.defaultId === activeId;
    defaultButton.hidden = dashboards.boards.length === 1;
    defaultButton.textContent = isDefault ? "Opens first" : "Open this dashboard first";
    defaultButton.setAttribute("aria-disabled", String(isDefault));
  }

  deleteBoard.onclick = async () => {
    const board = dashboards.boards.find(board => board.id === activeId);
    if (!board || dashboards.boards.length === 1) return;
    const boardCards = data => Object.keys(data.cards).filter(key => boardId(data.cards[key]) === board.id);
    let blocked = unfinishedCards(localData, boardCards(localData), Date.now());
    if (blocked.length) {
      settings.close();
      showRemovalBlock(board.id, blocked, true);
      return;
    }
    if (!window.confirm(`Remove “${board.name}” and its timers and clocks? Past runs stay in History.`)) return;
    const removed = await repository.change(data => {
      const boards = data.dashboards.boards;
      const index = boards.findIndex(item => item.id === board.id);
      if (index < 0 || boards.length === 1) return false;
      const now = Date.now();
      const keys = boardCards(data);
      blocked = unfinishedCards(data, keys, now);
      if (blocked.length) return false;
      checkpointSessions(data, now);
      for (const entry of data.history) {
        if (entry.dashboardId === board.id) entry.dashboardName = boards[index].name;
      }
      boards.splice(index, 1);
      if (data.dashboards.defaultId === board.id) {
        data.dashboards.defaultId = boards[Math.min(index, boards.length - 1)].id;
      }
      for (const key of keys) delete data.cards[key];
      return true;
    });
    if (!settings.isConnected) return;
    if (blocked.length || removed) settings.close();
    if (blocked.length) showRemovalBlock(board.id, blocked, true);
  };

  function refreshDashboard() {
    if (!dashboards.boards.some(board => board.id === activeId)) activeId = dashboards.defaultId;
    const active = activeBoard();
    heading.textContent = viewingHistory ? "Timer history" : active.name;
    document.title = `${heading.textContent} · Time And Date`;
    updateHistoryLink();
    if (viewingHistory) {
      returnLink.href = boardUrl(activeId);
      return;
    }
    add.href = boardUrl(activeId, addPath);
    updatePreferences();
    if (active.muted) clearSoundIndicator();
    configureBoardSound(titleSound, active);
    settings.querySelector(".dashboard-settings-name").textContent = active.name;
    deleteBoard.disabled = dashboards.boards.length === 1;
    const focusedLink = document.activeElement;
    for (const group of [tabs, boardLinks]) {
      const focusedBoard = group.contains(focusedLink) && focusedLink.dataset.boardId;
      const focusedSound = group.contains(focusedLink) && focusedLink.dataset.soundBoard;
      group.replaceChildren();
      for (const board of dashboards.boards) {
        const link = document.createElement("a");
        link.href = boardUrl(board.id);
        link.dataset.route = "";
        link.dataset.boardId = board.id;
        link.textContent = board.name;
        if (board.id === activeId) link.setAttribute("aria-current", "page");
        const item = document.createElement("div");
        item.className = "dashboard-board-item";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dashboard-board-sound secondary";
        configureBoardSound(button, board);
        item.append(link, button);
        group.append(item);
        if (board.id === focusedSound) button.focus({ preventScroll: true });
        if (board.id === focusedBoard) link.focus({ preventScroll: true });
      }
    }
    const singleBoard = dashboards.boards.length === 1;
    switcher.hidden = singleBoard;
    if (singleBoard && options.parentElement === switcher) add.parentElement.append(options);
    if (!singleBoard && options.parentElement !== switcher) switcher.append(options);
    boardPicker.hidden = singleBoard;
    tabs.hidden = boardPicker.hidden || dashboards.boards.length > 3 ||
      dashboards.boards.some(board => board.name.length > 24);
    titleSound.hidden = false;
    titleSound.classList.toggle("dashboard-title-sound-mobile", !tabs.hidden);
  }

  function fitReadout(clock) {
    const text = clock.firstElementChild;
    const available = clock.clientWidth;
    if (!available) return;
    clock.style.removeProperty("font-size");
    if (text.getBoundingClientRect().width <= available) return;
    let low = 0;
    let high = Number.parseFloat(getComputedStyle(clock).fontSize);
    // Measure the rendered text because glyph widths can change with optical sizing.
    while (high - low > 0.25) {
      const size = (low + high) / 2;
      clock.style.fontSize = `${size}px`;
      if (text.getBoundingClientRect().width <= available) low = size;
      else high = size;
    }
    clock.style.fontSize = `${low}px`;
  }

  const readoutWidths = new WeakMap();
  const readouts = new ResizeObserver(entries => {
    for (const { target, contentRect: { width } } of entries) {
      if (readoutWidths.get(target) === width) continue;
      readoutWidths.set(target, width);
      fitReadout(target);
    }
  });

  const countdownBorders = new ResizeObserver(entries => {
    for (const { target, contentRect: { width, height } } of entries) {
      const edge = 1.5;
      if (width <= edge * 2 || height <= edge * 2) continue;
      const right = width - edge;
      const bottom = height - edge;
      const radius = Math.min(
        parseFloat(getComputedStyle(target.parentElement).borderTopLeftRadius) - edge,
        width / 2 - edge,
        height / 2 - edge,
      );
      const arc = `A ${radius} ${radius} 0 0 1`;
      const outline = `M ${width / 2} ${edge}
        H ${right - radius} ${arc} ${right} ${edge + radius}
        V ${bottom - radius} ${arc} ${right - radius} ${bottom}
        H ${edge + radius} ${arc} ${edge} ${bottom - radius}
        V ${edge + radius} ${arc} ${edge + radius} ${edge} Z`;
      for (const path of target.children) path.setAttribute("d", outline);
    }
  });

  function addCard(key, record, path, definition = savedDefinition(record)) {
    const isClock = record.type === "clock";
    const sessionSound = !path && definition === sessionDefinition(record.type);
    const hasSeconds = isClock || definition === dateCountdown;
    let formats;
    let formatsShowSeconds;
    let showSeconds;
    const zone = isClock ? record.value.zone.replaceAll("_", " ") : "";
    const card = document.createElement("article");
    card.className = "card dashboard-card";
    card.dataset.cardKey = key;
    card.dataset.cardType = record.type;
    card.innerHTML = `
      ${definition === dashboardCountdown ? `<svg class="dashboard-countdown-border" aria-hidden="true">
        <path></path><path pathLength="1" stroke-dasharray="0 1"></path>
      </svg>` : ""}
      <div class="dashboard-card-heading">
        <h2 tabindex="-1"></h2>
        <div class="dashboard-card-controls">
        ${isClock ? "" : `<button type="button" class="secondary dashboard-icon dashboard-mute">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <g class="dashboard-speaker">
              <path d="M11 4 5 9H2v6h3l6 5z"/>
              <path class="dashboard-speaker-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>
              <path class="dashboard-speaker-cross" d="m16 9 6 6m0-6-6 6"/>
            </g>
            <g class="dashboard-speaker-voice">
              <path d="M10 21v-4h4v-3h3l-2-4V9a6 6 0 1 0-12 0c0 3 1 5 3 7v5m6-12h.01"/>
              <path d="M18 8a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"/>
            </g>
          </svg>
        </button>`}
        ${!path && definition.toggle ? `<a class="dashboard-icon dashboard-edit" data-route>${penIcon}</a>` : ""}
        ${!path ? '<button type="button" class="secondary dashboard-icon dashboard-remove">×</button>' : ""}
        </div>
      </div>
      ${isClock
        ? '<time class="dashboard-clock"><span></span></time>'
        : '<p class="dashboard-clock" role="timer" aria-label="Time remaining"><span></span></p>'}
      <p class="dashboard-status"></p>
      ${hasSeconds ? `<label class="dashboard-clock-seconds"><input type="checkbox"
        ${isClock ? "" : 'title="Show seconds before the final hour" aria-label="Show seconds before the final hour"'}> Seconds</label>` : ""}
      <div class="dashboard-actions"></div>
      <p class="dashboard-detail"></p>`;
    const title = card.querySelector("h2");
    const detail = card.querySelector(".dashboard-detail");
    const clock = card.querySelector(".dashboard-clock");
    const readout = clock.firstElementChild;
    let readoutShape;
    readouts.observe(clock);
    function updateReadout(display) {
      if (readout.textContent === display) return;
      readout.textContent = display;
      const shape = display.replace(/[0-9]/g, "0");
      if (shape === readoutShape) return;
      readoutShape = shape;
      fitReadout(clock);
    }
    const status = card.querySelector(".dashboard-status");
    const border = card.querySelector(".dashboard-countdown-border");
    if (border) countdownBorders.observe(border);
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
        if (sessionSound) unlockTone();
        void repository.change(data => {
          if (path) {
            const muted = data.dashboards.mutedLinkedTimers ??= {};
            muted[key] = muted[key] !== true;
          } else {
            const current = data.cards[key];
            if (!current || boardId(current) !== id) return false;
            if (sessionSound) {
              const session = definition.normalize(current.value, Date.now());
              const boardSound = data.dashboards.boards.find(board => board.id === id)?.sound === true;
              const mode = session.config.soundMode ?? (current.muted ? "off" : timerSoundMode(session.config, boardSound));
              const modes = Object.keys(timerSoundChoices);
              const soundMode = modes[(modes.indexOf(mode) + 1) % modes.length];
              current.value = { ...session, config: { ...session.config, soundMode } };
              delete current.muted;
            } else {
              current.muted = current.muted !== true;
            }
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
        toggle = timerButton("Start", definition.toggle);
        toggle.classList.remove("secondary");
        toggle.classList.add("dashboard-primary");
        if (definition.reset) reset = timerButton("Reset", definition.reset);
        for (const [action, label] of Object.entries(definition.commands ?? {})) {
          const button = timerButton(label, (value, now) => definition.command(value, action, now));
          button.dataset.action = action;
          commandButtons.push([action, button]);
        }
        edit = card.querySelector(".dashboard-edit");
        edit.href = boardUrl(activeId, editPath + key.slice(prefix.length));
        edit.setAttribute("aria-label", `Edit ${label}`);
        edit.dataset.tooltip = `Edit ${label}`;
      }
      const remove = card.querySelector(".dashboard-remove");
      if (hasSeconds) {
        showSeconds = card.querySelector(".dashboard-clock-seconds input");
        showSeconds.onchange = () => {
          const checked = showSeconds.checked;
          void repository.change(data => {
            const current = data.cards[key];
            if (current?.type !== record.type || boardId(current) !== boardId(record)) return false;
            current.value.showSeconds = checked;
            return true;
          });
        };
      }
      remove.setAttribute("aria-label", `Remove ${label}`);
      remove.dataset.tooltip = `Remove ${label}`;
      remove.onclick = async () => {
        const id = boardId(record);
        let blocked = unfinishedCards(localData, [key], Date.now());
        if (blocked.length) {
          remove.focus();
          showRemovalBlock(id, blocked, false);
          return;
        }
        const historyNote = sessionDefinition(record.type) ? " Past runs stay in History." : "";
        if (!window.confirm(`Remove “${label}”?${historyNote}`)) return;
        const removed = await repository.change(data => {
          if (!data.cards[key]) return false;
          const now = Date.now();
          blocked = unfinishedCards(data, [key], now);
          if (blocked.length) return false;
          checkpointSessions(data, now);
          delete data.cards[key];
          return true;
        });
        if (blocked.length) {
          remove.focus();
          showRemovalBlock(id, blocked, false);
        }
        if (removed) add.focus();
      };
    }

    let previousStatus;
    cards.set(key, (now, announce) => {
      const current = path ? record : stored.get(key);
      if (!current) return;
      const checked = current.value.showSeconds === true;
      if (showSeconds && checked !== showSeconds.defaultChecked) {
        showSeconds.defaultChecked = checked;
        showSeconds.checked = checked;
      }
      if (definition === dateCountdown) {
        const secondsLabel = showSeconds.parentElement;
        const hidden = dateCountdownUsesAutomaticSeconds(current.value, now);
        if (hidden && document.activeElement === showSeconds) title.focus({ preventScroll: true });
        if (secondsLabel.hidden !== hidden) secondsLabel.hidden = hidden;
      }
      if (isClock) {
        if (!formats || checked !== formatsShowSeconds) {
          formats = clockFormatters(record.value.zone, checked);
          formatsShowSeconds = checked;
        }
        const display = formats.time.format(now);
        const date = formats.date.format(now);
        updateReadout(display);
        clock.dateTime = new Date(now).toISOString();
        if (status.textContent !== date) status.textContent = date;
        return;
      }
      const view = definition.describe(current.value, now);
      const config = sessionSound ? definition.normalize(current.value, now).config : undefined;
      const mode = config?.soundMode ?? (config && !current.muted ? timerSoundMode(config, activeBoard().sound === true) : undefined);
      const muted = path ? linkedMute() : mode ? mode === "off" : current.muted === true;
      const pressed = String(muted);
      if (sessionSound) {
        const state = mode ?? "off";
        if (mute.dataset.soundMode !== state) {
          mute.dataset.soundMode = state;
          const modes = Object.keys(timerSoundChoices);
          const next = modes[(modes.indexOf(state) + 1) % modes.length];
          mute.dataset.tooltip = `Sound for ${label}: ${timerSoundChoices[state]}. Click for ${timerSoundChoices[next]}.`;
          mute.setAttribute("aria-label", mute.dataset.tooltip);
        }
      } else if (mute.dataset.muted !== pressed) {
        mute.dataset.muted = pressed;
        mute.setAttribute("aria-pressed", pressed);
        mute.dataset.tooltip = muted ? "Unmute timer alerts" : "Mute timer alerts";
      }
      const changed = previousStatus?.startsWith("Running") && previousStatus !== view.status &&
        (view.status.startsWith("Complete") || view.status.startsWith("Running"));
      previousStatus = view.status;
      const description = record.name ? `${definition.name} · ${view.detail}` : view.detail;
      if (detail.textContent !== description) detail.textContent = description;
      updateReadout(view.display);
      const statusText = current.value.recovered && view.status.startsWith("Paused")
        ? view.status.replace("Paused", "Restored paused") : view.status;
      const cue = view.border?.label;
      const visibleStatus = cue ? `${statusText} · ${cue}` : statusText;
      if (status.textContent !== visibleStatus) status.textContent = visibleStatus;
      if (border) {
        const { fraction, state } = view.border;
        if (card.dataset.borderState !== state) card.dataset.borderState = state;
        const dash = `${fraction} 1`;
        if (border.lastElementChild.getAttribute("stroke-dasharray") !== dash) {
          border.lastElementChild.setAttribute("stroke-dasharray", dash);
        }
      }
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
      if (announce && changed) return {
        text: `${label}. ${view.status}.`,
        audible: !muted && config?.soundMode === undefined &&
          current.value.config?.completionSound === undefined && !current.value.config?.finalSecondsEnabled,
      };
    });
    grid.append(card);
  }

  let previousOffBoardRuns = "[]";
  function renderOffBoardRuns(now) {
    if (viewingHistory) return;
    const runs = offBoardRuns(localData, activeId, now);
    const snapshot = JSON.stringify(runs);
    if (snapshot === previousOffBoardRuns) return;
    previousOffBoardRuns = snapshot;

    const focused = document.activeElement;
    const hadFocus = offBoard.contains(focused);
    const focusedKey = hadFocus ? focused.dataset.dashboardFocus : undefined;
    const wasOpen = offBoard.querySelector("details")?.open;
    offBoard.replaceChildren();
    offBoard.hidden = runs.length === 0;
    if (!runs.length) {
      if (hadFocus) add.focus({ preventScroll: true });
      return;
    }

    function runLink(run) {
      const link = document.createElement("a");
      link.className = "dashboard-off-board-link";
      link.href = `${boardUrl(run.dashboardId)}&timer=${encodeURIComponent(run.key.slice(prefix.length))}`;
      link.dataset.route = "";
      link.dataset.dashboardFocus = run.key;
      const name = document.createElement("strong");
      name.textContent = run.name;
      const context = document.createElement("span");
      const status = run.status === "running" ? "Running" : run.recovered ? "Restored paused" : "Paused";
      context.textContent = `${run.dashboardName} · ${status}`;
      link.append(name, context);
      link.onclick = () => {
        if (dashboards.boards.find(board => board.id === run.dashboardId)?.sound) unlockTone();
      };
      return link;
    }

    const links = runs.map(runLink);
    if (links.length === 1) {
      offBoard.append(links[0]);
    } else {
      const details = document.createElement("details");
      details.open = Boolean(wasOpen || focusedKey);
      const summary = document.createElement("summary");
      const running = runs.filter(run => run.status === "running").length;
      const paused = runs.length - running;
      const counts = [running ? `${running} running` : "", paused ? `${paused} paused` : ""].filter(Boolean);
      summary.textContent = `Other dashboards · ${counts.join(", ")}`;
      details.append(summary, ...links);
      offBoard.append(details);
    }
    if (hadFocus) {
      const target = links.find(link => link.dataset.dashboardFocus === focusedKey)
        ?? offBoard.querySelector("summary, a");
      target.focus({ preventScroll: true });
    }
  }

  function redraw(commandKey) {
    const now = Date.now();
    renderOffBoardRuns(now);
    const visible = !document.hidden;
    const messages = [];
    for (const [key, update] of cards) {
      const message = update(now, visible && wasVisible && key !== commandKey);
      if (message) messages.push(message);
    }
    wasVisible = visible;
    if (messages.length) {
      announcement.textContent = messages.map(message => message.text).join(" ");
      const board = activeBoard();
      if (board.sound && !board.muted && messages.some(message => message.audible)) playDashboardTone(playTone);
    }
  }

  function refresh() {
    if (viewingHistory) return;
    const focusable = "h2, button, a[href], input";
    const focused = document.activeElement;
    const previousCard = focused?.closest("[data-card-key]");
    const focusIndex = previousCard && grid.contains(previousCard)
      ? [...previousCard.querySelectorAll(focusable)].indexOf(focused) : -1;
    wasVisible = false;
    announcement.textContent = "";
    cards.clear();
    readouts.disconnect();
    countdownBorders.disconnect();
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
    if (focusIndex !== -1) {
      const replacement = [...grid.children].find(card =>
        card.dataset.cardKey === previousCard.dataset.cardKey &&
        card.dataset.cardType === previousCard.dataset.cardType);
      const control = replacement?.querySelectorAll(focusable)[focusIndex];
      const target = control && !control.closest("[hidden]") && !control.disabled
        ? control : replacement?.querySelector("h2") ?? add;
      target.focus({ preventScroll: true });
    }
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
    emptyHistory.textContent = query ? "No sessions match this timer name." : "No completed or stopped runs yet.";
  }

  function onData(event) {
    const { previous, commandKey } = event.detail;
    showPersistenceStatus(root);
    const dashboardsChanged = JSON.stringify(previous.dashboards) !== JSON.stringify(dashboards);
    const priorActive = activeId;
    if (dashboardsChanged) {
      if (requestedBoard !== null && !dashboards.boards.some(board => board.id === requestedBoard)) {
        navigate(viewingHistory ? historyPath : dashboardPath, true);
        return;
      }
      refreshDashboard();
    }
    if (viewingHistory) {
      if (dashboardsChanged || JSON.stringify(previous.history) !== JSON.stringify(localData.history)) renderHistory();
      return;
    }
    updateForeground();
    const keys = Object.keys(localData.cards).filter(key => boardId(localData.cards[key]) === activeId);
    const oldKeys = Object.keys(previous.cards).filter(key => boardId(previous.cards[key]) === activeId);
    const linkedBoard = boards => boards.find(board => board.id === originalId)?.id ?? boards[0].id;
    const structuralChange = keys.length !== oldKeys.length || keys.some(key => {
      const card = localData.cards[key];
      const old = previous.cards[key];
      return !old || card.name !== old.name || card.type !== old.type || card.dashboardId !== old.dashboardId ||
        (card.type === "clock" && card.value.zone !== old.value.zone);
    });
    if (priorActive !== activeId || structuralChange ||
        linkedBoard(previous.dashboards.boards) !== linkedBoard(dashboards.boards)) refresh();
    else redraw(commandKey);
  }

  function onStorage(event) {
    if (event.key?.startsWith("timeandate.") && event.key !== dataKey) refresh();
  }

  const cues = createForegroundCues({
    speech: platform.speech && {
      play(text, expiresAt) {
        if (Date.now() < expiresAt) indicateSound();
        return platform.speech.play(text, expiresAt);
      },
      stop: () => platform.speech.stop(),
    },
    tone: () => playDashboardTone(playTone),
    tick: () => playDashboardTone(playTick),
  });
  let cueBoard;

  function updateForeground(retryWake = false) {
    if (viewingHistory || !platform.visible()) {
      cues.clear();
      wake.update(false);
      return;
    }
    if (cueBoard !== activeId) cues.clear();
    cueBoard = activeId;
    const now = Date.now();
    const rows = [];
    const muted = activeBoard()?.muted === true;
    let awake = false;
    for (const [key, record] of stored) {
      const definition = sessionDefinition(record.type);
      if (!definition || boardId(record) !== activeId || !record.value?.config) continue;
      const config = record.value.config;
      if (config.keepAwake && advanceSession(record.value, now).status === "running") awake = true;
      if (hasForegroundCues(config)) {
        rows.push({ key, label: record.name || definition.name,
          muted: muted || (config.soundMode === undefined && record.muted === true), session: record.value });
      }
    }
    cues.update(rows, now);
    wake.update(awake, retryWake);
  }

  function enableSound() {
    const board = activeBoard();
    if (!board?.muted && (board?.sound || [...stored.values()].some(record => boardId(record) === activeId &&
      (record.value?.config?.soundMode === "tick" || record.value?.config?.finalSecondsEnabled ||
        record.value?.config?.completionSound === "chime")))) unlockTone();
    updateForeground(true);
  }

  function resetAnnouncements() {
    wasVisible = false;
    announcement.textContent = "";
    updateForeground();
  }

  root.addEventListener("pointerup", enableSound);
  root.addEventListener("keydown", enableSound);
  window.addEventListener("storage", onStorage);
  window.addEventListener("dashboarddata", onData);
  document.addEventListener("visibilitychange", resetAnnouncements, true);
  window.addEventListener("focus", resetAnnouncements);
  window.addEventListener("blur", resetAnnouncements);
  const cueTick = viewingHistory ? undefined : setInterval(updateForeground, 125);
  updateForeground();
  refreshDashboard();
  refresh();
  renderHistory();
  showPersistenceStatus(root);
  const requestedCard = focusTarget ?? (requestedTimer ? prefix + requestedTimer : undefined);
  const newCard = requestedCard && [...grid.children].find(card => card.dataset.cardKey === requestedCard);
  if (newCard) {
    newCard.scrollIntoView({ block: "nearest" });
    (newCard.querySelector(".dashboard-primary") ?? newCard.querySelector("h2"))?.focus({ preventScroll: true });
  } else if (focusTarget === "add") add?.focus();
  else heading.focus({ preventScroll: true });
  return {
    redraw,
    unmount() {
      root.removeEventListener("pointerup", enableSound);
      root.removeEventListener("keydown", enableSound);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dashboarddata", onData);
      document.removeEventListener("visibilitychange", resetAnnouncements, true);
      window.removeEventListener("focus", resetAnnouncements);
      window.removeEventListener("blur", resetAnnouncements);
      clearInterval(cueTick);
      readouts.disconnect();
      countdownBorders.disconnect();
      cues.clear();
      clearSoundIndicator();
      wake.update(false);
    },
  };
}
