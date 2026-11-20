# Phase 1 Shared timer behavior and native setup

Implement Phase 1 of the approved Time And Date plan in `/Users/rahul/dev/prjs/timeandate` on `feat/timer-sessions`, or the branch I specify. Read the **Resume point** and **First-release implementation plan** in `docs/wip/timer_app_requirements_handoff.md`. Use the latest confirmed decisions there when older handoff text or `repetition_timer_spec.md` differs.

## Scope

- Reuse the existing web Dashboard and deadline calculations. Implement the timing rules once for web, iOS, and Android. Each timer instance owns its own state. Keep timing and statistics independent of UI, storage, and speech.
- For Countdown Timer, verify Start, Pause/Resume, Stop, and Reset. Reset discards the unfinished run and restores the full duration. It restarts a running timer immediately and leaves a paused timer ready. Stop records an early ending in the session state.
- Implement Interval Timer with separate minutes and seconds for repetition and rest, a default rest of 0:02, and zero rest. Cover Skip, Skip rest, Restart, pause and resume during preparation, and immediate completion after the final repetition or skip. Track completed, skipped, interrupted, and unattempted slots and the agreed restart and rest statistics.
- Create separate iOS and Android development targets connected to the same timer code. Reuse the Dashboard for the milestone UI so each platform can run a timer. If a development identifier or OS target is undecided and materially affects the build, ask one focused question. Full picker integration belongs to Phase 2.

## Verification and handoff

Run fake-clock tests for phase boundaries, paused actions, zero rest, and concurrent sessions. Build the web preview and the new iOS and Android test apps. Verify each can open Dashboard and run a timer. Run existing web, Capacitor, and standalone PWA checks. Report any platform check blocked by local tooling as unverified.

Keep changes local for review. Record the implementation, exact run commands, verified artifacts, and blockers in `docs/wip/phase-prompts/progress.md` for the next chat.
