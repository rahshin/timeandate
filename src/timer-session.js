import { pauseTimer, remainingTime, startTimer } from "./timeandate/timer.js";

export { remainingTime as sessionRemaining };

export const DEFAULT_FINAL_SECONDS = 10;
export const MAX_FINAL_SECONDS = 999 * 60 + 59;

export function createTimerSession({
  durationMs, repetitions = 1, restMs = 2000, preparation = false,
  finalSecondsEnabled = false, finalSeconds = DEFAULT_FINAL_SECONDS, kind = "countdown",
}) {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 ||
      !Number.isSafeInteger(repetitions) || repetitions <= 0 ||
      !Number.isSafeInteger(restMs) || restMs < 0) {
    throw new RangeError("Enter a positive duration and repetition count, and a valid rest duration.");
  }
  if (kind === "interval" &&
      (!Number.isInteger(finalSeconds) || finalSeconds < 1 || finalSeconds > MAX_FINAL_SECONDS)) {
    throw new RangeError("Enter a final-seconds window within the allowed range.");
  }
  const config = kind === "interval"
    ? {
      kind, durationMs, repetitions, restMs, preparationMs: preparation ? 3000 : 0,
      finalSecondsEnabled, finalSeconds,
    }
    : { kind: "countdown", durationMs, repetitions: 1, restMs: 0, preparationMs: 0 };
  return ready(config);
}

function ready(config) {
  return {
    config, status: "idle", phase: "activity", cycle: 1, remainingMs: config.durationMs,
    completed: 0, skipped: 0, interrupted: 0, triedSlot: false,
    restarts: 0, discardedActivityMs: 0, pauseMs: 0, pausePeriods: 0, pauseAt: null,
  };
}

function closePause(session, at) {
  if (session.pauseAt === null) return session;
  const elapsed = at - session.pauseAt;
  return {
    ...session, pauseAt: null, pauseMs: session.pauseMs + elapsed,
    pausePeriods: session.pausePeriods + Number(elapsed > 0),
  };
}

function begin(session, at) {
  if (session.phase !== "break") session = closePause(session, at);
  return {
    ...session, ...startTimer(session, at),
    triedSlot: session.triedSlot || session.phase === "activity",
  };
}

function selectPhase(session, phase, remainingMs, at, paused) {
  const { endAt, ...previous } = session;
  const next = { ...previous, phase, remainingMs, status: "paused" };
  return paused ? next : begin(next, at);
}

function nextAttempt(session, at, paused) {
  const { durationMs, preparationMs } = session.config;
  return selectPhase(session, preparationMs ? "preparation" : "activity",
    preparationMs || durationMs, at, paused);
}

function end(session, status, at) {
  const { endAt, ...current } = closePause(session, at);
  return { ...current, status, remainingMs: status === "complete" ? 0 : remainingTime(session, at), endedAt: at };
}

function consumeSlot(session, outcome, at) {
  const current = { ...session, [outcome]: session[outcome] + 1, triedSlot: false };
  if (current.cycle === current.config.repetitions) return end(current, "complete", at);
  const paused = current.status === "paused";
  if (current.config.restMs) {
    return selectPhase({ ...current, pauseAt: current.pauseAt ?? at },
      "break", current.config.restMs, at, paused);
  }
  return nextAttempt({ ...current, cycle: current.cycle + 1 }, at, paused);
}

export function advanceSession(session, now) {
  while (session.status === "running" && now >= session.endAt) {
    const at = session.endAt;
    switch (session.phase) {
      case "activity":
        session = consumeSlot(session, "completed", at);
        break;
      case "break":
        session = nextAttempt({ ...session, cycle: session.cycle + 1 }, at, false);
        break;
      case "preparation":
        session = selectPhase(session, "activity", session.config.durationMs, at, false);
        break;
    }
  }
  return session;
}

export function sessionActions(session) {
  const interval = session.config.kind === "interval";
  switch (session.status) {
    case "idle":
      return ["start"];
    case "running":
    case "paused": {
      const actions = [session.status === "running" ? "pause" : "resume", "stop"];
      if (!interval) return [...actions, "reset"];
      if (session.phase === "activity") return [...actions, "skip", "restart"];
      if (session.phase === "break") return [...actions, "skipRest"];
      return actions;
    }
    default:
      return interval ? ["start"] : ["start", "reset"];
  }
}

export function updateSession(session, action, now) {
  const current = advanceSession(session, now);
  if (!sessionActions(current).includes(action)) return current;
  // A click on Start at a phase boundary must not restart a run that just ended.
  if (action === "start" && current.status !== session.status) return current;
  switch (action) {
    case "start":
      return nextAttempt(ready(current.config), now, false);
    case "pause": {
      const { endAt, ...previous } = current;
      return {
        ...previous, ...pauseTimer(current, now),
        pauseAt: current.phase === "preparation" ? null : current.pauseAt ?? now,
      };
    }
    case "resume":
      return current.phase === "preparation" ? nextAttempt(current, now, false) : begin(current, now);
    case "stop":
      return end({ ...current, interrupted: Number(current.triedSlot) }, "stopped", now);
    case "reset":
      return current.status === "running" ? nextAttempt(ready(current.config), now, false) : ready(current.config);
    case "skip":
      return consumeSlot(current, "skipped", now);
    case "skipRest":
      return nextAttempt({ ...current, cycle: current.cycle + 1 }, now, false);
    case "restart":
      return nextAttempt({
        ...current, restarts: current.restarts + 1,
        discardedActivityMs: current.discardedActivityMs + current.config.durationMs - remainingTime(current, now),
      }, now, current.status === "paused");
  }
}

export function sessionStatistics(session, now) {
  const current = closePause(advanceSession(session, now), now);
  const { config, completed, skipped, interrupted, restarts, discardedActivityMs, pauseMs, pausePeriods } = current;
  return {
    completed, skipped, interrupted, restarts, discardedActivityMs, pauseMs, pausePeriods,
    unattempted: config.repetitions - completed - skipped - interrupted - Number(current.triedSlot && !interrupted),
    averagePauseMs: pausePeriods ? pauseMs / pausePeriods : 0,
  };
}
