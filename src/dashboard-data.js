import { dashboardCountdown, dashboardSessionInterval } from "./dashboard-sessions.js";
import { advanceSession, createTimerSession, sessionStatistics, updateSession } from "./timer-session.js";

export const cardPrefix = "timeandate.dashboard.";
export const dataKey = "timeandate.dashboard-data";
export const checkpointMs = 5000;
export const originalId = "original";
const legacyBoardsKey = "timeandate.dashboards";
const transactionLock = dataKey + ":write";
const presenceLock = dataKey + ":open";

export function sessionDefinition(type) {
  if (type === "duration") return dashboardCountdown;
  if (type === "interval") return dashboardSessionInterval;
}

export function migrateDashboardData(storage) {
  const data = {
    version: 1,
    dashboards: { boards: [{ id: originalId, name: "Dashboard" }], defaultId: originalId },
    cards: {}, presets: {}, history: [],
  };
  function read(key) {
    try {
      return JSON.parse(storage.getItem(key));
    } catch {
      return null;
    }
  }
  const dashboards = read(legacyBoardsKey);
  if (Array.isArray(dashboards?.boards) &&
      dashboards.boards.every(board => typeof board?.id === "string" && typeof board.name === "string") &&
      new Set(dashboards.boards.map(board => board.id)).size === dashboards.boards.length &&
      dashboards.boards.some(board => board.id === dashboards.defaultId)) data.dashboards = dashboards;

  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(cardPrefix)) continue;
    const card = read(key);
    if (typeof card?.name === "string" && Number.isFinite(card.created)) data.cards[key] = card;
  }
  return data;
}

export function savePreset(data, id, type, name, session) {
  data.presets[id] = { type, name, config: { ...session.config } };
}

export function presetSession({ config }) {
  return createTimerSession({ ...config, preparation: Boolean(config.preparationMs) });
}

function recordEnd(data, card, session) {
  if (!session.runId || !["complete", "stopped"].includes(session.status) ||
      data.history.some(entry => entry.id === session.runId)) return;
  const dashboardId = card.dashboardId ?? originalId;
  data.history.push({
    id: session.runId, name: card.name, type: card.type, dashboardId,
    dashboardName: data.dashboards.boards.find(board => board.id === dashboardId)?.name,
    config: session.config, status: session.status, endedAt: session.endedAt,
    statistics: sessionStatistics(session, session.endedAt),
  });
  data.history.sort((left, right) => right.endedAt - left.endedAt || right.id.localeCompare(left.id));
  data.history.length = Math.min(30, data.history.length);
}

function recoveredSession(session, checkpoint, now) {
  const { endAt, ...saved } = session;
  if (session.status === "running") {
    if (Number.isFinite(checkpoint)) {
      Object.assign(saved, updateSession(session, "pause", checkpoint));
    } else {
      // Old cards only saved the remaining time at the most recent transition.
      saved.status = "paused";
      if (saved.phase !== "preparation" && saved.pauseAt === null) saved.pauseAt = now;
    }
  }
  if (saved.pauseAt !== null) {
    saved.pauseAt = Number.isFinite(checkpoint)
      ? now - Math.max(0, checkpoint - saved.pauseAt)
      : now;
  }
  return saved;
}

export function checkpointSessions(data, now, { cold = false, flush = false } = {}) {
  let changed = false;
  for (const [key, card] of Object.entries(data.cards)) {
    const definition = sessionDefinition(card.type);
    if (!definition) continue;
    if (!definition.valid(card.value)) continue;
    const session = definition.normalize(card.value, now);
    const active = session.status === "running" || session.status === "paused";
    let value = session;
    if (active) {
      const identified = session.runId ? session : { ...session, runId: crypto.randomUUID() };
      value = cold ? recoveredSession(identified, card.checkpoint, now) : advanceSession(identified, now);
    }
    if (value === card.value && !(active && (flush || !Number.isFinite(card.checkpoint) || now - card.checkpoint >= checkpointMs))) continue;
    if (active) recordEnd(data, card, value);
    data.cards[key] = { ...card, value, checkpoint: now };
    changed = true;
  }
  return changed;
}

export function commandSession(data, key, action, expected, now) {
  const card = data.cards[key];
  if (!card || JSON.stringify(card.value) !== JSON.stringify(expected)) return false;
  const advanced = advanceSession(card.value, now);
  if (advanced !== card.value) recordEnd(data, card, advanced);
  const value = updateSession(action === "start" ? advanced : card.value, action, now);
  if (value === card.value) return false;
  if (value.status === "running" && !value.runId) value.runId = crypto.randomUUID();
  value.commandRevision = (card.value.commandRevision ?? 0) + 1;
  recordEnd(data, card, value);
  data.cards[key] = { ...card, value, checkpoint: now };
  return true;
}

export function openDashboardData(onChange) {
  const locks = navigator.locks;
  let state;
  let volatile = false;
  const exclusive = work => locks ? locks.request(transactionLock, work) : work();
  function read() {
    if (volatile) return structuredClone(state);
    try {
      const raw = localStorage.getItem(dataKey);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (saved?.version === 1 && saved.dashboards && saved.cards && saved.presets && Array.isArray(saved.history)) {
          return saved;
        }
        volatile = true;
      }
      return migrateDashboardData(localStorage);
    } catch {
      volatile = true;
      return state ? structuredClone(state) : migrateDashboardData([]);
    }
  }

  function publish(next, write, commandKey) {
    if (write && !volatile) {
      try {
        localStorage.setItem(dataKey, JSON.stringify(next));
      } catch {
        volatile = true;
      }
    }
    const previous = state;
    state = next;
    onChange(next, previous, commandKey);
  }

  const ready = Promise.resolve(exclusive(async () => {
    let cold = true;
    if (locks) {
      const { held } = await locks.query();
      cold = !held.some(lock => lock.name === presenceLock);
      // Register before releasing the transaction lock so simultaneous launches agree.
      await new Promise((entered, reject) => {
        locks.request(presenceLock, { mode: "shared" }, () => {
          entered();
          return new Promise(() => {}); // Released when this document is destroyed.
        }).catch(reject);
      });
    }
    const next = read();
    const changed = checkpointSessions(next, Date.now(), { cold });
    // Commit the migrated snapshot even when it contains only ready cards and preferences.
    const migrated = !volatile && localStorage.getItem(dataKey) === null;
    publish(next, changed || migrated);
  }));

  async function change(update, commandKey) {
    await ready;
    return exclusive(() => {
      const next = read();
      const changed = update(next);
      if (changed) publish(next, true, commandKey);
      return changed;
    });
  }

  let pending = false;
  function tick(flush = false) {
    if (pending || !state || !Object.values(state.cards).some(card =>
      card.value?.config && (card.value.status === "running" || card.value.status === "paused"))) return;
    pending = true;
    void change(data => checkpointSessions(data, Date.now(), { flush })).finally(() => { pending = false; });
  }

  window.addEventListener("storage", event => {
    if ((event.key === dataKey || event.key === null) && state && !volatile) publish(read(), false);
  });
  document.addEventListener("visibilitychange", () => tick(document.hidden));
  setInterval(tick, 1000);
  return { ready, change };
}
