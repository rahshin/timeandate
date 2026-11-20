# Multi Timer — Requirements Handoff

## Instructions for the next session

We are gathering requirements for a timer application. **Do not write the coding specification yet.** Continue identifying gaps and asking clarifying questions **one at a time**, in logical order, without silently assuming behavior. Once significant questions are resolved, produce a complete specification suitable for Codex/Claude Code.

Latest behavioral decision: during a running rest countdown, the voice command “Start” does nothing. It is accepted after “Wait” freezes the rest.

## 1. Working timer names

Use these names throughout future discussions and the specification:

| Previous label | Working name |
|---|---|
| Timer 1 | Countdown Timer |
| Timer 2 | Duration Countdown |
| Timer 3 | Interval Timer |

These are working names, not finalized branding. MultiTimer’s Android feature page explicitly lists Countdown timer and Interval timer; Duration Countdown is the user’s chosen working label, not a verified separate category on that page.

Source: https://help.multitimer.net/multitimer-android-app-features#h.xsr4dbqp6rq

Naming to-do: find intuitive, distinguishable names for all three types; review potential confusion with existing apps and their terminology; obtain user approval before finalizing names. Do not imply that a naming-conflict review establishes legal or trademark clearance.

## 2. Product and platforms

One application supports all three timer types and multiple concurrent sessions.

Deliver:
- A desktop-oriented responsive web app, usable at mobile viewport sizes.
- On mobile web, a dismissible banner recommends the native timer app once it is available for the user's platform. Remember dismissal on that device.
- Mobile apps for both iOS and Android.

No technology stack has been finalized for this expanded scope. An earlier simpler prototype prompt mentioned React/TypeScript/Vite, but that is not a confirmed architecture for the expanded application.

### Mobile background operation
- Goal: timing, spoken cues, and voice commands work while locked or backgrounded.
- Accepted fallback: foreground operation with the screen kept awake and a clear explanation when background voice functionality is unavailable.
- First release: offer an optional **Keep screen awake** setting while a timer is running, off by default, on supported devices and browsers.
- Verify platform feasibility before promising full background operation.

## 3. Timer types

### Countdown Timer
- User specifies a duration.
- Counts down once, then ends.
- On-screen controls: Start, Pause/Resume, Stop, and Reset. Reset discards the unfinished run without adding it to history and restores the full configured duration. If the countdown was running, a fresh run starts immediately. If it was paused, the timer becomes ready and waits for Start. Stop saves the run as ended early.
- Optional spoken event announcements only.
- No spoken final-seconds countdown or voice commands.

### Duration Countdown
- Fixed duration and configured repetition count.
- Configurable rest between repetitions, including zero.
- Default rest: 2 seconds.
- Automatically starts the next repetition after rest.
- Shows completed and remaining repetition counts.
- On-screen controls.
- Optional spoken event announcements only.
- No spoken final-seconds countdown or voice commands.

### Interval Timer
- Fixed duration and configured repetition count.
- Timed automatic advancement after configurable rest.
- Repetition and rest each use separate minutes and seconds fields. Rest defaults to 0 minutes and 2 seconds and may be zero.
- Voice commands and on-screen controls; no hardware-button integration in this version.
- User-requested indefinite holds.
- Configurable spoken final-seconds countdown.
- Optional preparation lead-in before repetitions.

## 4. Interval Timer voice commands and states

English only. Direct commands without a wake phrase.

### During an active repetition

| Command | Behavior |
|---|---|
| Wait | Pause the active countdown indefinitely. |
| Resume, after pausing | Continue immediately from remaining time, without preparation lead-in. Applicable spoken countdown continues. |
| Next | Abandon and record the repetition as skipped; consume its slot; enter configured rest. If final slot, end the session. |
| Restart | Reset the same repetition to full duration and play lead-in if enabled. Do not increment completed/skipped counts. Track restart count and activity time spent on discarded attempts separately. |
| Stop / End | Request termination under the confirmation rules below. |

Skipped repetitions consume configured slots. Ten configured repetitions with nine completed and one skipped ends the session without a replacement. Skipping produces no separate text or spoken skip alert. Update counters and enter normal rest unless final; skipping the final slot still triggers session completion.

### During a running between-repetition rest

| Command | Behavior |
|---|---|
| Wait | Freeze remaining rest indefinitely. |
| Start | No action. Accepted only after the rest has been frozen. |
| Stop / End | Request termination with confirmation. |

### During a frozen rest

