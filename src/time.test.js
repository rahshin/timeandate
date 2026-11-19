import assert from "node:assert/strict";
import test from "node:test";
import { Temporal } from "@js-temporal/polyfill";
import { cityIds, countdown, targetInstant } from "./time.js";

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
  assert.throws(
    () => targetInstant("2026-11-01T01:30", "America/Los_Angeles"),
    RangeError,
  );
  assert.throws(
    () => targetInstant("2026-03-08T02:30", "America/Los_Angeles"),
    RangeError,
  );
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
