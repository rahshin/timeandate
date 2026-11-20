import "./settings.css";
import { durationDisplay } from "../duration.js";
import { initIntervalFields, intervalFields, phaseLength, readIntervalFields, validIntervalSettings } from "./settings.js";
import { loadRoutine } from "./storage.js";
import {
  initialTimer,
  pauseTimer,
  reconcile,
  remainingTime,
  restoreTimer,
  startTimer,
  STORAGE_VERSION,
} from "./timer.js";

export const dashboardInterval = {
  name: "Interval Timer",
  description: "Set an activity count and alternate between activity and break periods.",
  fields: intervalFields,
  init: initIntervalFields,
  create(fields, now) {
    const settings = readIntervalFields(fields);
    return { ...settings, timer: startTimer(initialTimer(settings.phases), now) };
  },
  valid(value) {
    return validIntervalSettings(value) &&
      restoreTimer({ version: STORAGE_VERSION, timer: value.timer }, value.phases, value.activities).status !== "idle";
  },
  describe({ phases, activities, timer }, now) {
    const current = reconcile(timer, now, phases, activities);
    const phase = current.phase === "activity" ? "Activity" : "Break after activity";
    const position = `${current.cycle}${activities ? ` of ${activities}` : ""}`;
    const status = current.status === "running" ? "Running" : "Paused";
    const complete = current.status === "complete";
    return {
      display: durationDisplay(remainingTime(current, now)),
      status: complete ? `Complete · ${activities} ${activities === 1 ? "activity" : "activities"}` : `${status} · ${phase} ${position}`,
      action: complete ? "" : current.status === "running" ? "Pause" : "Resume",
      detail: `${phaseLength(phases.activity)} activity · ${phaseLength(phases.break)} break`,
    };
  },
  toggle(value, now) {
    const { phases, activities, timer } = value;
    const next = timer.status === "running" ? pauseTimer(timer, now, phases, activities) : startTimer(timer, now);
    return { ...value, timer: next };
  },
  existing() {
    const { timer, settings } = loadRoutine();
    if (timer.status !== "idle") return { ...settings, timer };
  },
};