| Command | Behavior |
|---|---|
| Resume | Continue remaining rest countdown, then advance automatically. |
| Start | Skip remaining rest and proceed to next repetition’s configured lead-in. |
| Stop / End | Request termination with confirmation. |

### During preparation lead-in
- Pause or Wait prevents the repetition starting and holds indefinitely until Start.
- In the first release, on-screen Resume restarts the full preparation cue after a pause. The deferred spoken Start behavior during a held cue remains a separate decision.

Do not assume unlisted commands are valid in every state. Review the full command/state matrix.

## 5. Spoken countdown and preparation lead-in

### Preparation lead-in — Interval Timer
- One session-level toggle, off by default.
- When enabled: “Starting in 3, 2, 1.”
- Plays before first repetition, subsequent repetitions, and Restart.
- Does not play on Resume of an active repetition.
- Additional to scheduled rest; excluded from pause statistics.

### Final-seconds countdown — Interval Timer only
- On/off toggle, off by default.
- Configurable threshold, default 10 seconds.
- Speak one number per second within the final window.
- If repetition duration is less than or equal to threshold, do not speak at the instant it starts; begin after the first elapsed second.
- Example: 5-second repetition announces “4, 3, 2, 1.”
- Completion sound instead of speaking zero.

### Countdown Timer and Duration Countdown
- Optional spoken event announcements at repetition/session completion.
- No spoken second-by-second countdown or voice commands.

## 6. Stop/end confirmation

### Scope
- Only spoken Stop/End requires confirmation.
- On-screen Stop immediately terminates its session in every timer type.

### Pending confirmation
- Ask “End this session?”
- Do not pause or interrupt the existing countdown/state.
- Yes / Confirm: end session, rolling recorded endpoint and statistics back to the original Stop/End request time.
- No / Cancel: dismiss confirmation; continue as if no request occurred.

### Phase boundary before confirmation
- Repetition ends: dismiss confirmation and complete repetition normally.
- Session ends: dismiss confirmation and complete session normally.
- Rest ends:
  1. Dismiss pending stop confirmation.
  2. Ask “Pause or continue?”
  3. Immediately use “Starting next rep in 3, 2, 1” as response window; do not wait indefinitely.
  4. Pause / Wait during lead-in holds indefinitely until Start.
  5. Continue or no response lets repetition start normally.

Unresolved: how this mandatory response-window flow interacts with disabling the ordinary lead-in toggle.

## 7. Concurrent timers and voice targeting

Multiple sessions can run simultaneously.

### Command targeting
- Named command, e.g. “Wait, stretches”: target named session even if another timer is visible.
- Unnamed command: target the timer whose detail screen is open.
- If no single timer is on screen (list, background, locked device): do not act on unnamed commands; ask user to name the timer.
- Duplicate names and ambiguous recognition are unresolved.

### Announcement eligibility and priority
- Only timers on the visible dashboard can speak. Timers on other dashboards keep running silently.
- At most TWO concurrent sessions eligible for voice announcements.
- Automatic priority: on-screen session first, then sessions with nearest upcoming announcements.
- Other sessions use text notifications/in-app messages.
- This is not a limit on running sessions.
- Whether announcement eligibility affects command listening is undecided; do not assume it does.

### Speech collisions
- Never overlap speech: one announcement at a time.
- Command confirmations and completion alerts take priority.
- Skip outdated countdown numbers rather than speaking them late.
- Event announcements identify the timer/session by name.
- Exact tie-breaking, queue limits, preemption, and stale non-countdown handling remain unresolved.

## 8. Text alerts

- Text notifications/in-app messages for each repetition completion and overall session completion.
- No separate skip alert.
- No notification for every countdown number.
- Clarify foreground/background delivery, permissions, and final-repetition/session-completion deduplication.

## 9. Statistics

Track separately:
- Completed repetitions.
- Skipped repetitions.
- Interrupted repetitions.
- Not-attempted repetition slots.
- Restart count.
- Activity time spent on discarded/restarted attempts.
- Total pause/rest time.
- Average pause length.

### Classification
- Next: skipped; consumes slot.
- Restart: same slot, no completed/skipped increment; track restart metrics.
- Confirmed stop during unfinished repetition: interrupted, not skipped.
- Slots not reached: not attempted.
- Confirmed spoken stop uses original request time for endpoint/statistics.

Example: ten configured; four completed; one skipped; stop midway through repetition six → four completed, one skipped, one interrupted, four not attempted.

