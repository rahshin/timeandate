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
  create(fields) {
    const settings = readIntervalFields(fields);
    return { ...settings, timer: initialTimer(settings.phases) };
  },
  valid(value) {
    if (!validIntervalSettings(value)) return false;
    const { timer, phases, activities } = value;
    if (timer?.status === "idle") {
      return timer.phase === "activity" && timer.cycle === 1 && timer.remainingMs === phases.activity;
    }
    return restoreTimer({ version: STORAGE_VERSION, timer }, phases, activities).status !== "idle";
  },
  describe({ phases, activities, timer }, now) {
    const current = reconcile(timer, now, phases, activities);
    const phase = current.phase === "activity" ? "Activity" : "Break after activity";
    const position = `${current.cycle}${activities ? ` of ${activities}` : ""}`;
    const status = current.status === "idle" ? "Ready" : current.status === "running" ? "Running" : "Paused";
    const complete = current.status === "complete";
    return {
      display: durationDisplay(remainingTime(current, now)),
      status: complete ? `Complete · ${activities} ${activities === 1 ? "activity" : "activities"}` : `${status} · ${phase} ${position}`,
      action: current.status === "running" ? "Pause" : current.status === "paused" ? "Resume" : "Play",
      detail: `${phaseLength(phases.activity)} activity · ${phaseLength(phases.break)} break`,
    };
  },
  toggle(value, now) {
    const { phases, activities, timer } = value;
    const current = reconcile(timer, now, phases, activities);
    const next = current.status === "running" ? pauseTimer(current, now, phases, activities)
      : startTimer(current.status === "complete" ? initialTimer(phases) : current, now);
    return { ...value, timer: next };
  },
  reset(value, now) {
    const { timer, phases, activities } = value;
    const ready = initialTimer(phases);
    const running = reconcile(timer, now, phases, activities).status === "running";
    return { ...value, timer: running ? startTimer(ready, now) : ready };
  },
  existing() {
    const { timer, settings } = loadRoutine();
    if (timer.status !== "idle") return { ...settings, timer };
  },
};
