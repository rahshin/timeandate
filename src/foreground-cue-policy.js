import { advanceSession } from "./timer-session.js";

const eventWindow = 2000;

export function hasForegroundCues(config) {
  return config.speakCompletion || config.speakPhases === true ||
    config.preparationMs || config.finalSecondsEnabled;
}

function phaseKey(session) {
  return [session.phase, session.cycle, session.endAt].join("/");
}

function phaseCue(session, label, at) {
  if (session.config.speakPhases !== true || session.status !== "running" ||
      session.phase === "preparation") return;
  return {
    id: `phase/${phaseKey(session)}`,
    text: session.phase === "break" ? `${label}, rest` : `${label}, start repetition ${session.cycle}`,
    priority: 1,
    due: at,
    expires: Math.min(at + eventWindow, session.endAt),
    phase: phaseKey(session),
  };
}

function numberCue(session, label, now) {
  if (session.status !== "running") return;
  const { phase, config, endAt } = session;
  const seconds = Math.ceil((endAt - now) / 1000);
  const preparation = phase === "preparation";
  const finalSeconds = phase === "activity" && config.finalSecondsEnabled &&
    seconds <= config.finalSeconds && seconds * 1000 < config.durationMs;
  if (!preparation && !finalSeconds) return;
  const first = Math.min(config.finalSeconds, Math.ceil(config.durationMs / 1000) - 1);
  const namedText = preparation && seconds === 3 ? `${label}, starting in 3` : `${label}, ${seconds}`;
  return {
    id: `number/${phaseKey(session)}/${seconds}`,
    text: (preparation ? seconds === 3 : seconds === first) ? namedText : String(seconds),
    namedText,
    priority: 0,
    due: endAt - seconds * 1000,
    expires: endAt - (seconds - 1) * 1000,
    phase: phaseKey(session),
  };
}

function enteredByCommand(before, session) {
  if (!before || session.status !== "running") return false;
  return before.runId !== session.runId ||
    (before.commandRevision !== session.commandRevision &&
      (before.phase !== session.phase || before.cycle !== session.cycle ||
        before.restarts !== session.restarts));
}

export function foregroundCue(before, session, label, now) {
  const sameRun = before && before.runId === session.runId;
  let latest;
  let repetition;
  if (sameRun && (before.commandRevision === session.commandRevision ||
      before.completed < session.completed)) {
    advanceSession(before, now, (from, to, at) => {
      latest = { to, at };
      if (from.phase === "activity" && to.completed <= session.completed) {
        repetition = { cycle: from.cycle, at };
      }
    });
  }

  const { config } = session;
  const finished = sameRun && session.status === "complete" && before.status !== "complete";
  const boundary = repetition && now < repetition.at + eventWindow ? repetition : undefined;
  const matchingPhase = latest && session.status === latest.to.status &&
    phaseKey(session) === phaseKey(latest.to);
  const phaseStart = matchingPhase ? latest.at : enteredByCommand(before, session)
    ? session.endAt - (session.phase === "break" ? config.restMs : config.durationMs)
    : undefined;
  const phase = Number.isFinite(phaseStart) && phaseCue(session, label, phaseStart);
  const livePhase = phase && now < phase.expires ? phase : undefined;

  if (finished && config.speakCompletion && now < session.endedAt + eventWindow) {
    const skipped = session.skipped > before.skipped;
    return { event: {
      id: `finish/${session.endedAt}`,
      text: skipped && boundary?.at !== session.endedAt ? `${label}, session finished` : `${label} complete`,
      priority: 3,
      due: session.endedAt,
      expires: session.endedAt + eventWindow,
    }, signal: boundary?.at === session.endedAt && config.finalSecondsEnabled };
  }

  const signal = Boolean(boundary && config.finalSecondsEnabled &&
    (!finished || boundary.at === session.endedAt));
  if (session.status !== "paused" && session.status !== "stopped" &&
      !finished && boundary && config.speakCompletion) {
    return { event: {
      id: `repetition/${boundary.cycle}/${boundary.at}`,
      text: `${label}, repetition ${boundary.cycle} complete`,
      priority: 2,
      due: boundary.at,
      expires: boundary.at + eventWindow,
    }, following: livePhase, signal };
  }

  return {
    event: livePhase ?? numberCue(session, label, now),
    signal: signal && session.status !== "paused" && session.status !== "stopped",
  };
}

export function cueStillApplies(cue, row) {
  return row && !row.muted && row.session.runId === cue.runId &&
    row.session.status !== "paused" && row.session.status !== "stopped" &&
    (!cue.phase || (row.session.status === "running" && phaseKey(row.session) === cue.phase));
}
