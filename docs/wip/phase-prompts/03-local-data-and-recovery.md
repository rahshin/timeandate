# Phase 3 · Local presets, history, and recovery

Implement Phase 3 in `/Users/rahul/dev/prjs/timeandate`. Start `feat/timer-local-data-recovery` from updated `main`, or use the branch I specify. Preserve existing working-tree changes. Read the **Resume point** and **First-release implementation plan** in `docs/wip/timer_app_requirements_handoff.md`, the Phase 2 entries in `docs/wip/phase-prompts/progress.md`, and the local build instructions in `docs/mobile.md`. Follow the latest confirmed decisions and verify the baseline in code.

## Baseline

Phase 2 merged in PR #4. The web and both native targets share the Dashboard picker and timer session engine. The native apps expose Dashboard only. Preserve named dashboards, the default, bookmarkable Dashboard URLs, per-timer mute, card placement, the four picker item types, and the existing timer controls and Advanced settings. Keep the web World Clocks and Countdown Timers pages and the standalone Interval Timer PWA. The retired `/interval-timer-v0` route redirects to the PWA. Manual iOS touch and screen-reader verification remained open after Phase 2.

## Scope

- Add local, reusable Countdown Timer and Interval Timer presets. Users can name, select, edit, and delete presets and use them to set up a new Dashboard timer. Keep presets separate from active runs and ended history.
- Keep the latest **30 ended sessions per device**, across all dashboards. Record each completed or stopped run once using a stable run identity and shared session statistics, even after a reload, retry, or activity in multiple Dashboard tabs. An Interval Timer that ends on its final Skip is an ended run. Exclude Countdown Reset discards and activity attempts replaced by Interval Restart from standalone history entries. Preserve the existing statistics for discarded activity in the finished run. Keep the default history view concise.
- Use a versioned local data format with migration from current and older saved Dashboard cards. Preserve dashboard identities and URLs, default selection, placement, mute, and timer settings. Keep local data consistent if a save is interrupted or another tab opens the same dashboard.
- Persist session transitions and periodic checkpoints at a bounded cadence. Opening or repainting Dashboard should avoid writes on every tick. A cold launch restores interrupted Countdown Timer and Interval Timer runs paused at their last saved position. Time while closed earns no credit. Ordinary suspension should retain deadline-based catch-up. Opening another tab while a timer is running should leave that run active. Preserve absolute Date Countdown deadlines.
- Keep storage on-device. Leave backup and import/export, foreground speech, screen wake, and store release work for later phases. Document checkpoint cadence, how cold launch is distinguished from suspension and an additional tab, and any platform limitations.

## Verification and handoff

Run `npm test` and add focused coverage for migration, preset reuse, the 30-entry cap, duplicate prevention across tabs or retries, Reset exclusion, and recovery of multiple running timers. Exercise a cold restart and an ordinary suspension separately. Build and verify the web preview and both native development apps. Run regression checks for the existing web tools, existing Capacitor targets, and standalone PWA. Record any native interaction blocked by local tooling.

Keep changes local for review. Append the migration and recovery behavior, exact commands, results, artifact paths, and remaining issues to `docs/wip/phase-prompts/progress.md`.
