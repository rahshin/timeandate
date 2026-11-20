const millisecond = 1000;
const maxHours = 999;

export function durationMilliseconds(hours, minutes, seconds) {
  const valid = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
  if (!valid(hours, maxHours) || !valid(minutes, 59) || !valid(seconds, 59)) return 0;
  return (hours * 3600 + minutes * 60 + seconds) * millisecond;
}

export function durationRemaining(timer, now = Date.now()) {
  return timer ? Math.max(0, timer.endAt === null ? timer.remaining : timer.endAt - now) : 0;
}

export function durationDisplay(remaining) {
  const seconds = Math.ceil(remaining / millisecond);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, "0"))
    .join(":");
}

export function isDurationTimer(value) {
  return value && Number.isSafeInteger(value.initial) && Number.isSafeInteger(value.remaining) &&
    value.initial <= durationMilliseconds(maxHours, 59, 59) &&
    value.remaining > 0 && value.remaining <= value.initial &&
    (value.endAt === null || Number.isSafeInteger(value.endAt) && value.endAt > 0);
}
