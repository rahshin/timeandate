# Test plan and release verification

Record the source SHA, RC or stable tag, web digest or native artifact and signing channel, browser or device and OS, and pass/fail/blocked for each applicable case. Keep evidence with the release run. Use a fresh profile for first-run tests and a separate seeded profile for upgrade and recovery. A skipped or blocked check is pending release evidence.

## Automated baseline

Use Node 24 with `npm ci`.

```sh
npm test
npm run build
npx --no-install playwright install chromium
npm run test:e2e
npm run mobile:build
TIMEANDATE_TEST_MODE=native npm run test:e2e -- --grep-invert '^.*standalone (countdowns|interval readout)'
```

| Suite | Coverage |
| --- | --- |
| [Node](../package.json) | Calendar and timezone math (including DST gaps and overlaps), curated clock links, duration input, standalone intervals, session phase actions and statistics, local data migration and recovery, stale commands and History, template selection, cue scheduling and arbitration, release selection and smoke helpers. |
| [Playwright Chromium](../e2e/dashboard.spec.mjs) | First-use and seasonal examples, options and keyboard focus, duplicate submit protection, countdown progress, timer sound modes and mute, peer-tab update focus, clock seconds and analog synchronization, date precision and shortcuts, interval completion and History, narrow readout fitting, and standalone timer readouts. |
| [Actions CI](../.github/workflows/ci.yml) | Workflow lint, Node tests, web build and Chromium, native bundle compilation. Candidate creation reruns the source's Node and web browser suites. |
| Native browser preview | Run Dashboard cases against `dist-native/`. The two standalone cases only apply to the web bundle. Both signed native workflows currently invoke the full suite in native mode, so the standalone cases can block their test gate. The filtered local command above verifies the applicable cases. Track correction of the workflow's suite selection before treating a signed build as verified. |

## Release scenarios

Use stable fixture names and fixed timestamps when automating. The cases below describe observable outcomes. Repeat shared Dashboard cases on the QA web build and each native target being distributed.

| ID | Exercise | Expected result |
| --- | --- | --- |
| DASH-01 | On a clean profile, open Dashboard. Edit one example and remove another. Reload. On a separate profile load older saved boards and cards. | Fresh examples appear once and stay edited or removed. Migration preserves existing board identities, default, placements, mute, and supported timer settings without adding examples. |
| DASH-02 | Create a second board, set a default, bookmark the other board, and open History using keyboard and touch. Repeat at narrow width and enlarged text. | Default and explicit board links resolve correctly. History includes runs across boards and returns to the originating board. Board options return focus to their trigger, and essential controls remain reachable. |
| RUN-01 | Create a duration timer. Start, pause, resume, reset while running, then stop. Edit a paused timer and save a preset. Start a new card from that preset. | Pause holds time. Running reset restarts the full duration and discards the reset run. Stop records one early end. Edit returns to Ready. Preset instances start Ready with independent state. |
| RUN-02 | Run an interval with preparation, positive rest, and multiple repetitions. Exercise Skip, Skip rest, Restart and Stop as available. Repeat with zero rest and a final Skip. | The session follows its phase actions across pause and resume. Zero rest hands off directly, and the last repetition has no trailing rest. History distinguishes completed, skipped, and interrupted work and excludes unattempted time. |
| RUN-03 | Run Countdown and Interval Timers on two boards, using the same card name. Follow the off-board links, including in a second tab. Attempt removal with unfinished sessions and race a terminal command across tabs. | Each link reveals the owning card. Both timers advance independently. Unfinished deletion is blocked, stale actions are ignored, and History records each ended run once. Check that ended runs are retained up to the latest 30. |
| DATA-01 | Let a running session checkpoint, then close all views and reopen. Repeat with a live view suspended or a second tab still open. Repeat with an ordinary pause. | Cold recovery restores a paused timer with recovery status and excludes downtime. Live suspension catches up to elapsed deadlines. Ordinary pauses retain their own status. |
| DATA-02 | In a disposable profile, simulate a failed storage write and interact with a card. | The session remains usable in memory and a storage notice explains that changes can be lost. |
| TIME-01 | Set Date Countdown targets on both sides of DST and try a skipped and repeated wall time. Pause across time progression and resume. Open a shared World Clocks URL with a custom city order and edit a Dashboard clock's seconds display. | Saved deadline follows the selected named zone, ambiguous and nonexistent targets are rejected, and resume catches up. Shared order and clock settings persist. |
| CUE-01 | On desktop/mobile Safari and physical iOS and Android, start Countdown and Interval sessions with Voice, Ticks and Off. Try preparation, short rests, long names, final Skip, overlapping timers, board mute and switching boards. Suspend and return. | Audible cues match the current mode and phase. Expired or muted cues stay quiet, and re-entry does not replay missed boundaries. The current timer state remains available through visual and accessible status. |
| CUE-02 | On the same devices, enable Keep screen awake for an active session. Switch sound Off, then pause, switch boards or background the app. Repeat where speech or wake is unavailable. | Wake is independent of audio. The active eligible view can keep the screen awake where supported and releases its request when it becomes ineligible. Timing and History continue without either capability. |
| WEB-01 | Visit `/clocks`, `/countdown`, and the legacy `/duration` and `/interval-timer-v0` paths. Install the standalone PWA where supported, allow the first online load to cache assets, then reopen offline with a timer configured. | The routes resolve to the expected tools. The PWA reopens offline with saved settings, projects elapsed time from the deadline, and can complete a routine without trailing rest. |
| MOB-01 | Install the Android APK and iOS Simulator artifact for each intended app ID. For a signed release, install or update through the intended sideload or store testing channel on physical devices and rerun the affected Dashboard and cue cases. | Dashboard and History work without web-only navigation. The dev and primary app IDs coexist with independent data. Same-channel upgrades preserve local data. Verify the app ID, build version and signing channel against the artifact being distributed. |
| REL-01 | On QA compare `/build-info.json` with the RC and SHA, check workflow smoke and asset checksums, then run the applicable cases above. At promotion compare the selected digest with QA and repeat critical route and timer smoke after deployment. | Production serves the candidate verified on QA. The stable release carries the checked assets and identifies the promoted RC. |
| REL-02 | When exercising recovery, dispatch rollback to a published stable tag and check live identity and routes against that artifact. | Production serves the prior web bundle. Verify it also opens on a profile with existing Dashboard data before closing verification. |

## Sign-off

For web promotion, require passing candidate checks, QA smoke, and the applicable release scenarios on the exact published RC. For native distribution, require a successful signed build and verification through the intended installation channel. Record any blocked cases with the affected platform and artifact before making the release decision. Repeat the live identity and route smoke after promotion or rollback.

Use the [release guide](ci-cd.md) for dispatch and approval and the [mobile guide](mobile.md) for build and installation.
