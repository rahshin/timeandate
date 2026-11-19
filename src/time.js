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

export function targetInstant(wallTime, zone) {
  return Temporal.PlainDateTime.from(wallTime)
    .toZonedDateTime(zone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}

export function countdown(target, zone, now = Temporal.Now.instant()) {
  const end = Temporal.Instant.from(target);
  if (Temporal.Instant.compare(now, end) >= 0) return null;
  const remaining = now
    .toZonedDateTimeISO(zone)
    .until(end.toZonedDateTimeISO(zone), {
      largestUnit: "years",
      smallestUnit: "minutes",
      roundingMode: "ceil",
    });
  const { years, months, days, hours, minutes } = remaining;
  return { years, months, days, hours, minutes };
}
