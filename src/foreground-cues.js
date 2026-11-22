import { advanceSession } from "./timer-session.js";

const completionWindow = 2000;
const speechTimeout = 8000;

function countdownCue(session, label, now) {
  if (session.status !== "running") return;
  const { phase, config, endAt } = session;
  const seconds = Math.ceil((endAt - now) / 1000);
  const preparation = phase === "preparation";
  const finalSeconds = phase === "activity" && config.finalSecondsEnabled &&
    seconds <= config.finalSeconds && seconds * 1000 < config.durationMs;
  if (!preparation && !finalSeconds) return;
  return {
    id: `${session.runId}/${phase}/${endAt}/${seconds}`,
    text: preparation && seconds === 3 ? `${label}, starting in 3` : String(seconds),
    due: endAt - seconds * 1000,
    expires: endAt - (seconds - 1) * 1000,
  };
}

function nextCueAt(session, now) {
  if (session.status !== "running") return Infinity;
  const { phase, config, endAt } = session;
  if (phase === "preparation") return now;
  if (phase === "activity") {
    if (config.finalSecondsEnabled) return Math.max(now, endAt - Math.min(config.finalSeconds * 1000, config.durationMs - 1000));
    if (config.speakCompletion) return endAt;
  }
  if (phase === "break" && (config.preparationMs || config.speakCompletion || config.finalSecondsEnabled)) return endAt;
  return Infinity;
}

export function createForegroundCues({ speech, tone }) {
  let previous = new Map();
  let seen = new Map();
  let pending = new Map();
  let current;
  let sequence = 0;

  function cancel() {
    if (!current) return;
    current = undefined;
    speech?.stop();
  }

  function clear() {
    cancel();
    pending.clear();
    previous.clear();
    seen.clear();
  }

  function update(rows, now) {
    const next = new Map();
    const options = [];
    for (const row of rows) {
      const session = advanceSession(row.session, now);
      next.set(row.key, session);
      const { config } = session;
      if (row.muted || !(config.speakCompletion || config.preparationMs || config.finalSecondsEnabled)) continue;
      const before = previous.get(row.key);
      const finished = session.status === "complete" && before && before.status !== "complete" && before.status !== "stopped";
      const repeated = before?.status === "running" && before.phase === "activity" &&
        before.completed < session.completed;
      const at = finished ? session.endedAt : before?.endAt;
      const ended = before?.runId === session.runId && (finished || repeated) &&
        Number.isFinite(at) && now < at + completionWindow;
      const completion = ended && config.speakCompletion;
      const signal = ended && repeated && config.finalSecondsEnabled;
      const scheduled = nextCueAt(session, now);
      const held = current?.key === row.key && current.priority ? current : pending.get(row.key);
      const holdingCompletion = held?.priority && session.runId === held.runId &&
        (held === current || held.expires > now);
      if (!(completion || signal || holdingCompletion || Number.isFinite(scheduled))) continue;
      const event = completion ? {
        id: `${session.runId}/complete/${at}`, priority: 1, due: at, expires: at + completionWindow,
        text: finished ? `${row.label} complete` : `${row.label}, repetition ${before.cycle} complete`,
      } : countdownCue(session, row.label, now);
      options.push({
        ...row, session, event, signal,
        priority: completion || holdingCompletion ? 1 : 0,
        scheduled: completion || signal ? at : holdingCompletion ? held.due : scheduled,
      });
    }
    previous = next;
    options.sort((a, b) => b.priority - a.priority || a.scheduled - b.scheduled);
    const eligible = new Map(options.slice(0, 2).map(row => [row.key, row]));
    const available = row => row && row.session.status !== "paused" && row.session.status !== "stopped";
    for (const [key, cue] of pending) {
      const row = eligible.get(key);
      if (!available(row) || row.session.runId !== cue.runId || cue.expires <= now ||
          (!cue.priority && row.event?.id !== cue.id)) pending.delete(key);
    }
    // An ended timer retains eligibility while its completion is in the queue or playing.
    const stillAllowed = cue => {
      const row = eligible.get(cue.key);
      return available(row) && row.session.runId === cue.runId &&
        (cue.priority || (row.session.status === "running" && row.session.endAt === cue.phaseEnd));
    };
    if (current && (!stillAllowed(current) || now >= current.started + speechTimeout)) cancel();
    for (const row of eligible.values()) {
      if (row.signal) tone();
      if (!row.event || seen.get(row.key) === row.event.id) continue;
      seen.set(row.key, row.event.id);
      if (speech && (row.event.priority || !pending.get(row.key)?.priority)) {
        pending.set(row.key, { ...row.event, key: row.key, runId: row.session.runId, phaseEnd: row.session.endAt });
      }
    }
    for (const key of seen.keys()) if (!next.has(key)) seen.delete(key);
    const cue = [...pending.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.due - b.due)[0];
    if (!cue || (current && (!cue.priority || current.priority))) return;
    cancel();
    pending.delete(cue.key);
    const token = ++sequence;
    current = { ...cue, started: now, token };
    Promise.resolve().then(() => {
      if (current?.token === token) return speech.play(cue.text, cue.expires);
    }).catch(() => {}).finally(() => {
      if (current?.token === token) current = undefined;
    });
  }

  return { update, clear };
}

export function createWakeController(request) {
  let wanted = false;
  let attempted = false;
  let pending = false;
  let lease;

  function update(enabled, retry = false) {
    if (enabled !== wanted || retry) attempted = false;
    wanted = enabled;
    if (!wanted && lease) {
      const previous = lease;
      lease = undefined;
      void Promise.resolve().then(() => previous.release()).catch(() => {});
    }
    if (!wanted || !request || pending || attempted || (lease && !lease.released)) return;
    attempted = pending = true;
    Promise.resolve().then(request).then(result => {
      if (!wanted) return result.release();
      lease = result;
    }).catch(() => {}).finally(() => {
      pending = false;
      if (wanted && !attempted) update(true);
    });
  }

  return { update };
}
