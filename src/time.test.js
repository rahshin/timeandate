import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "@js-temporal/polyfill";
import { citiesByTimeZone, cityIds, countdown, dateCountdownDisplay, dateCountdownShortcut, targetInstant } from "./time.js";

test("public board links preserve ordering and ignore unknown or duplicate cities", () => {
  assert.deepEqual(cityIds("tokyo,seattle,tokyo,unknown"), [
    "tokyo",
    "seattle",
  ]);
  assert.deepEqual(cityIds(""), []);
});

test("target conversion accounts for DST and rejects ambiguous or nonexistent times", () => {
  assert.equal(
    targetInstant("2026-11-18T15:30", "America/Los_Angeles"),
    "2026-11-18T23:30:00Z",
  );
  assert.equal(
    targetInstant("2026-07-18T15:30", "America/Los_Angeles"),
    "2026-07-18T22:30:00Z",
  );
  assert.throws(
    () => targetInstant("2026-11-01T01:30", "America/Los_Angeles"),
    RangeError,
  );
  assert.throws(
    () => targetInstant("2026-03-08T02:30", "America/Los_Angeles"),
    RangeError,
  );
});

test("cities sort by UTC offset with city names breaking ties", () => {
  const date = Temporal.Instant.from("2026-11-20T00:00Z");
  const ids = ["tokyo", "mumbai", "seattle", "los-angeles", "dubai", "london"];
  assert.deepEqual(citiesByTimeZone(ids, date), [
    "los-angeles", "seattle", "london", "dubai", "mumbai", "tokyo",
  ]);
});

test("countdown uses calendar months, rounds partial minutes up, and stops at the target", () => {
  const target = "2027-03-02T03:04:00Z";
  assert.deepEqual(
    countdown(target, "UTC", Temporal.Instant.from("2026-01-01T00:00Z")),
    {
      years: 1,
      months: 2,
      days: 1,
      hours: 3,
      minutes: 4,
    },
  );
  assert.equal(
    countdown(target, "UTC", Temporal.Instant.from("2027-03-02T03:03:59Z"))
      .minutes,
    1,
  );
  assert.equal(countdown(target, "UTC", Temporal.Instant.from(target)), null);
});

test("dashboard date countdown shows seconds in the final hour and skips zero units", () => {
  const timer = { instant: "2027-03-02T03:04:00Z", zone: "UTC" };
  const at = (time, value = timer) => dateCountdownDisplay(value, Date.parse(time));
  assert.equal(at("2027-03-02T02:03:55Z"), "1h 1m");
  assert.equal(at("2027-03-02T02:03:55Z", { ...timer, showSeconds: true }), "1h 5s");
  assert.equal(at("2027-03-02T03:03:55Z"), "5s");
  assert.equal(at("2027-03-02T03:02:00Z"), "2m");
  assert.equal(at("2027-03-02T03:03:59.500Z"), "1s");
  assert.equal(at(timer.instant), "0s");
});

test("date countdown shortcuts use the target timezone and keep today's time when possible", () => {
  const now = Temporal.Instant.from("2026-11-22T01:23:45Z");
  const zone = "America/Los_Angeles";
  assert.equal(dateCountdownShortcut("now", "", zone, now), "2026-11-21T17:23");
  assert.equal(dateCountdownShortcut("today", "2026-11-30T18:30", zone, now), "2026-11-21T18:30");
  assert.equal(dateCountdownShortcut("today", "2026-11-30T16:30", zone, now), "2026-11-21T17:24");
  assert.equal(dateCountdownShortcut("today", "", zone, now), "2026-11-21T17:24");
  const overlap = Temporal.Instant.from("2026-11-01T08:30:00Z");
  assert.equal(dateCountdownShortcut("today", "", zone, overlap), "2026-11-01T02:00");
});
