import "./style.css";
import "./settings.css";
import { formatRemaining, initialTimer, pauseTimer, reconcile, remainingTime, startTimer } from "./timer.js";
import { initIntervalFields, intervalFields, phaseLength, readIntervalFields } from "./settings.js";
import { loadRoutine, saveRoutine } from "./storage.js";
import { playTone, unlockTone } from "./audio.js";

const phaseName = { activity: "Activity", break: "Break" };

export function mountMultiTimer(root, { standalone = false, now = Date.now } = {}) {
  let { timer, sound, settings } = loadRoutine();
  root.innerHTML = `
    <section class="multi-timer" aria-labelledby="multi-heading">
      <header class="multi-intro">
        <h1 id="multi-heading">Interval Timer</h1>
        <p>Alternate between activity and break periods.</p>
      </header>
      <form class="multi-panel card">
        <div class="multi-phase-row"><span class="multi-phase"></span><span class="multi-cycle"></span></div>
        <p class="multi-clock" role="timer" aria-label="Time remaining"></p>
        <progress class="multi-progress" max="1" value="0" aria-label="Current phase progress"></progress>
        <p class="multi-next"></p>
        ${intervalFields}
        <p class="multi-settings-error" role="alert" hidden></p>
        <div class="multi-controls">
          <button type="submit" class="multi-primary"></button>
          <button type="button" class="multi-reset secondary">Reset</button>
        </div>
        <p class="multi-status" role="status"></p>
      </form>
      <footer class="multi-footer">
        <div class="multi-footer-row">
          <button type="button" class="multi-sound secondary" aria-pressed="false">Sound <span aria-hidden="true"></span></button>
        </div>
        <p>Keep the app open for reliable alerts. Sound may not play while your device is locked or the app is in the background.</p>
        ${standalone ? "" : '<p><a href="/interval-timer-app/">Open standalone Interval Timer</a></p>'}
      </footer>
    </section>`;

  const get = name => root.querySelector(`.multi-${name}`);
  const panel = get("panel");
  const phase = get("phase");
  const cycle = get("cycle");
  const clock = get("clock");
  const progress = get("progress");
  const next = get("next");
  const primary = get("primary");
  const reset = get("reset");
  const soundButton = get("sound");
  const soundLabel = soundButton.querySelector("span");
  const status = get("status");
  const settingsFields = panel.querySelector(".interval-settings");
  const settingsError = get("settings-error");
  initIntervalFields(panel.elements, settings);

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  function paint(time) {
    const { phases, activities } = settings;
    const remaining = remainingTime(timer, time);
    const display = formatRemaining(remaining);
    const active = timer.status === "running" || timer.status === "paused";
    const complete = timer.status === "complete";
    panel.dataset.phase = timer.phase;
    setText(phase, complete ? "Complete" : phaseName[timer.phase]);
    setText(cycle, activities ? `${timer.cycle} of ${activities} activities` : `Activity ${timer.cycle}`);
    setText(clock, display);
    progress.value = Math.max(0, 1 - remaining / phases[timer.phase]);
    if (complete) setText(next, "All activities finished.");
    else if (timer.phase === "activity" && timer.cycle === activities) setText(next, "Final activity.");
    else {
      const upcoming = timer.phase === "activity" ? "break" : "activity";
      setText(next, `Up next: ${phaseLength(phases[upcoming])} ${upcoming}.`);
    }
    settingsFields.hidden = settingsFields.disabled = active;
    setText(primary, timer.status === "running" ? "Pause" : timer.status === "paused" ? "Resume" : complete ? "Start again" : "Start");
    reset.disabled = timer.status === "idle";
    soundButton.setAttribute("aria-pressed", String(sound));
    setText(soundLabel, sound ? "on" : "off");
    const title = complete ? "Complete · Interval Timer"
      : timer.status === "idle" ? "Interval Timer" : `${display} ${phaseName[timer.phase]} · Interval Timer`;
    if (document.title !== title) document.title = title;
  }

  function sync(catchUp = false) {
    const time = now();
    const current = reconcile(timer, time, settings.phases, settings.activities);
    if (current !== timer) {
      const oneTransition = current.cycle === timer.cycle && current.phase === "break" ||
        timer.phase === "break" && current.phase === "activity" && current.cycle === timer.cycle + 1 ||
        current.status === "complete" && current.cycle === timer.cycle && timer.phase === "activity";
      const missed = catchUp || !oneTransition;
      timer = current;
      saveRoutine(timer, sound, settings);
      setText(status, timer.status === "complete" ? "Interval timer complete."
        : `${missed ? "Timer advanced. " : ""}${phaseName[timer.phase]} started.`);
      if (!missed && sound) playTone();
    }
    paint(time);
  }

  function commit(nextTimer, message) {
    timer = nextTimer;
    saveRoutine(timer, sound, settings);
    setText(status, message);
    paint(now());
  }

  panel.oninput = () => { settingsError.hidden = true; };
  panel.onsubmit = event => {
    event.preventDefault();
    const time = now();
    if (sound) unlockTone();
    if (timer.status === "running") {
      const paused = pauseTimer(timer, time, settings.phases, settings.activities);
      commit(paused, paused.status === "complete" ? "Interval timer complete." : `${phaseName[paused.phase]} paused.`);
    } else if (timer.status === "paused") {
      commit(startTimer(timer, time), `${phaseName[timer.phase]} resumed.`);
    } else {
      try {
        settings = readIntervalFields(panel.elements);
      } catch (issue) {
        settingsError.textContent = issue.message;
        settingsError.hidden = false;
        return;
      }
      commit(startTimer(initialTimer(settings.phases), time), "Activity started.");
    }
  };
  reset.onclick = () => {
    initIntervalFields(panel.elements, settings);
    settingsError.hidden = true;
    commit(initialTimer(settings.phases), "Timer reset.");
  };
  soundButton.onclick = () => {
    sound = !sound;
    if (sound) unlockTone();
    commit(timer, sound ? "Sound on." : "Sound off.");
  };

  const onReturn = () => { if (!document.hidden) sync(true); };
  const interval = setInterval(() => { if (!document.hidden) sync(); }, 250);
  document.addEventListener("visibilitychange", onReturn);
  window.addEventListener("focus", onReturn);
  window.addEventListener("pageshow", onReturn);
  sync(true);
  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onReturn);
    window.removeEventListener("focus", onReturn);
    window.removeEventListener("pageshow", onReturn);
    panel.onsubmit = panel.oninput = reset.onclick = soundButton.onclick = null;
  };
}
