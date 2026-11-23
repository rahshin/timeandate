import assert from "node:assert/strict";
import test from "node:test";
import { createForegroundCues, createWakeController } from "./foreground-cues.js";
import { advanceSession, createTimerSession, updateSession } from "./timer-session.js";

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
  assert.deepEqual(voice.calls, ["Stretch, 4", "3", "2", "1"]);
  assert.equal(tones, 1);
});

test("final-seconds ticks play once per audible second and keep the completion chime", async () => {
  const voice = fakeSpeech();
  const sounds = [];
  const cues = createForegroundCues({
    speech: voice.speech, tone: () => sounds.push("chime"), tick: () => sounds.push("tick"),
  });
  const row = running("Stretch", {
    kind: "interval", durationMs: 5000, finalSecondsEnabled: true, finalSeconds: 3, finalSecondsSound: "tick",
  });
  cues.update([row], 0);
  cues.update([row], 1000);
  assert.deepEqual(sounds, []);
  cues.update([row], 2000);
  cues.update([row], 2125);
  cues.update([{ ...row, muted: true }], 3000);
  cues.update([row], 4000);
  cues.update([row], 5000);
  await settle();
  assert.deepEqual(sounds, ["tick", "tick", "chime"]);
  assert.deepEqual(voice.calls, []);
});

test("countdowns can tick before completion and independently choose the sound at zero", async () => {
  for (const completionSound of ["silent", "chime", "speech"]) {
    const voice = fakeSpeech();
    const sounds = [];
    const cues = createForegroundCues({
      speech: voice.speech, tone: () => sounds.push("chime"), tick: () => sounds.push("tick"),
    });
    const row = running("Pasta", {
      durationMs: 3000, finalSecondsEnabled: true, finalSeconds: 1, finalSecondsSound: "tick", completionSound,
    });
    cues.update([row], 0);
    cues.update([row], 2000);
    cues.update([row], 3000);
    cues.update([row], 3125);
    await settle();
    assert.deepEqual(sounds, completionSound === "chime" ? ["tick", "chime"] : ["tick"]);
    assert.deepEqual(voice.calls, completionSound === "speech" ? ["Pasta complete"] : []);
    voice.end();
  }
});

test("timer-wide sound mode governs final seconds and completion", async () => {
  for (const soundMode of ["tick", "speech", "off"]) {
    const voice = fakeSpeech();
    const sounds = [];
    const cues = createForegroundCues({
      speech: voice.speech, tone: () => sounds.push("chime"), tick: () => sounds.push("tick"),
    });
    const row = running("Tea", {
      durationMs: 3000, finalSeconds: 1, soundMode, speakCompletion: true,
    });
    cues.update([row], 0);
    cues.update([row], 2000);
    await settle();
    voice.end();
    await settle();
    cues.update([row], 3000);
    await settle();
    assert.deepEqual(sounds, soundMode === "tick" ? ["tick", "chime"] : []);
    assert.deepEqual(voice.calls, soundMode === "speech" ? ["Tea, 1", "Tea complete"] : []);
    voice.end();
  }
});

