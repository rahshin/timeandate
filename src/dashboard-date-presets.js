import { Temporal } from "@js-temporal/polyfill";
import { targetInstant } from "./time.js";

import catalog from "./date-presets.json" with { type: "json" };

function annualDate(year, { month, day = 1, weekday, occurrence }) {
  const first = Temporal.PlainDate.from({ year, month, day });
  if (weekday === undefined) return first.toString();
  return first.add({ days: 7 * (occurrence - 1) + (weekday - first.dayOfWeek + 7) % 7 }).toString();
}

export function upcomingDatePresets(country, zone, now = Date.now()) {
  const year = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone).year;
  const presets = [...catalog.common, ...(country !== "common" && Object.hasOwn(catalog, country) ? catalog[country] : [])];
  return presets.flatMap(({ id, name, dates, event = false, presetOnly = false, localTime = "00:00", ...rule }) => {
    dates ??= [year - 1, year, year + 1].map(year => annualDate(year, rule));
    for (const day of dates) {
      const wallTime = `${day}T${localTime}`;
      let instant;
      try {
        instant = targetInstant(wallTime, zone);
      } catch {
        // Some local times are skipped or repeated during clock changes.
        continue;
      }
      if (Date.parse(instant) > now) return [{ id, name, event, presetOnly, value: { wallTime, zone, instant } }];
    }
    return [];
  }).sort((a, b) => Date.parse(a.value.instant) - Date.parse(b.value.instant));
}

export function seasonalHoliday(country, zone, now) {
  const deadline = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone)
    .add({ days: 30 }).epochMilliseconds;
  return upcomingDatePresets(country, zone, now)
    .find(holiday => !holiday.event && !holiday.presetOnly && Date.parse(holiday.value.instant) <= deadline);
}
