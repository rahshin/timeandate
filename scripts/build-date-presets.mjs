import { readFileSync, writeFileSync } from "node:fs";
import { Temporal } from "@js-temporal/polyfill";

const input = new URL("./data/date-presets.json", import.meta.url);
const output = new URL("../src/date-presets.json", import.meta.url);
const { include, holidays, events } = JSON.parse(readFileSync(input, "utf8"));
function reviewedDates(id, dates) {
  if (!Array.isArray(dates) || !dates.length) throw new Error(`Missing dates for ${id}`);
  for (const date of dates) {
    if (Temporal.PlainDate.from(date).toString() !== date) throw new Error(`Invalid date for ${id}: ${date}`);
  }
  return [...new Set(dates)].sort();
}

const commonIds = [...(include.common ?? []), ...(events.common ?? []).map(event => event.id)];
const areas = new Set([...Object.keys(include), ...Object.keys(events)]);
const catalog = Object.fromEntries([...areas].map(area => {
  const presets = (include[area] ?? []).map(id => {
    if (!Object.hasOwn(holidays, id)) throw new Error(`Unknown preset ${id} in ${area}`);
    const { name, dates, month, day, weekday, occurrence, presetOnly = false } = holidays[id];
    if (dates) return { id, name, dates: reviewedDates(id, dates), ...(presetOnly ? { presetOnly } : {}) };
    Temporal.PlainDate.from({ year: 2028, month, day: day ?? 1 }, { overflow: "reject" });
    if (day !== undefined) return { id, name, month, day };
    if (![1, 2, 3, 4, 5, 6, 7].includes(weekday) || ![1, 2, 3, 4].includes(occurrence)) {
      throw new Error(`Invalid weekday or occurrence for ${id}`);
    }
    return { id, name, month, weekday, occurrence };
  });
  for (const { id, name, dates, localTime = "00:00" } of events[area] ?? []) {
    if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(localTime)) {
      throw new Error(`Invalid local time for ${id}: ${localTime}`);
    }
    presets.push({ id, name, dates: reviewedDates(id, dates), localTime, event: true });
  }
  const ids = [...(area === "common" ? [] : commonIds), ...presets.map(preset => preset.id)];
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate preset in ${area}`);
  return [area, presets];
}));
writeFileSync(output, JSON.stringify(catalog, null, 2) + "\n");
