import assert from "node:assert/strict";
import test from "node:test";
import { dashboardCountdown, dashboardSessionInterval } from "./dashboard-sessions.js";

test("existing duration cards keep their paused time and gain the shared controls", () => {
  const saved = { initial: 10_000, remaining: 4500, endAt: null };
  assert.equal(dashboardCountdown.valid(saved), true);
  assert.equal(dashboardCountdown.describe(saved, 1000).action, "Resume");
  const running = dashboardCountdown.toggle(saved, 2000, "resume");
  assert.equal(running.endAt, 6500);
  assert.equal(dashboardCountdown.command(running, "stop", 5000).status, "stopped");
  assert.equal(dashboardCountdown.toggle(running, 7000, "pause").status, "complete");
  assert.equal(dashboardCountdown.toggle(running, 7000, "start").endAt, 17_000);
});

test("existing interval cards keep their paused rest and completed repetition count", () => {
  const saved = {
    phases: { activity: 10_000, break: 5000 },
    activities: 3,
    timer: { status: "paused", phase: "break", cycle: 2, remainingMs: 2000 },
  };
  assert.equal(dashboardSessionInterval.valid(saved), true);
  assert.equal(dashboardSessionInterval.describe(saved, 100_000).display, "00:00:02");
  const next = dashboardSessionInterval.command(saved, "skipRest", 100_000);
  assert.equal(next.phase, "activity");
  assert.equal(next.cycle, 3);
  assert.equal(next.completed, 2);
  assert.equal(next.pauseMs, 8000);
  assert.equal(next.endAt, 110_000);
});
