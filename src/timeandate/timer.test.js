import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRemaining, initialTimer, pauseTimer, PHASE_MS, reconcile,
  remainingTime, restoreTimer, startTimer, STORAGE_VERSION,
} from "./timer.js";

const now = 1_800_000_000_000;

test("initial and reset states are stopped on Activity, cycle 1, at 10:00", () => {
  const expected = { status: "idle", phase: "activity", cycle: 1, remainingMs: 600_000 };
  assert.deepEqual(initialTimer(), expected);
  for (const prior of [startTimer(initialTimer(), now), pauseTimer(startTimer(initialTimer(), now), now + 3)]) {
    assert.notStrictEqual(prior, initialTimer());
    assert.deepEqual(initialTimer(), expected);
  }
  assert.equal(formatRemaining(remainingTime(initialTimer(), now)), "10:00");
});

test("start, pause, and resume preserve the precise remaining milliseconds", () => {
  const running = startTimer(initialTimer(), now);
  assert.deepEqual(running, { status: "running", phase: "activity", cycle: 1, endAt: now + 600_000 });
  assert.strictEqual(startTimer(running, now + 400), running);
  const paused = pauseTimer(running, now + 123_456);
  assert.equal(paused.status, "paused");
  assert.equal(remainingTime(paused, now + 500_000), 476_544);
  assert.equal(startTimer(paused, now + 500_000).endAt, now + 976_544);
  assert.equal(formatRemaining(1), "00:01");
});

test("each boundary selects the next phase once and increments a cycle after the break", () => {
  const running = startTimer(initialTimer(), now);
  assert.strictEqual(reconcile(running, now + PHASE_MS.activity - 1), running);
  const rest = reconcile(running, now + PHASE_MS.activity);
  assert.equal(rest.phase, "break");
  assert.equal(rest.cycle, 1);
  assert.equal(remainingTime(rest, now + PHASE_MS.activity), 300_000);
  assert.strictEqual(reconcile(rest, now + PHASE_MS.activity), rest);
  const activity = reconcile(rest, now + 900_000);
  assert.equal(activity.phase, "activity");
  assert.equal(activity.cycle, 2);
  assert.equal(remainingTime(activity, now + 900_000), 600_000);
  assert.strictEqual(reconcile(activity, now + 900_000), activity);
});

test("a long suspension catches up using whole cycles and keeps the original phase schedule", () => {
  const time = now + 33 * 60_000;
  const original = startTimer(initialTimer(), now);
  for (const before of [original, reconcile(original, now + 600_000)]) {
    const current = reconcile(before, time);
    assert.equal(current.phase, "activity");
    assert.equal(current.cycle, 3);
    assert.equal(remainingTime(current, time), 7 * 60_000);
  }
  const atBreak = now + 43 * 60_000;
  const rest = reconcile(original, atBreak);
  assert.equal(rest.phase, "break");
  assert.equal(rest.cycle, 3);
  assert.equal(remainingTime(rest, atBreak), 2 * 60_000);
  assert.deepEqual(pauseTimer(original, atBreak), {
    status: "paused", phase: "break", cycle: 3, remainingMs: 120_000,
  });
});

test("storage restores either timer mode and rejects invalid or stale state", () => {
  const running = startTimer(initialTimer(), now);
  const paused = pauseTimer(running, now + 1_000);
  for (const timer of [running, paused]) {
    const saved = JSON.parse(JSON.stringify({ version: STORAGE_VERSION, timer }));
    assert.deepEqual(restoreTimer(saved), timer);
  }
  assert.equal(reconcile(restoreTimer({ version: STORAGE_VERSION, timer: running }), now + 600_000).phase, "break");
  for (const saved of [
    null, { version: 99, timer: running },
    { version: STORAGE_VERSION, timer: { ...running, phase: "toString" } },
    { version: STORAGE_VERSION, timer: { ...running, endAt: -3 } },
    { version: STORAGE_VERSION, timer: { ...running, cycle: 0 } },
    { version: STORAGE_VERSION, timer: { ...paused, remainingMs: 600_001 } },
  ]) {
    assert.deepEqual(restoreTimer(saved), initialTimer());
  }
});

test("custom activity and break lengths carry across phase changes and restore paused state", () => {
  const phases = { activity: 60_000, break: 120_000 };
  const start = 1_000;
  const running = startTimer(initialTimer(phases), start);
  const paused = pauseTimer(running, start + 90_000, phases);
  assert.deepEqual(paused, { status: "paused", phase: "break", cycle: 1, remainingMs: 90_000 });
  assert.deepEqual(restoreTimer({ version: STORAGE_VERSION, timer: paused }, phases), paused);
  const next = reconcile(running, start + 180_000, phases);
  assert.deepEqual(next, { status: "running", phase: "activity", cycle: 2, endAt: start + 240_000 });
});

test("a finite routine completes at the end of its last activity without a final break", () => {
  const phases = { activity: 2_000, break: 3_000 };
  const running = startTimer(initialTimer(phases), now);
  const single = reconcile(running, now + 2_000, phases, 1);
  assert.deepEqual(single, { status: "complete", phase: "activity", cycle: 1, remainingMs: 0 });

  const rest = reconcile(running, now + 2_000, phases, 2);
  const final = reconcile(rest, now + 5_000, phases, 2);
  assert.deepEqual(final, { status: "running", phase: "activity", cycle: 2, endAt: now + 7_000 });

  const complete = { status: "complete", phase: "activity", cycle: 2, remainingMs: 0 };
  for (const prior of [running, rest, final]) {
    assert.deepEqual(reconcile(prior, now + 7_000, phases, 2), complete);
    assert.deepEqual(pauseTimer(prior, now + 12_000, phases, 2), complete);
  }
  assert.deepEqual(restoreTimer({ version: STORAGE_VERSION, timer: complete }, phases, 2), complete);
  assert.equal(remainingTime(complete, now + 7_000), 0);
});