### Pause/rest accounting
- Include scheduled between-repetition rests and user-requested pauses.
- Do not double-count overlap between rest and user hold.
- Continuous rest extended by Wait counts as one period.
- Example: five seconds rest + twenty seconds held + Start → one 25-second pause period.
- Average = total included rest/pause duration divided by continuous rest/pause-period count.
- Exclude preparation lead-in and time app was closed/crashed.
- Clarify paused lead-ins, restarts, partial periods, and other accounting edge cases.

## 10. Voice recognition

- English only initially; no wake phrase.
- Prefer platform-provided recognition.
- Platform default first; online processing acceptable.
- Platform-provided offline recognition as fallback where available.
- No custom offline engine requirement agreed.
- If recognition becomes unavailable: continue timer, announce unavailability, keep on-screen controls.
- Clarify denied permissions, retry/recovery, browser support, and preventing own speech triggering commands.

### Previously checked documentation
- Apple on-device capability: https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition
- Apple on-device requirement: https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition
- Android on-device recognition APIs: https://developer.android.com/reference/android/speech/SpeechRecognizer

Availability must be checked. These APIs do not guarantee continuous locked/background listening.

## 11. Storage, backup, and restoration

No separate app account or registration.

First release: save presets and session history locally on each device. Keep the latest 30 ended sessions per device across dashboards. Active sessions and presets do not count toward the history limit. File export/import and platform-account backup and restoration are deferred. The backup options below are for later releases.

### Storage
- Android: local app storage plus Google Drive backup/restoration using platform account.
- iOS: local app storage plus iCloud backup/restoration using platform account.
- Web: browser local storage.

### Backup experience
- In-app Back up now and Restore backup.
- Automatic backup where supported.
- Platform account selection and permission prompts acceptable.
- Include history, saved configurations, and preferences (including sound/voice).
- Restore merges histories, retains existing sessions, avoids duplicates.
- Configuration/preference conflict rules unresolved.
- Cross-platform synchronization not requested.

Android system Auto Backup differs from app-controlled Back up now. Validate architecture and permissions; do not claim OS backup alone fulfills manual backup requirements.

Reference: https://developer.android.com/identity/data/autobackup

## 12. Saved configurations

Users can name, save, edit, and delete reusable configurations for all three timer types.

Example: “Workout — 45 seconds × 12 repetitions, 20-second rest, voice enabled.”

Unspecified defaults remain open decisions.

## 13. Crash/closure recovery

Policy: recover paused.
- Restore at last saved position.
- Require explicit resume.
- Exclude closed/crashed time from activity/rest.
- Do not automatically credit repetitions during closure.
- Separate from intended ordinary background operation.

Clarify detection of closure/crash versus suspension and recovery of concurrent sessions.

## 14. Competitor research boundaries

- Seconds documents running while using other apps or while screen sleeps.
- MultiTimer documents multiple timers, customized alerts, and speech-related features.
- No reliable documented crash/force-close recovery policy established for either.
- No verified documentation established exact simultaneous-speech arbitration.
- Our selected behavior is a product decision, not a claim about competitors.

Useful references:
- https://www.intervaltimer.com/help
- https://help.multitimer.net/
- https://www.timerplusapp.com/help/guides/alerts/

## 15. Remaining clarification and implementation to-do list

Ask questions one at a time; do not assume answers.

### Naming
1. Find intuitive, distinguishable names for Countdown Timer, Duration Countdown, and Interval Timer.
2. Review potential confusion with existing timer apps and their terminology.
3. Confirm final names with user and update terminology consistently.

### Behavior and controls
4. Complete command/state matrix: Next during rest; Restart during rest/lead-in; Start during activity; Pause as alias outside lead-in.
5. Define on-screen controls and parity by timer type.
6. Define confirmation expiry, repeated requests, and other commands during confirmation.
7. Resolve lead-in-disabled behavior during special pause/continue response window.
8. Define duplicate session names and ambiguous command targets.
9. Define two-session announcement selection transitions, speech queue/preemption, and stale alerts.
10. Interval Timer fields are confirmed: minutes and seconds for both repetition duration and rest. Rest defaults to 0:02 and may be zero. Define remaining defaults, numeric ranges, repetition limits, and zero-repetition-duration validation.
11. Confirmed: the session ends immediately after the last repetition. Rest occurs only between repetitions.

