# Phase 4 Foreground speech and screen wake

Implement Phase 4 in `/Users/rahul/dev/prjs/timeandate` on `feat/timer-sessions`, or the branch I specify. Read the **Resume point** and **First-release implementation plan** in `docs/wip/timer_app_requirements_handoff.md` and the prior entries in `docs/wip/phase-prompts/progress.md`. Keep launch scope to foreground speech output, using the latest confirmed decisions.

## Scope

- Add opt-in spoken completion announcements. Keep Interval Timer’s spoken preparation and final-seconds options separate. All three are off by default. When enabled, preparation uses three seconds and the final-seconds window defaults to ten seconds. Follow the handoff’s short-repetition rule and use a completion sound in place of a spoken zero.
- Use one speech queue with up to two eligible unmuted timers on the visible dashboard. Prioritize completion, discard stale countdown numbers, and cancel speech that is no longer eligible after mute, dashboard changes, or backgrounding. Identify the timer in spoken event announcements.
- Keep deadlines and accessible on-screen updates independent of speech. Add optional **Keep screen awake**, off by default, and release it when its conditions end. Use the browser or native platform capability available on each target.

## Verification and handoff

Test speech collisions, short repetitions, mute, dashboard switching, backgrounding, unavailable synthesis, and wake-lock failure. Build the web, iOS, and Android test artifacts and run prior milestone checks. Verify spoken playback and screen wake on physical devices where available. Report simulator or build checks separately from device results.

Keep changes local for review. Append speech and screen wake behavior, run commands, verified devices, and any unverified cases to `docs/wip/phase-prompts/progress.md`.
