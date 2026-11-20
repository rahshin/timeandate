import { initialTimer, restoreTimer, STORAGE_VERSION } from "./timer.js";
import { defaultSettings, validIntervalSettings } from "./settings.js";

const key = "timeandate.multi-timer";

export function loadRoutine() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    const legacy = saved?.version === STORAGE_VERSION && saved.settings === undefined &&
      (saved.timer?.status === "running" || saved.timer?.status === "paused");
    const settings = validIntervalSettings(saved?.settings) ? saved.settings
      : legacy ? { phases: defaultSettings.phases } : defaultSettings;
    return {
      settings,
      timer: restoreTimer(saved, settings.phases, settings.activities),
      sound: saved?.version === STORAGE_VERSION && saved.sound === true,
    };
  } catch {
    return { settings: defaultSettings, timer: initialTimer(), sound: false };
  }
}

export function saveRoutine(timer, sound, settings) {
  try {
    localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, timer, sound, settings }));
  } catch {
    // The current routine can still run with storage disabled.
  }
}