### Notifications, voice, and platform behavior
12. Define web voice functionality and unsupported-browser fallback.
13. Define notification permissions, foreground/background presentation, and final-alert deduplication.
14. Define microphone/privacy UX, recognition retries, and speech feedback suppression.
15. Verify background/locked behavior on each platform; retain approved foreground fallback.
16. Confirmed: use a dismissible mobile web banner once the native app is available, and remember dismissal on that device.

### Statistics, data, and recovery
17. Finalize summary fields and time-accounting edge cases.
18. Define history viewing, deletion, retention, and exports.
19. Define preset/preference restore merge rules, backup scheduling, and account-unavailable behavior.
20. Validate explicit Google Drive/iCloud backup architecture separately from OS backup.
21. Define persistence frequency and concurrent-session crash recovery.

### Engineering and delivery
22. Select framework/architecture and minimum OS/browser versions.
23. Define test strategy, accessibility, packaging, and release scope.

## Resume point

Confirmed product decision: keep the existing date-and-time countdown as a separate tool, labeled **Date Countdown**, and preserve saved date countdowns. The new **Countdown Timer** counts down a duration once.

Confirmed distribution decision: add the new timer features alongside the existing tools in the Time And Date web app. Keep the older timers available for now. Ship a separate native timer app for iOS and Android with every item from the agreed Dashboard picker: **Date Countdown**, **Countdown Timer**, **Interval Timer**, and **World Clock**. The existing Time And Date mobile apps retain their current tools.

Confirmed first-release voice scope: foreground spoken announcements only. Include optional completion announcements and the Interval Timer’s preparation and final-seconds cues. Use on-screen controls for all timer actions. Defer voice commands, microphone access, and locked/background speech to later phases.

Confirmed completion announcement default: spoken completion announcements are off by default and can be enabled per timer. On-screen completion messages still appear.

Confirmed timer picker decision: combine the proposed **Duration Countdown** and **Interval Timer** into one **Interval Timer**. Basic setup asks for duration, repetitions, and rest. Advanced settings expose preparation and spoken final-seconds cues, both off by default. When enabled, preparation uses a 3-second lead-in and the final-seconds cue defaults to a 10-second window. The previous separate Duration Countdown in this handoff describes behavior that now belongs to the basic Interval Timer setup. Keep the older web timer available during the transition.

The most recent confirmed behavioral answer: Start does nothing while rest is counting down; after Wait freezes the rest, Start advances to the next repetition’s configured lead-in.

Confirmed first-release Interval Timer controls: **Pause/Resume** and **Stop** are the main controls. **Skip** and **Restart** are visible secondary buttons.

Confirmed on-screen rest control: **Skip rest** advances at any point during a running or paused rest. It starts the next repetition’s preparation cue if enabled, or starts the repetition immediately otherwise. It does not skip or count a repetition. This is separate from the deferred spoken **Start** command, whose running-rest behavior remains as previously agreed.

Confirmed on-screen Skip rule: skipping a paused repetition consumes that repetition’s slot and advances the session while keeping it paused. Resume begins the selected next phase. Skipping the final slot ends the session immediately.

Confirmed on-screen preparation rule: pausing during the cue holds the timer until Resume. Resume replays the full 3-second cue before starting the repetition. Replaying the cue does not count as a repetition restart.

Confirmed on-screen Restart rule: Restart is available only during a running or paused repetition. It restores the same repetition to its full duration. If it was running, start the replacement attempt immediately, beginning with the preparation cue if enabled. If it was paused, stay paused and play the preparation cue, if enabled, only after Resume. Count the restart and activity time spent on the discarded attempt separately. Restart does not consume a repetition slot.

Confirmed completion rule: end the session immediately when the final repetition finishes or is skipped. There is no final rest.

Current implementation baseline: the feature branch now supports named dashboards, a default dashboard, per-dashboard timer placement and sound, and per-timer mute. Timers on other dashboards continue silently. The visible dashboard currently uses an on-screen announcement region and optional tones. Build the new timer sessions around existing dashboard placement and controls.

Confirmed announcement scope: only unmuted timers on the visible dashboard can speak. Switching dashboards stops speech from the previous dashboard. Timers on other dashboards keep running silently.

Confirmed first-release storage scope: local presets and the latest 30 ended sessions per device. Backup and restore, including file export/import, are deferred.

## First-release implementation plan

Status: approved. Every milestone delivers testable web, iOS, and Android builds with Dashboard included.

The confirmed decisions above govern the first release. Use the current JavaScript, Vite, and Capacitor stack. Dashboards are a core feature of both the website and the separate iOS and Android timer app. The Dashboard picker offers **Date Countdown**, **Countdown Timer**, **Interval Timer**, and **World Clock**. Voice commands, microphone access, locked-screen speech, and cloud backup are later work.