test("switching an interval off silences preparation and cancels active speech", async () => {
  const voice = fakeSpeech();
  const sounds = [];
  const cues = createForegroundCues({
    speech: voice.speech, tone: () => sounds.push("chime"), tick: () => sounds.push("tick"),
  });
  const row = running("Intervals", {
    kind: "interval", durationMs: 3000, repetitions: 2, preparation: true, soundMode: "speech",
  });
  cues.update([row], 0);
  await settle();
  const silent = { ...row, session: { ...row.session, config: { ...row.session.config, soundMode: "off" } } };
  for (const now of [1000, 2000, 3000, 5000, 6000, 8000, 11_000]) cues.update([silent], now);
  await settle();
  assert.deepEqual(sounds, []);
  assert.deepEqual(voice.calls, ["Intervals, starting in 3", "cancelled"]);
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
  assert.deepEqual(voice.calls, ["Interval, 9", "cancelled", "Tea complete"]);
  voice.end();
  await settle();
  cues.update(rows, 1750);
  await settle();
  cues.update(rows, 1850);
  await settle();
  assert.deepEqual(voice.calls, ["Interval, 9", "cancelled", "Tea complete", "Break complete"]);
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
  assert.deepEqual(voice.calls, ["One, 3", "Two, 4"]);
  rows[1].muted = true;
  cues.update(rows, 1150);
  await settle();
  assert.deepEqual(voice.calls, ["One, 3", "Two, 4", "cancelled", "Three, 5"]);
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

test("opted-in phase cues cover Start, rest, Skip rest and running Restart, with ordinary Resume quiet", async () => {
  const voice = fakeSpeech();
  const cues = createForegroundCues({ speech: voice.speech });
  const row = {
    key: "Yoga", label: "Yoga",
    session: createTimerSession({ kind: "interval", durationMs: 4000, repetitions: 3,
      restMs: 3000, speakPhases: true }),
  };
  const tick = async at => {
    cues.update([row], at);
    await settle();
    voice.end();
    await settle();
  };
  const command = (action, now) => {
    const before = row.session;
    row.session = {
      ...updateSession(before, action, now),
      runId: "yoga",
      commandRevision: (before.commandRevision ?? 0) + 1,
    };
  };
  await tick(0);
  command("start", 1000);
  await tick(1000);
  command("pause", 1500);
  await tick(1500);
  command("resume", 2000);
  await tick(2000);
  await tick(5500);
  command("skipRest", 6000);
  await tick(6000);
  command("restart", 6500);
  await tick(6500);
  assert.deepEqual(voice.calls, [
    "Yoga, start repetition 1", "Yoga, rest", "Yoga, start repetition 2", "Yoga, start repetition 2",
  ]);
});

test("checkpoint catch-up uses the latest actual repetition boundary and never rest after the phase ends", async () => {
  const voice = fakeSpeech();
  const cues = createForegroundCues({ speech: voice.speech });
  const row = running("Laps", { kind: "interval", durationMs: 1000, repetitions: 5,
    restMs: 1000, speakPhases: true, speakCompletion: true });
  cues.update([row], 100);
  // The store advances before the cue controller samples, crossing two work deadlines.
  row.session = advanceSession(row.session, 3100);
  cues.update([row], 3100);
  await settle();
  assert.deepEqual(voice.calls, ["Laps, repetition 2 complete"]);
  voice.end();
  await settle();
  cues.update([row], 4000);
  await settle();
  assert.deepEqual(voice.calls, ["Laps, repetition 2 complete", "Laps, start repetition 3"]);
});

test("a completion leaves a live rest cue queued, while foreground return never replays a missed boundary", async () => {
  const voice = fakeSpeech();
  const cues = createForegroundCues({ speech: voice.speech });
  const row = running("Yoga", { kind: "interval", durationMs: 5000, repetitions: 3,
    restMs: 3000, speakPhases: true, speakCompletion: true });
  cues.update([row], 1000);
  cues.update([row], 5000);
  await settle();
  voice.end();
  await settle();
  cues.update([row], 5500);
  await settle();
  assert.deepEqual(voice.calls, ["Yoga, repetition 1 complete", "Yoga, rest"]);
  cues.clear();
  cues.update([row], 8100);
  await settle();
  assert.deepEqual(voice.calls, ["Yoga, repetition 1 complete", "Yoga, rest", "cancelled"]);
});

test("final Skip announces the end of a session without claiming a completed repetition or chiming", async () => {
  const voice = fakeSpeech();
  let tones = 0;
  const cues = createForegroundCues({ speech: voice.speech, tone: () => tones++ });
  const row = running("Laps", { kind: "interval", durationMs: 3000,
    speakCompletion: true, finalSecondsEnabled: true });
  cues.update([row], 0);
  row.session = { ...updateSession(row.session, "skip", 500), commandRevision: 1 };
  cues.update([row], 500);
  await settle();
  assert.deepEqual(voice.calls, ["Laps, session finished"]);
  assert.equal(tones, 0);
});

test("preparation hands off to the actual start, and zero rest goes directly to the next repetition", async () => {
  const voice = fakeSpeech();
  const cues = createForegroundCues({ speech: voice.speech });
  const prepared = running("Yoga", { kind: "interval", durationMs: 4000,
    preparation: true, speakPhases: true });
  cues.update([prepared], 0);
  await settle();
  voice.end();
  await settle();
  cues.update([prepared], 3000);
  await settle();
  assert.deepEqual(voice.calls, ["Yoga, starting in 3", "Yoga, start repetition 1"]);
  voice.end();
  await settle();
  cues.clear();

  const continuous = running("Laps", { kind: "interval", durationMs: 4000,
    repetitions: 2, restMs: 0, speakPhases: true });
  cues.update([continuous], 1000);
  cues.update([continuous], 4000);
  await settle();
  assert.equal(voice.calls.at(-1), "Laps, start repetition 2");
});
