# Phase 2 Web and native Dashboard integration

Implement Phase 2 in `/Users/rahul/dev/prjs/timeandate`. Start a fresh branch named `feat/dashboard-timer-integration` from the reviewed Phase 1 tip. If Phase 1 has merged, branch from its updated PR base. Otherwise branch from `origin/feat/shared-timer-engine-native-dev` and keep Phase 2 changes on the new branch.

Read the **Resume point** and **First-release implementation plan** in `docs/wip/timer_app_requirements_handoff.md`, the **Current Dashboard flow** in `docs/wip/phase-prompts/progress.md`, and the local build instructions in `docs/mobile.md`. Give the latest confirmed decisions precedence over older drafts.

## Existing baseline

- Dashboard **+** already offers Date Countdown, Countdown Timer, Interval Timer, and World Clock on web and native. The separate timer development apps use the same Dashboard as the web app. The temporary test area has been removed.
- Countdown Timer and Interval Timer already use one shared engine. Existing saved Dashboard cards and legacy standalone routes are supported. Preserve this behavior and use the current Dashboard flow for any remaining changes.

## Remaining scope

- Verify and fix named dashboard creation and switching, default selection, card placement, and per-timer mute in the separate iOS and Android development apps. Verify that all four item types are usable and new timers appear ready on the selected dashboard.
- Keep repetition duration, repetition count, and rest in basic Interval Timer setup. Retain separate minutes and seconds, the 0:02 default rest, and zero rest. Keep the optional 3-second preparation under **Advanced** and add the default-off final-seconds setting with its confirmed 10-second default window. Preserve the setting through card creation and editing. Spoken cues and screen wake belong to Phase 4.
- Confirm numeric limits and defaults against the handoff and current code. Flag material product decisions. Preserve the agreed Pause/Resume, Stop, Skip, Skip rest, Restart, and Countdown Reset behavior.
- Preserve legacy web routes and the standalone Interval Timer PWA. Keep history, presets, and cold recovery in Phase 3, and keep store identity and signing work outside this milestone.

## Verification and handoff

Run `npm test`, build the web preview and both native development apps, and check the existing Capacitor build and standalone PWA. On web, iOS, and Android, create and switch dashboards, set a default, add all four item types, and operate the timers. Check web keyboard navigation and mobile accessibility labels and touch layout. Report checks blocked by local tooling explicitly, including manual iOS touch if the Simulator GUI is unavailable.

Keep Phase 2 changes local for review. Append the result, exact run commands, artifacts, and remaining issues to `docs/wip/phase-prompts/progress.md`.
