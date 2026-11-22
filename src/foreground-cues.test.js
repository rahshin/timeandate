import assert from "node:assert/strict";
import test from "node:test";
import { createForegroundCues, createWakeController } from "./foreground-cues.js";
import { createTimerSession, updateSession } from "./timer-session.js";

const settle = () => new Promise(resolve => setImmediate(resolve));

function running(label, settings, now = 0) {
  return {
    key: label, label,
    session: { ...updateSession(createTimerSession(settings), "start", now), runId: label },
  };
}

function fakeSpeech() {
  let finish;
  const calls = [];
  const speech = {
    play(text) {
      assert.equal(finish, undefined, "speech must never overlap");
      calls.push(text);
      return new Promise(resolve => { finish = resolve; });
    },
    stop() {
      calls.push("cancelled");
      end();
    },
  };
  function end() {
    const complete = finish;
    finish = undefined;
    complete?.();
  }
  return { speech, calls, end };
}

test("short repetitions skip the first second, never speak zero, and chime on natural completion", async () => {
  const voice = fakeSpeech();
  let tones = 0;
  const cues = createForegroundCues({ speech: voice.speech, tone: () => { tones++; } });
  const row = running("Stretch", { kind: "interval", durationMs: 5000, finalSecondsEnabled: true });
  cues.update([row], 0);
  await settle();
  assert.deepEqual(voice.calls, []);
  for (let i = 1; i < 5; i++) {
    cues.update([row], i * 1000);
    await settle();
    voice.end();
    await settle();
  }
  cues.update([row], 5000);
  await settle();
  assert.deepEqual(voice.calls, ["4", "3", "2", "1"]);
  assert.equal(tones, 1);
});

test("preparation identifies the timer and drops a missed number", async () => {
  const voice = fakeSpeech();
  const cues = createForegroundCues({ speech: voice.speech, tone() {} });
  const row = running("Yoga", { kind: "interval", durationMs: 5000, preparation: true });
  cues.update([row], 0);
  await settle();
  cues.update([row], 1000);
  voice.end();
  await settle();
  cues.update([row], 2100);
  await settle();
  assert.deepEqual(voice.calls, ["Yoga, starting in 3", "1"]);
});

test("completions preempt numbers and stay serialized across ticks", async () => {
  const voice = fakeSpeech();
  const cues = createForegroundCues({ speech: voice.speech, tone() {} });
  const rows = [
    running("Interval", { kind: "interval", durationMs: 10000, finalSecondsEnabled: true }),
    running("Tea", { durationMs: 1500, speakCompletion: true }),
    running("Break", { durationMs: 1600, speakCompletion: true }),
  ];
  cues.update(rows, 1000);
  await settle();
  cues.update(rows, 1510);
  await settle();
  cues.update(rows, 1620);
  await settle();
  assert.deepEqual(voice.calls, ["9", "cancelled", "Tea complete"]);
  voice.end();
  await settle();
  cues.update(rows, 1750);
  await settle();
  cues.update(rows, 1850);
  await settle();
  assert.deepEqual(voice.calls, ["9", "cancelled", "Tea complete", "Break complete"]);
});

test("only the two nearest timers can speak, and mute, removal and background clear invalidate speech", async () => {
  const voice = fakeSpeech();
  const cues = createForegroundCues({ speech: voice.speech, tone() {} });
  const rows = [
    running("One", { kind: "interval", durationMs: 4000, finalSecondsEnabled: true }),
    running("Two", { kind: "interval", durationMs: 5000, finalSecondsEnabled: true }),
    running("Three", { kind: "interval", durationMs: 6000, finalSecondsEnabled: true }),
  ];
  cues.update(rows, 1000);
  await settle();
  voice.end();
  await settle();
  cues.update(rows, 1100);
  await settle();
  assert.deepEqual(voice.calls, ["3", "4"]);
  rows[1].muted = true;
  cues.update(rows, 1150);
  await settle();
  assert.deepEqual(voice.calls, ["3", "4", "cancelled", "5"]);
  cues.update(rows.slice(0, 2), 1200);
  await settle();
  assert.equal(voice.calls.at(-1), "cancelled");
  cues.update(rows, 2200);
  await settle();
  cues.clear();
  assert.equal(voice.calls.at(-1), "cancelled");
});

test("wake failures are optional and late grants release when no longer wanted", async () => {
  let requests = 0;
  let grant;
  let released = 0;
  const wake = createWakeController(() => {
    requests++;
    if (requests === 1) return Promise.reject(new Error("Unavailable"));
    return new Promise(resolve => { grant = resolve; });
  });
  wake.update(true);
  await settle();
  wake.update(true);
  await settle();
  assert.equal(requests, 1);
  wake.update(true, true);
  await settle();
  wake.update(false);
  grant({ release: () => { released++; } });
  await settle();
  assert.equal(requests, 2);
  assert.equal(released, 1);

  const unsupported = createForegroundCues({ tone() {} });
  unsupported.update([running("Quiet", { durationMs: 10000, speakCompletion: true })], 10000);
  unsupported.clear();
});

test("an interval names repetition and session completions without announcing a manual Stop", async () => {
  const voice = fakeSpeech();
  const cues = createForegroundCues({ speech: voice.speech, tone() {} });
  const row = running("Laps", { kind: "interval", durationMs: 3000, repetitions: 2, restMs: 0, speakCompletion: true });
  cues.update([row], 1000);
  cues.update([row], 3000);
  await settle();
  voice.end();
  await settle();
  cues.update([row], 6000);
  await settle();
  assert.deepEqual(voice.calls, ["Laps, repetition 1 complete", "Laps complete"]);
  voice.end();
  await settle();

  const stopped = running("Tea", { durationMs: 3000, speakCompletion: true }, 7000);
  cues.update([stopped], 7500);
  stopped.session = updateSession(stopped.session, "stop", 8000);
  cues.update([stopped], 8000);
  await settle();
  assert.deepEqual(voice.calls, ["Laps, repetition 1 complete", "Laps complete"]);
});
