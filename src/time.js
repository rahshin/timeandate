import { Temporal } from "@js-temporal/polyfill";

export const cities = Object.freeze({
  seattle: ["Seattle", "America/Los_Angeles"],
  "los-angeles": ["Los Angeles", "America/Los_Angeles"],
  denver: ["Denver", "America/Denver"],
  chicago: ["Chicago", "America/Chicago"],
  "new-york": ["New York", "America/New_York"],
  "sao-paulo": ["São Paulo", "America/Sao_Paulo"],
  london: ["London", "Europe/London"],
  paris: ["Paris", "Europe/Paris"],
  dubai: ["Dubai", "Asia/Dubai"],
  mumbai: ["Mumbai", "Asia/Kolkata"],
  singapore: ["Singapore", "Asia/Singapore"],
  tokyo: ["Tokyo", "Asia/Tokyo"],
  sydney: ["Sydney", "Australia/Sydney"],
  auckland: ["Auckland", "Pacific/Auckland"],
});

export const defaultCities = ["seattle", "london", "mumbai", "tokyo"];

export function cityIds(value) {
  if (value === null) return [...defaultCities];
  return [
    ...new Set(value.split(",").filter((id) => Object.hasOwn(cities, id))),
  ];
}

export function citiesByTimeZone(ids, instant = Temporal.Now.instant()) {
  return ids.map(id => {
    const [name, zone] = cities[id];
    return { id, name, offset: instant.toZonedDateTimeISO(zone).offsetNanoseconds };
  }).sort((left, right) => left.offset - right.offset || left.name.localeCompare(right.name))
    .map(city => city.id);
}

export function targetInstant(wallTime, zone) {
  return Temporal.PlainDateTime.from(wallTime)
    .toZonedDateTime(zone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}

export function fillTimeZones(select) {
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = new Set([localZone, "UTC", ...Intl.supportedValuesOf("timeZone")]);
  for (const zone of [...zones].sort()) {
    select.add(new Option(zone.replaceAll("_", " "), zone));
  }
  select.value = localZone;
  return localZone;
}

export function clockFormatters(timeZone, showSeconds = false) {
  return {
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      ...(showSeconds && { second: "2-digit" }),
      hourCycle: "h23",
    }),
    date: new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export function validDateTimer(timer) {
  if (typeof timer?.wallTime !== "string" || typeof timer.zone !== "string") return false;
  if (timer.showSeconds !== undefined && typeof timer.showSeconds !== "boolean") return false;
  try {
    return targetInstant(timer.wallTime, timer.zone) === timer.instant;
  } catch {
    return false;
  }
}

export function createDateTimer(wallTime, zone) {
  let instant;
  try {
    instant = targetInstant(wallTime, zone);
  } catch {
    throw new Error("This local time is invalid or ambiguous in the selected timezone. Choose a different time.");
  }
  if (!countdown(instant, zone)) throw new Error("Choose a date and time in the future.");
  return { wallTime, zone, instant };
}

export function countdown(target, zone, now = Temporal.Now.instant(), showSeconds = false) {
  const end = Temporal.Instant.from(target);
  if (Temporal.Instant.compare(now, end) >= 0) return null;
  const remaining = now
    .toZonedDateTimeISO(zone)
    .until(end.toZonedDateTimeISO(zone), {
      largestUnit: "years",
      smallestUnit: showSeconds ? "seconds" : "minutes",
      roundingMode: "ceil",
    });
  const { years, months, days, hours, minutes, seconds } = remaining;
  return { years, months, days, hours, minutes, ...(showSeconds && { seconds }) };
}

export function dateCountdownDisplay(timer, now) {
  const seconds = timer.showSeconds || Date.parse(timer.instant) - now < 3_600_000;
  const remaining = countdown(timer.instant, timer.zone, Temporal.Instant.fromEpochMilliseconds(now), seconds);
  const units = { years: "y", months: "mo", days: "d", hours: "h", minutes: "m", seconds: "s" };
  return Object.entries(remaining ?? {})
    .filter(([, value]) => value > 0)
    .map(([unit, value]) => `${value}${units[unit]}`)
    .join(" ") || "0s";
}
