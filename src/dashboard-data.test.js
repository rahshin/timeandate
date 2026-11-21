import assert from "node:assert/strict";
import test from "node:test";
import {
  cardPrefix, checkpointSessions, commandSession, migrateDashboardData, unfinishedCards, presetSession, savePreset,
} from "./dashboard-data.js";
import { createTimerSession } from "./timer-session.js";

function empty() {
  return migrateDashboardData([]);
}

function add(data, key, options, dashboardId) {
  data.cards[key] = {
    type: options.kind === "interval" ? "interval" : "duration",
    name: key, created: 0, dashboardId, value: createTimerSession(options),
  };
}

function command(data, key, action, now, expected = data.cards[key].value) {
  return commandSession(data, key, action, expected, now);
}

test("migration keeps board identities, default, placement, mute, and older timer cards", () => {
  const boards = { boards: [{ id: "b", name: "Work", sound: true }], defaultId: "b", mutedLinkedTimers: { duration: true } };
  const countdown = { name: "Old countdown", type: "duration", created: 15, muted: true,
    value: { initial: 10000, remaining: 6000, endAt: 30000 } };
  const interval = { name: "Old intervals", type: "interval", created: 16, dashboardId: "b",
    value: { activities: 3, phases: { activity: 10000, break: 2000 },
      timer: { status: "paused", cycle: 1, phase: "break", remainingMs: 1200 } } };
  const date = { name: "Date", type: "date", created: 18, dashboardId: "b",
    value: { instant: "2027-01-01T00:00:00Z", zone: "UTC", wallTime: "2027-01-01T00:00" } };
  const keys = ["timeandate.dashboards", cardPrefix + "old", cardPrefix + "interval", cardPrefix + "date"];
  const records = [boards, countdown, interval, date];
  const data = migrateDashboardData({
    length: keys.length, key: index => keys[index], getItem: key => JSON.stringify(records[keys.indexOf(key)]),
  });
  assert.deepEqual(data.dashboards, boards);
  checkpointSessions(data, 60000, { cold: true });
  const old = data.cards[cardPrefix + "old"];
  assert.equal(old.muted, true);
  assert.equal(old.created, 15);
  assert.equal(old.value.status, "paused");
  assert.equal(old.value.remainingMs, 6000);
  const updatedInterval = data.cards[cardPrefix + "interval"];
  assert.equal(updatedInterval.dashboardId, "b");
  assert.equal(updatedInterval.value.completed, 1);
  assert.equal(updatedInterval.value.remainingMs, 1200);
  assert.deepEqual(data.cards[cardPrefix + "date"], date);
});

test("presets round-trip settings and create independent ready timers", () => {
  const data = empty();
  const interval = createTimerSession({ kind: "interval", durationMs: 12000, repetitions: 4,
    restMs: 3000, preparation: true, finalSecondsEnabled: true, finalSeconds: 8 });
  savePreset(data, "exercise", "interval", "Stretch", { ...interval, status: "paused", runId: "run" });
  const saved = JSON.parse(JSON.stringify(data)).presets.exercise;
  const first = presetSession(saved);
  const second = presetSession(saved);
  assert.deepEqual(first, interval);
  assert.deepEqual(second, interval);
  assert.notEqual(first.config, second.config);
  assert.equal(saved.runId, undefined);
});

test("latest 30 ended runs span dashboards and duplicated commands cannot end or restart the same run", () => {
  const data = empty();
  data.dashboards.boards.push({ id: "other", name: "Other" });
  for (let index = 0; index < 35; index++) {
    const key = String(index);
    add(data, key, { durationMs: 10000 }, index % 2 ? "other" : "original");
    const now = index * 20000;
    const ready = data.cards[key].value;
    assert.equal(command(data, key, "start", now, ready), true);
    assert.equal(command(data, key, "start", now + 1, ready), false);
    const running = data.cards[key].value;
    assert.equal(command(data, key, "stop", now + 500, running), true);
    const reloaded = JSON.parse(JSON.stringify(data));
    assert.equal(command(reloaded, key, "stop", now + 501, running), false);
    assert.deepEqual(reloaded.history, data.history);
  }
  assert.equal(data.history.length, 30);
  assert.equal(new Set(data.history.map(run => run.id)).size, 30);
  assert.equal(new Set(data.history.map(run => run.dashboardId)).size, 2);
  assert.equal(data.history.at(-1).name, "5");
});

test("Reset discards its run, Restart keeps one run, and final Skip records its statistics", () => {
  const data = empty();
  add(data, "countdown", { durationMs: 10000 });
  add(data, "interval", { kind: "interval", durationMs: 10000, repetitions: 1 });
  command(data, "countdown", "start", 1000);
  const discarded = data.cards.countdown.value.runId;
  command(data, "countdown", "reset", 2000);
  assert.notEqual(data.cards.countdown.value.runId, discarded);
  command(data, "countdown", "pause", 3000);
  command(data, "countdown", "reset", 4000);
  assert.deepEqual(data.history, []);
  command(data, "interval", "start", 1000);
  const intervalRun = data.cards.interval.value.runId;
  command(data, "interval", "restart", 2500);
  command(data, "interval", "skip", 3000);
  assert.equal(data.history.length, 1);
  assert.equal(data.history[0].id, intervalRun);
  assert.equal(data.history[0].statistics.skipped, 1);
  assert.equal(data.history[0].statistics.restarts, 1);
  assert.equal(data.history[0].statistics.discardedActivityMs, 1500);
});

