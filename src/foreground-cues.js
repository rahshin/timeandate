import { advanceSession } from "./timer-session.js";
import { cueStillApplies, foregroundCue } from "./foreground-cue-policy.js";

const speechTimeout = 8000;

function compareCues(a, b) {
  return b.priority - a.priority || a.due - b.due || a.phaseEnd - b.phaseEnd ||
    a.key.localeCompare(b.key);
}

export function createForegroundCues({ speech, tone }) {
  let previous = new Map();
  const seen = new Map();
  const pending = new Map();
  let current;
  let lastSpokenKey;

  function cancel() {
    if (!current) return;
    current = undefined;
    speech.stop();
  }

  function clear() {
    cancel();
    pending.clear();
    previous.clear();
    seen.clear();
    lastSpokenKey = undefined;
  }

  function update(rows, now) {
    const next = new Map();
    let signalDue = false;
    for (const row of rows) {
      const session = advanceSession(row.session, now);
      next.set(row.key, { ...row, session });
      const before = previous.get(row.key);
      if (row.muted) continue;
      const { event, following, signal } = foregroundCue(
        before?.muted ? undefined : before?.session, session, row.label, now);
      signalDue ||= signal;
      if (!speech) continue;
      for (const candidate of [event, following]) {
        if (!candidate) continue;
        const slot = JSON.stringify([row.key, Boolean(candidate.phase)]);
        const cue = { ...candidate, slot, key: row.key, runId: session.runId, phaseEnd: session.endAt ?? Infinity };
        const spoken = seen.get(slot);
        const held = pending.get(slot);
        if (spoken?.runId === cue.runId && spoken.id === cue.id) continue;
        if (!held || held.expires <= now || !cueStillApplies(held, next.get(row.key)) ||
            cue.priority >= held.priority) pending.set(slot, cue);
      }
    }
    previous = next;

    for (const [slot, cue] of pending) {
      if (cue.expires <= now || !cueStillApplies(cue, next.get(cue.key))) pending.delete(slot);
    }
    for (const [slot, cue] of seen) if (!next.has(cue.key)) seen.delete(slot);
    if (current && (!cueStillApplies(current, next.get(current.key)) ||
        now >= current.started + speechTimeout)) cancel();

    // Only due cues compete for the two speech slots. A valid utterance keeps
    // its slot until a higher-priority candidate interrupts it.
    const ranked = [...pending.values()].sort(compareCues);
    const preempt = current && ranked[0]?.priority > current.priority;
    const eligible = new Set(current && !preempt ? [current.key] : []);
    for (const cue of ranked) {
      if (eligible.size < 2 || eligible.has(cue.key)) eligible.add(cue.key);
      else pending.delete(cue.slot);
    }
    if (signalDue) tone();
    const cue = ranked[0];
    if (!cue || (current && !preempt)) return;

    cancel();
    pending.delete(cue.slot);
    seen.set(cue.slot, cue);
    const playback = { ...cue, started: now };
    current = playback;
    Promise.resolve().then(() => {
      if (current !== playback) return;
      const text = lastSpokenKey !== undefined && lastSpokenKey !== cue.key
        ? cue.namedText ?? cue.text : cue.text;
      lastSpokenKey = cue.key;
      return speech.play(text, cue.expires);
    }).catch(() => {}).finally(() => {
      if (current === playback) current = undefined;
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
