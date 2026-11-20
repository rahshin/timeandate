import assert from "node:assert/strict";
import test from "node:test";
import { advanceSession, createTimerSession, sessionRemaining, sessionStatistics, updateSession } from "./timer-session.js";

const countdown = () => createTimerSession({ durationMs: 1000 });
const interval = options => createTimerSession({ kind: "interval", durationMs: 1000, repetitions: 3, ...options });

test("countdown pause and resume preserve remaining time and stop records an early end", () => {
  let run = updateSession(countdown(), "start", 0);
  run = updateSession(run, "pause", 250);
  assert.equal(sessionRemaining(run, 5000), 750);
  run = updateSession(run, "resume", 5000);
  assert.equal(run.endAt, 5750);
  run = updateSession(run, "stop", 5200);
  assert.equal(run.status, "stopped");
  assert.equal(run.endedAt, 5200);
  assert.equal(sessionRemaining(run, 6000), 550);
});

test("countdown reset discards running and paused runs, and completion uses the deadline", () => {
  let run = updateSession(countdown(), "start", 0);
  run = updateSession(run, "reset", 300);
  assert.equal(run.endAt, 1300);
  const completed = updateSession(run, "stop", 1500);
  assert.equal(completed.status, "complete");
  assert.equal(completed.endedAt, 1300);
  run = updateSession(run, "pause", 500);
  run = updateSession(run, "reset", 800);
  assert.deepEqual(run, countdown());
});

test("late reconciliation counts exact interval boundaries, with no final rest", () => {
  const run = updateSession(interval(), "start", 0);
  const rest = advanceSession(run, 1000);
  assert.equal(rest.phase, "break");
  assert.equal(rest.endAt, 3000);
  const next = advanceSession(run, 3000);
  assert.equal(next.cycle, 2);
  assert.equal(next.phase, "activity");
  const complete = advanceSession(run, 10000);
  assert.equal(complete.endedAt, 7000);
  assert.deepEqual(sessionStatistics(complete, 10000), {
    completed: 3, skipped: 0, interrupted: 0, unattempted: 0, restarts: 0,
    discardedActivityMs: 0, pauseMs: 4000, pausePeriods: 2, averagePauseMs: 2000,
  });
});

test("zero rest begins the next repetition immediately and paused final skip ends the run", () => {
  let run = updateSession(interval({ restMs: 0 }), "start", 0);
  run = advanceSession(run, 1000);
  assert.equal(run.phase, "activity");
  assert.equal(run.cycle, 2);
  run = updateSession(run, "pause", 1200);
  run = updateSession(run, "skip", 1400);
  assert.equal(run.status, "paused");
  assert.equal(run.cycle, 3);
  assert.equal(sessionRemaining(run, 1500), 1000);
  run = updateSession(run, "resume", 1500);
  assert.equal(run.endAt, 2500);
  run = updateSession(run, "pause", 1600);
  run = updateSession(run, "skip", 1700);
  assert.equal(run.status, "complete");
  assert.equal(run.endedAt, 1700);
  assert.equal(run.skipped, 2);
  assert.equal(run.completed, 1);
});

test("paused skip preserves a pause into rest, and Skip rest works running or paused", () => {
  let run = updateSession(interval({ preparation: true }), "start", 0);
  run = updateSession(run, "pause", 3500);
  run = updateSession(run, "skip", 3600);
  assert.equal(run.status, "paused");
  assert.equal(run.phase, "break");
  assert.equal(sessionRemaining(run, 3700), 2000);
  run = updateSession(run, "skipRest", 4000);
  assert.equal(run.status, "running");
  assert.equal(run.phase, "preparation");
  assert.equal(run.endAt, 7000);
  assert.equal(run.skipped, 1);
  run = updateSession(run, "skipRest", 8200);
  assert.equal(run.phase, "preparation");
  assert.equal(run.cycle, 3);
  assert.equal(run.skipped, 1);
  assert.equal(sessionStatistics(run, 8200).pauseMs, 700);
});

test("pausing preparation replays the full cue without a restart or a counted pause", () => {
  let run = updateSession(interval({ preparation: true }), "start", 0);
  run = updateSession(run, "pause", 1200);
  run = updateSession(run, "resume", 7000);
  assert.equal(run.endAt, 10000);
  assert.equal(advanceSession(run, 10000).phase, "activity");
  assert.equal(sessionStatistics(run, 10000).pauseMs, 0);
  assert.equal(run.restarts, 0);
});

test("running and paused restarts retain the slot and account only for elapsed activity", () => {
  let run = updateSession(interval({ preparation: true }), "start", 0);
  run = updateSession(run, "restart", 3400);
  assert.equal(run.phase, "preparation");
  assert.equal(run.endAt, 6400);
  run = updateSession(run, "pause", 6650);
  run = updateSession(run, "restart", 7000);
  assert.equal(run.status, "paused");
  assert.equal(run.phase, "preparation");
  assert.equal(run.cycle, 1);
  run = updateSession(run, "resume", 7500);
  assert.equal(run.endAt, 10500);
  assert.equal(run.restarts, 2);
  assert.equal(run.discardedActivityMs, 650);
  assert.equal(sessionStatistics(run, 7500).pauseMs, 850);
});

test("scheduled rest and a user hold form one continuous period, including early stop", () => {
  const run = updateSession(interval(), "start", 0);
  const held = updateSession(run, "pause", 1500);
  const resumed = updateSession(held, "resume", 2500);
  assert.equal(resumed.endAt, 4000);
  const next = advanceSession(resumed, 4000);
  assert.equal(next.pauseMs, 3000);
  assert.equal(next.pausePeriods, 1);
  const stopped = updateSession(held, "stop", 2600);
  assert.equal(stopped.pauseMs, 1600);
  assert.equal(stopped.pausePeriods, 1);
  assert.equal(stopped.interrupted, 0);
});

test("stop distinguishes completed, skipped, interrupted, and unattempted slots", () => {
  let run = updateSession(interval({ repetitions: 10, restMs: 0 }), "start", 0);
  run = updateSession(run, "skip", 4250);
  run = updateSession(run, "stop", 4500);
  const { completed, skipped, interrupted, unattempted } = sessionStatistics(run, 9000);
  assert.deepEqual([completed, skipped, interrupted, unattempted], [4, 1, 1, 4]);
});

test("concurrent sessions maintain independent deadlines and controls", () => {
  const first = updateSession(countdown(), "start", 0);
  const second = updateSession(interval(), "start", 400);
  const paused = updateSession(first, "pause", 600);
  assert.equal(advanceSession(second, 1400).phase, "break");
  assert.equal(sessionRemaining(paused, 1400), 400);
  assert.equal(advanceSession(first, 1400).status, "complete");
});