test("cold launch restores simultaneous checkpoints paused without downtime while suspension catches up", () => {
  const data = empty();
  add(data, "countdown", { durationMs: 20000 });
  add(data, "interval", { kind: "interval", durationMs: 4000, repetitions: 3, restMs: 5000 });
  command(data, "countdown", "start", 1000);
  command(data, "interval", "start", 1000);
  assert.equal(checkpointSessions(data, 2000), false);
  assert.equal(checkpointSessions(data, 7000), true);
  assert.equal(checkpointSessions(data, 8000), false);
  const reloaded = JSON.parse(JSON.stringify(data));
  checkpointSessions(reloaded, 70000, { cold: true });
  assert.equal(reloaded.cards.countdown.value.status, "paused");
  assert.equal(reloaded.cards.countdown.value.remainingMs, 14000);
  const interval = reloaded.cards.interval.value;
  assert.equal(interval.status, "paused");
  assert.equal(interval.phase, "break");
  assert.equal(interval.remainingMs, 3000);
  assert.equal(interval.completed, 1);
  assert.equal(interval.pauseAt, 68000);
  assert.equal(reloaded.history.length, 0);
  command(reloaded, "interval", "skipRest", 71000);
  assert.equal(reloaded.cards.interval.value.pauseMs, 3000);
  checkpointSessions(data, 70000);
  assert.equal(data.history.length, 2);
  assert.equal(data.history[0].endedAt, 23000);
  assert.equal(data.history[0].statistics.completed, 3);
  assert.equal(checkpointSessions(data, 71000), false);
});

test("an elapsed Countdown run is recorded if Reset arrives before the completion checkpoint", () => {
  const data = empty();
  add(data, "timer", { durationMs: 1000 });
  command(data, "timer", "start", 1000);
  command(data, "timer", "reset", 2001);
  assert.equal(data.cards.timer.value.status, "idle");
  assert.equal(data.history[0].endedAt, 2000);
});

test("a Phase 2 running interval keeps its settings and saved phase when migrating", () => {
  const data = empty();
  const key = cardPrefix + "phase-two";
  add(data, key, {
    kind: "interval", durationMs: 12000, repetitions: 4, restMs: 3000,
    preparation: true, finalSecondsEnabled: true, finalSeconds: 8,
  }, "original");
  const config = data.cards[key].value.config;
  data.cards[key].value = {
    ...data.cards[key].value, cycle: 2, completed: 1, phase: "activity",
    status: "running", triedSlot: true, endAt: 96000, remainingMs: 10000,
  };
  checkpointSessions(data, 180000, { cold: true });
  const session = data.cards[key].value;
  assert.deepEqual(session.config, config);
  assert.equal(session.status, "paused");
  assert.equal(session.remainingMs, 10000);
  assert.equal(session.cycle, 2);
  assert.equal(session.completed, 1);
  assert.equal(data.history.length, 0);
});

test("only a cold-interrupted running timer gets recovery provenance", () => {
  const data = empty();
  add(data, "running", { durationMs: 20000 });
  add(data, "manual", { durationMs: 20000 });
  command(data, "running", "start", 1000);
  command(data, "manual", "start", 1000);
  command(data, "manual", "pause", 1500);
  checkpointSessions(data, 7000);
  assert.equal(data.cards.running.value.recovered, undefined);
  checkpointSessions(data, 40000, { cold: true });
  assert.equal(data.cards.running.value.recovered, true);
  assert.equal(data.cards.running.value.remainingMs, 14000);
  assert.equal(data.cards.manual.value.recovered, undefined);
  checkpointSessions(data, 50000, { cold: true });
  assert.equal(data.cards.running.value.recovered, true);
  command(data, "running", "resume", 51000);
  assert.equal(data.cards.running.value.recovered, undefined);
});

test("removal checks fresh unfinished sessions and allows a deadline-ended card", () => {
  const data = empty();
  add(data, "countdown", { durationMs: 3000 });
  add(data, "interval", { kind: "interval", durationMs: 3000, repetitions: 2 });
  assert.deepEqual(unfinishedCards(data, ["countdown", "interval"], 1000), []);
  command(data, "countdown", "start", 1000);
  command(data, "interval", "start", 1000);
  command(data, "interval", "pause", 2000);
  assert.deepEqual(unfinishedCards(data, ["countdown", "interval"], 3000), ["countdown", "interval"]);
  assert.deepEqual(unfinishedCards(data, ["countdown", "interval"], 4000), ["interval"]);
  checkpointSessions(data, 4000);
  assert.equal(data.history.length, 1);
  assert.equal(data.history[0].status, "complete");
});