Every milestone delivers a testable web build and testable builds of the new iOS and Android app. Set up the separate native targets in Phase 1 so native integration is verified throughout development. Use preview web builds and native test builds during development. Public store release and the mobile web banner come in Phase 5. Continue running regression checks for the existing web tools, native apps, and Interval Timer PWA.

### Phase 1 — Shared timer behavior

Approved: reuse the existing deadline calculations and implement the timing rules for Countdown Timer and Interval Timer once for the web, iOS, and Android. Each timer run is a separate instance with its own state and history on the device where it starts. Keep timing and statistics independent of rendering, storage, and audio.

Create the separate iOS and Android development targets and connect them to the shared timer code. Use a minimal dashboard and timer screen on web and mobile to exercise the first milestone. Phase 2 completes dashboard integration.

- Verify Countdown Timer Reset discards the unfinished run, restarts a running timer, and leaves a paused timer ready. Verify Stop records an early ending.
- Verify all Interval Timer transitions with a fake clock, including zero rest, Skip rest, paused Skip and Restart, preparation replay, and immediate completion after the last repetition or skip.
- Verify completed, skipped, interrupted, and unattempted slots are counted separately. Verify restart metrics and pause/rest accounting without double-counting.

**Exit check** — The new state transitions and existing timer tests pass. The web preview, iOS test app, and Android test app each open the milestone dashboard and run a timer. Multiple sessions can advance independently without audio.

### Phase 2 — Web and native Dashboard integration

Add the new options through the Dashboard **+** flow on web, iOS, and Android. Bring named dashboards, the default dashboard, timer placement, and per-timer mute to the new native app. Keep basic setup focused on duration, repetitions, and rest. Put the preparation and final-seconds settings under Advanced. New timers open in the ready state, following the current dashboard flow. Preserve the older web timer routes and previously saved items.

**Exit check** — On web, iOS, and Android, a user can create and switch dashboards, set a default dashboard, and add and operate all four item types. Verify keyboard navigation on web, accessibility and touch layout on mobile, and clear timer controls on all three. Verify the existing web timers and Interval Timer PWA separately.

### Phase 3 — Local presets, history, and recovery

Save reusable presets separately from active sessions and history. Keep the latest 30 ended sessions per device across all dashboards. Use a versioned local data format and preserve existing dashboard records. Save on transitions and at bounded checkpoints. Opening or repainting a dashboard should not write on every tick.

**Exit check** — On web, iOS, and Android, presets survive reopening and can be reused and edited. A finished or stopped session produces a single history entry even after a reload or retry. Reset runs never enter history. Interrupted duration and interval sessions reopen paused from their last saved checkpoints, with no credit for elapsed time while the app was closed. Existing Date Countdown items still use their chosen calendar deadlines.

### Phase 4 — Foreground announcements and screen wake

Add optional spoken completion, preparation, and final-seconds cues. All three are off by default. Use one foreground speech queue with up to two eligible, unmuted timers on the visible dashboard. Prioritize completion, drop expired numbers, and stop speech when the dashboard changes. Keep the timer driven by its deadline even if the speech engine is late or unavailable. Add the optional, default-off **Keep screen awake** setting.

**Exit check** — On web, iOS, and Android, two overlapping countdowns produce one utterance at a time. Dashboard switches, per-timer mute, and backgrounding silence the relevant speech. Timers continue to work without a voice or wake-lock capability. Check speech and screen wake on physical iOS and Android devices.

### Phase 5 — Separate native app and release

Prepare the existing milestone builds for distribution. Verify the production app identities and signing for the separate iOS and Android app. Test it independently of the current Time And Date native build and standalone PWA. Keep store signing and publication as release gates. Show the dismissible mobile web banner only on platforms where the new app is available.

**Exit check** — The web build, existing native build, and new native build each pass CI. Verify fresh install, upgrade of the existing app, local recovery, and dashboard controls on devices. Publish the banner only after the store links work.

### Items to settle at the relevant phase

- **Before Phase 2** — Finalize numeric ranges and defaults for duration and repetition count.
- **Before Phase 3** — Choose checkpoint frequency and confirm the history summary and delete controls.
- **Before Phase 1 native setup** — Confirm development app identifiers and the initial OS test targets.
- **Before Phase 5** — Confirm release signing and store distribution. Verify ordinary suspension and cold recovery separately.
