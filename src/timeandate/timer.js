const minute = 60_000;
export const PHASE_MS = Object.freeze({ activity: 10 * minute, break: 5 * minute });
export const STORAGE_VERSION = 1;

export function initialTimer(phases = PHASE_MS) {
  return { status: "idle", phase: "activity", cycle: 1, remainingMs: phases.activity };
}

export function reconcile(timer, now, phases = PHASE_MS, activities = Infinity) {
  if (timer.status !== "running" || now < timer.endAt) return timer;

  const cycleMs = phases.activity + phases.break;
  const cyclesLeft = activities - timer.cycle;
  const finalActivityEnd = timer.phase === "activity"
    ? timer.endAt + cyclesLeft * cycleMs
    : timer.endAt + (cyclesLeft - 1) * cycleMs + phases.activity;
  if (now >= finalActivityEnd) {
    return { status: "complete", phase: "activity", cycle: activities, remainingMs: 0 };
  }

  const nextActivity = timer.endAt + (timer.phase === "activity" ? phases.break : 0);
  if (now < nextActivity) return { ...timer, phase: "break", endAt: nextActivity };

  const elapsed = now - nextActivity;
  const fullCycles = Math.floor(elapsed / cycleMs);
  const cycleStart = nextActivity + fullCycles * cycleMs;
  const activity = now - cycleStart < phases.activity;
  return {
    status: "running",
    phase: activity ? "activity" : "break",
    cycle: timer.cycle + fullCycles + 1,
    endAt: cycleStart + (activity ? phases.activity : cycleMs),
  };
}

export function remainingTime(timer, now) {
  return timer.status === "running"
    ? Math.max(0, timer.endAt - now)
    : timer.remainingMs;
}

export function startTimer(timer, now) {
  if (timer.status !== "paused" && timer.status !== "idle") return timer;
  const { phase, cycle, remainingMs } = timer;
  return { status: "running", phase, cycle, endAt: now + remainingMs };
}

export function pauseTimer(timer, now, phases = PHASE_MS, activities = Infinity) {
  if (timer.status !== "running") return timer;
  const current = reconcile(timer, now, phases, activities);
  if (current.status === "complete") return current;
  const { phase, cycle, endAt } = current;
  return { status: "paused", phase, cycle, remainingMs: endAt - now };
}

export function formatRemaining(ms) {
  const seconds = Math.ceil(ms / 1000);
  return [Math.floor(seconds / 60), seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}

export function restoreTimer(saved, phases = PHASE_MS, activities = Infinity) {
  const timer = saved?.timer;
  const invalid = saved?.version !== STORAGE_VERSION || !timer ||
    !Object.hasOwn(PHASE_MS, timer.phase) ||
    !Number.isSafeInteger(timer.cycle) || timer.cycle < 1 || timer.cycle > Number.MAX_SAFE_INTEGER / 2 ||
    timer.cycle > activities || (timer.phase === "break" && timer.cycle === activities);
  if (invalid) return initialTimer(phases);

  const { status, phase, cycle, remainingMs, endAt } = timer;
  if (status === "complete" && phase === "activity" && cycle === activities && remainingMs === 0) {
    return { status, phase, cycle, remainingMs };
  }
  if (status === "running" && Number.isSafeInteger(endAt) && endAt > 0 && endAt <= 8.64e15) {
    return { status, phase, cycle, endAt };
  }
  if (status === "paused" && Number.isInteger(remainingMs) && remainingMs > 0 && remainingMs <= phases[phase]) {
    return { status, phase, cycle, remainingMs };
  }
  return initialTimer(phases);
}
