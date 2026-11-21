import { durationDisplay, durationMilliseconds, isDurationTimer } from "./duration.js";
import { validIntervalSettings } from "./timeandate/settings.js";
import { restoreTimer, STORAGE_VERSION } from "./timeandate/timer.js";
import {
  advanceSession, createTimerSession, DEFAULT_FINAL_SECONDS, MAX_FINAL_SECONDS,
  sessionActions, sessionRemaining, updateSession,
} from "./timer-session.js";

const statuses = { idle: "Ready", running: "Running", paused: "Paused", complete: "Complete", stopped: "Stopped early" };
const phases = { activity: "Repetition", break: "Rest after repetition", preparation: "Prepare for repetition" };
const primary = { start: "Start", pause: "Pause", resume: "Resume" };

function timeFields(prefix, legend, minutes, seconds) {
  return `<fieldset class="dashboard-timer-fields">
    <legend>${legend}</legend>
    <div class="duration-fields">
      <label class="field">Minutes <input name="${prefix}Minutes" type="number" min="0" max="999" value="${minutes}" required></label>
      <label class="field">Seconds <input name="${prefix}Seconds" type="number" min="0" max="59" value="${seconds}" required></label>
    </div>
  </fieldset>`;
}

function validSession(value, kind) {
  const config = value?.config;
  if (config?.kind !== kind || !Number.isInteger(config.durationMs) ||
      config.durationMs < 1000 || config.durationMs > durationMilliseconds(999, 59, 59) ||
      !Number.isInteger(config.restMs) || config.restMs < 0 ||
      config.restMs > 999 * 60_000 + 59_000 ||
      !Number.isInteger(config.repetitions) || config.repetitions < 1 || config.repetitions > 999 ||
      ![0, 3000].includes(config.preparationMs) ||
      (config.finalSecondsEnabled !== undefined && typeof config.finalSecondsEnabled !== "boolean") ||
      (config.finalSeconds !== undefined && (!Number.isInteger(config.finalSeconds) ||
        config.finalSeconds < 1 || config.finalSeconds > MAX_FINAL_SECONDS)) ||
      !Object.hasOwn(statuses, value.status) || !Object.hasOwn(phases, value.phase) ||
      !Number.isInteger(value.cycle) || value.cycle < 1 || value.cycle > config.repetitions ||
      !Number.isFinite(value.remainingMs) || value.remainingMs < 0 ||
      (value.status === "running" && !Number.isFinite(value.endAt))) return false;
  return ["completed", "skipped", "interrupted", "restarts", "discardedActivityMs", "pauseMs", "pausePeriods"]
    .every(key => Number.isFinite(value[key]) && value[key] >= 0) &&
    (value.pauseAt === null || Number.isFinite(value.pauseAt)) &&
    typeof value.triedSlot === "boolean";
}

function normalizeCountdown(value) {
  if (value.config) return value;
  const session = createTimerSession({ durationMs: value.initial });
  if (value.ready && value.endAt === null) return session;
  return {
    ...session, triedSlot: true, remainingMs: value.remaining,
    ...(value.endAt === null ? { status: "paused" } : { status: "running", endAt: value.endAt }),
  };
}

function legacyIntervalTimer(value) {
  if (!validIntervalSettings(value) || !value.activities || !value.timer) return;
  const { timer, phases: lengths, activities } = value;
  if (timer.status === "idle") {
    if (timer.phase === "activity" && timer.cycle === 1 && timer.remainingMs === lengths.activity) return timer;
    return;
  }
  const restored = restoreTimer({ version: STORAGE_VERSION, timer }, lengths, activities);
  if (restored.status !== "idle") return restored;
}

function normalizeInterval(value, now) {
  if (value.config) return value;
  const timer = legacyIntervalTimer(value);
  const { phases: lengths, activities } = value;
  const session = createTimerSession({
    kind: "interval", durationMs: lengths.activity, repetitions: activities, restMs: lengths.break,
  });
  if (timer.status === "idle") return session;
  const completed = timer.status === "complete" || timer.phase === "break" ? timer.cycle : timer.cycle - 1;
  const priorRests = timer.cycle - 1;
  // Legacy cards stored deadlines and cycle position. Their earlier manual pauses were not recorded.
  const pauseAt = timer.phase === "break"
    ? (timer.status === "paused" ? now + timer.remainingMs : timer.endAt) - lengths.break
    : null;
  return {
    ...session, ...timer, completed, pauseAt, pausePeriods: priorRests,
    pauseMs: priorRests * lengths.break,
    triedSlot: timer.phase === "activity" && timer.status !== "complete",
  };
}

