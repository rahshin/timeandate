import { PHASE_MS } from "./timer.js";

const minute = 60_000;
const second = 1_000;
const maxMinutes = 999;
const maxActivities = 999;
export const defaultSettings = Object.freeze({
  phases: PHASE_MS,
  activities: 3,
  includeSeconds: false,
});

export const intervalFields = `
  <fieldset class="interval-settings">
    <legend>Interval settings</legend>
    <label class="field">Number of activities
      <input name="activities" type="number" min="1" max="${maxActivities}" step="1" value="${defaultSettings.activities}" required>
    </label>
    <div class="duration-fields">
      <label class="field">Activity minutes
        <input name="activity" type="number" min="1" max="${maxMinutes}" step="1" value="10" required>
      </label>
      <label class="field">Break minutes
        <input name="break" type="number" min="1" max="${maxMinutes}" step="1" value="5" required>
      </label>
    </div>
    <label class="interval-seconds-toggle">
      <input type="checkbox" name="includeSeconds"> Include seconds
    </label>
    <div class="duration-fields" data-interval-seconds hidden>
      <label class="field">Activity seconds
        <input name="activitySeconds" type="number" min="0" max="59" step="1" value="0" required disabled>
      </label>
      <label class="field">Break seconds
        <input name="breakSeconds" type="number" min="0" max="59" step="1" value="0" required disabled>
      </label>
    </div>
  </fieldset>`;

export function initIntervalFields(fields, settings = defaultSettings) {
  const { phases, activities, includeSeconds } = settings;
  fields.activities.value = activities ?? defaultSettings.activities;
  fields.includeSeconds.checked = Boolean(includeSeconds);
  fields.activity.value = Math.floor(phases.activity / minute);
  fields.break.value = Math.floor(phases.break / minute);
  fields.activitySeconds.value = (phases.activity % minute) / second;
  fields.breakSeconds.value = (phases.break % minute) / second;

  const secondsGroup = fields.activitySeconds.closest("[data-interval-seconds]");
  function showSeconds() {
    const checked = fields.includeSeconds.checked;
    secondsGroup.hidden = !checked;
    fields.activitySeconds.disabled = !checked;
    fields.breakSeconds.disabled = !checked;
    fields.activity.min = fields.break.min = checked ? 0 : 1;
  }
  fields.includeSeconds.onchange = showSeconds;
  showSeconds();
}

export function readIntervalFields(fields) {
  const includeSeconds = fields.includeSeconds.checked;
  const phases = {
    activity: fields.activity.valueAsNumber * minute + (includeSeconds ? fields.activitySeconds.valueAsNumber * second : 0),
    break: fields.break.valueAsNumber * minute + (includeSeconds ? fields.breakSeconds.valueAsNumber * second : 0),
  };
  const settings = { phases, activities: fields.activities.valueAsNumber, includeSeconds };
  if (!validIntervalSettings(settings)) throw new Error("Enter a positive activity and break length and a valid activity count.");
  return settings;
}

export function validIntervalSettings(settings) {
  if (!settings?.phases) return false;
  const { activities, phases } = settings;
  const validCount = activities === undefined ||
    (Number.isInteger(activities) && activities >= 1 && activities <= maxActivities);
  const validPhase = value => Number.isSafeInteger(value) &&
    value >= second && value <= maxMinutes * minute + 59 * second && value % second === 0;
  return validCount && validPhase(phases.activity) && validPhase(phases.break);
}

export function phaseLength(milliseconds) {
  const minutes = Math.floor(milliseconds / minute);
  const seconds = (milliseconds % minute) / second;
  return [minutes && `${minutes} min`, seconds && `${seconds} sec`].filter(Boolean).join(" ");
}
