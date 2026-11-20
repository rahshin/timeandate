import assert from "node:assert/strict";
import test from "node:test";
import { durationDisplay, durationMilliseconds, durationRemaining, isDurationTimer } from "./duration.js";

test("duration accepts ten minutes and rejects empty or invalid time fields", () => {
  assert.equal(durationMilliseconds(0, 10, 0), 600_000);
  assert.equal(durationMilliseconds(1, 2, 3), 3_723_000);
  for (const fields of [[0, 0, 0], [0, 60, 0], [-1, 0, 0], [0, 0, 1.5], [NaN, 10, 0]]) {
    assert.equal(durationMilliseconds(...fields), 0);
  }
});

test("a running timer uses the deadline while a paused timer holds its remaining time", () => {
  const running = { initial: 600_000, remaining: 600_000, endAt: 700_000 };
  const paused = { ...running, remaining: 450_000, endAt: null };
  assert.equal(durationRemaining(running, 250_000), 450_000);
  assert.equal(durationRemaining(running, 900_000), 0);
  assert.equal(durationRemaining(paused, 900_000), 450_000);
  assert.equal(durationDisplay(450_000), "00:07:30");
  assert.equal(durationDisplay(1), "00:00:01");
  assert.equal(durationDisplay(0), "00:00:00");
  assert.ok(isDurationTimer(running));
  assert.ok(isDurationTimer(paused));
  assert.ok(!isDurationTimer({ ...paused, remaining: 650_000 }));
  assert.ok(!isDurationTimer({ ...running, endAt: "700000" }));
});