function describe(session, now, detail) {
  const current = advanceSession(session, now);
  const available = sessionActions(current);
  const status = statuses[current.status];
  const phase = current.config.kind === "interval" && ["running", "paused"].includes(current.status)
    ? ` · ${phases[current.phase]} ${current.cycle} of ${current.config.repetitions}` : "";
  return { display: durationDisplay(sessionRemaining(current, now)), status: status + phase,
    action: primary[available[0]], primaryAction: available[0], available, detail };
}

function configureSession(definition, normalize, detail, commands) {
  return {
    ...definition,
    commands,
    describe(value, now) {
      const session = normalize(value, now);
      return describe(session, now, detail(session.config));
    },
    toggle(value, now, action) {
      return this.command(value, action, now);
    },
    command(value, action, now) {
      const session = normalize(value, now);
      return updateSession(action === "start" ? advanceSession(session, now) : session, action, now);
    },
  };
}

export const dashboardCountdown = configureSession({
  name: "Countdown Timer",
  description: "Count down a duration once.",
  fields: `
    <div class="duration-fields">
      <label class="field">Hours <input name="hours" type="number" min="0" max="999" value="0" required></label>
      <label class="field">Minutes <input name="minutes" type="number" min="0" max="59" value="10" required></label>
      <label class="field">Seconds <input name="seconds" type="number" min="0" max="59" value="0" required></label>
    </div>`,
  init(fields, value) {
    if (!value) return;
    const [hours, minutes, seconds] = durationDisplay(normalizeCountdown(value).config.durationMs).split(":").map(Number);
    fields.hours.value = hours;
    fields.minutes.value = minutes;
    fields.seconds.value = seconds;
  },
  create(fields) {
    const durationMs = durationMilliseconds(fields.hours.valueAsNumber, fields.minutes.valueAsNumber, fields.seconds.valueAsNumber);
    if (!durationMs) throw new Error("Enter a duration greater than zero.");
    return createTimerSession({ durationMs });
  },
  valid: value => validSession(value, "countdown") || isDurationTimer(value),
}, normalizeCountdown, config => `Duration ${durationDisplay(config.durationMs)}`, { stop: "Stop", reset: "Reset" });

export const dashboardSessionInterval = configureSession({
  name: "Interval Timer",
  description: "Repeat a timed activity with optional rest between repetitions.",
  fields: `
    ${timeFields("duration", "Repetition duration", 0, 10)}
    <label class="field">Repetitions <input name="repetitions" type="number" min="1" max="999" value="3" required></label>
    ${timeFields("rest", "Rest duration", 0, 2)}
    <details class="dashboard-advanced"><summary>Advanced</summary>
      <label class="dashboard-checkbox"><input name="preparation" type="checkbox"> 3-second preparation</label>
      <label class="dashboard-checkbox"><input name="finalSecondsEnabled" type="checkbox"> Final-seconds countdown</label>
      <label class="field">Final-seconds window (seconds)
        <input name="finalSeconds" type="number" min="1" max="${MAX_FINAL_SECONDS}" value="${DEFAULT_FINAL_SECONDS}" required>
      </label>
      <p class="dashboard-advanced-hint">Spoken cues will be available in a later update.</p>
    </details>`,
  init(fields, value) {
    if (!value) return;
    const { config } = normalizeInterval(value, Date.now());
    fields.repetitions.value = config.repetitions;
    fields.preparation.checked = Boolean(config.preparationMs);
    fields.finalSecondsEnabled.checked = config.finalSecondsEnabled ?? false;
    fields.finalSeconds.value = config.finalSeconds ?? DEFAULT_FINAL_SECONDS;
    for (const [prefix, ms] of [["duration", config.durationMs], ["rest", config.restMs]]) {
      fields[prefix + "Minutes"].value = Math.floor(ms / 60_000);
      fields[prefix + "Seconds"].value = Math.floor(ms / 1000) % 60;
    }
  },
  create(fields) {
    const milliseconds = prefix => fields[prefix + "Minutes"].valueAsNumber * 60_000 +
      fields[prefix + "Seconds"].valueAsNumber * 1000;
    return createTimerSession({
      kind: "interval", durationMs: milliseconds("duration"), restMs: milliseconds("rest"),
      repetitions: fields.repetitions.valueAsNumber, preparation: fields.preparation.checked,
      finalSecondsEnabled: fields.finalSecondsEnabled.checked, finalSeconds: fields.finalSeconds.valueAsNumber,
    });
  },
  valid: value => validSession(value, "interval") || Boolean(legacyIntervalTimer(value)),
}, normalizeInterval, config => `${config.repetitions} repetitions · ${durationDisplay(config.durationMs)} active · ${durationDisplay(config.restMs)} rest`,
{ stop: "Stop", skip: "Skip", skipRest: "Skip rest", restart: "Restart" });
