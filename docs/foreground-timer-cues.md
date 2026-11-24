# Foreground timer cues

Foreground cues help people follow a timer while looking away from the screen. Dashboard Countdown Timers and Interval Timers use wall-clock deadlines for timing, on-screen status, and History. Speech, tones, and screen wake are optional and run independently of those deadlines.

## Sound modes and cue inventory

The timer speaker control cycles **Ticks**, **Voice**, and **Off**. The choice is saved with the session configuration. Board mute overrides delivery and leaves that choice intact. **Keep screen awake** is independent. Older sessions without an explicit mode retain their saved cue settings until a mode is selected.

| Event | Voice | Ticks |
| --- | --- | --- |
| Interval preparation, when enabled | Speaks the remaining numbers, beginning with the timer name. | Short tones. |
| Entry into running rest or activity | Names the timer and announces rest or the repetition start. Zero-length rest has no rest prompt. | Short transition tone. |
| Closing seconds of activity | Speaks current numbers. Names the timer at the start of the window and when switching timers. A five-second repetition with a longer window starts at four. | Short tones. |
| Natural end of an activity | Announces a repetition completion or a final session completion. A live rest or next-start prompt can follow an intermediate completion. | Boundary chime. |
| Final manual Skip | Says the session finished. | Quiet. |

Off silences these events. The cue queue is transient. Leaving the Dashboard clears playback state. Cards and the accessible status region continue to provide feedback.

### Quiet and deferred events

| Event | Treatment |
| --- | --- |
| Pause, ordinary Resume, Stop, Reset, and a nonfinal Skip itself | Controls and on-screen state provide feedback. Speak only an eligible phase the action actually enters. Hands-free command confirmations would have value if voice input is added. |
| Rest is about to end | Optional preparation already provides a countdown into activity. A second rest countdown would repeat that information and could consume a short rest. |
| Countdown pre-end warning or long-session milestones | Potentially useful for cooking or pacing. Defer until there is a defined lead time or milestone editing model. The current Countdown Timer supports spoken completion. |
| Restored sessions, background progress, board changes | Use on-screen recovery and off-board status. Re-entering the foreground can speak a currently eligible number. One-shot boundary events are not replayed. |
| Date Countdown, World Clock, standalone timer routes | Outside this Dashboard speech policy. Their existing display and alert paths apply. |
| Unsupported speech or wake | Keep the timer and accessible status usable. Speech, optional tones, and wake are handled independently. |

## Ownership and extension

1. [Timer engine](../src/timer-session.js) owns phase transitions and wall-clock deadlines. Its optional boundary observer reports the state before and after each natural transition and its exact timestamp. History uses the same engine without the observer.
2. [Dashboard](../src/dashboard.js) provides opted-in cards from the active board. It samples every 125 ms and on data and visibility changes. [Platform adapters](../src/foreground-platform.js) require visibility and, on web, window focus.
3. [Cue policy](../src/foreground-cue-policy.js) compares the previous observed run with the current projection. Following the previous deadlines recovers natural boundaries when a store checkpoint landed first. For command-driven starts, the policy checks run identity, command revision, and phase or attempt changes. The policy owns the wording, identity, priority, and expiry of cues.
4. [Playback controller](../src/foreground-cues.js) ranks due candidates and admits up to two timers. Session completion outranks repetition completion, then live phase cues, then numbers. A higher-priority cue can interrupt a lower-priority utterance. Each admitted timer can hold a pending summary and a pending live phase cue or number. Ties use due time, phase deadline, and card key. Expired numbers are dropped before playback. Boundary cues have up to two seconds to start, and live phase prompts expire sooner if the phase ends. Moving to another phase cancels its active instruction. An eight-second watchdog releases stalled speech.
5. [Platform adapters](../src/foreground-platform.js) own playback and wake capabilities. Web uses Speech Synthesis and Screen Wake Lock. Android uses TextToSpeech and a keep-screen-on flag. iOS uses AVSpeechSynthesizer and the idle-timer override. Keep screen awake is evaluated independently for opted-in running sessions.

A boundary chime comes from a natural completion. Board status tones still apply to eligible cards without an explicit timer sound mode.

## Developer and coding agent workflow

### Add a cue

1. Add the event to the inventory above. Describe what the listener should do or learn, which setting enables the cue, and when it becomes too late to be useful.
2. Find the event in [the timer engine](../src/timer-session.js) and [the cue policy](../src/foreground-cue-policy.js). Reuse the existing boundary observer for natural transitions. If a command-driven event cannot be distinguished from a natural transition or a no-op, use the applied command and its timestamp as the source. Derive speech from timer state and accepted actions. Rendered status strings can change independently.
3. Implement the cue in `foregroundCue` or the relevant policy helper. Give it a stable ID within a run, a due timestamp, an expiry, named copy where attribution matters, and a priority relative to existing cues. Include a phase key for instructions that only apply during that phase. For example, a rest prompt uses the rest boundary as its due time and expires at the earlier of the rest deadline or the event window. Check whether an existing cue describes the same boundary and decide which should play first or whether one should take precedence.
4. Reuse an existing setting if its label covers the new behavior. If the cue requires a new opt-in, wire the default, validation, and form round trip through [session creation](../src/timer-session.js) and [Dashboard timer settings](../src/dashboard-sessions.js). Update `hasForegroundCues` if the setting can enable speech on its own. Verify that [preset restoration](../src/dashboard-data.js) accepts the saved setting and that older cards and presets without it still load.

### Update a cue

Change copy, eligibility, timing, or priority in the policy. For copy-only edits, keep the cue ID and update the speech expectation. For timing or priority edits, check both when the cue can start and when a pending or active cue must be discarded. Test collisions with the next phase and another timer if the change affects playback order. Change the queue or platform adapter only when a delivery rule or device capability changes.

### Remove a cue

Remove its candidate from the policy and test that the former trigger stays silent while sibling cues still work. Remove an opt-in from the form and eligibility check only if it no longer controls any behavior. Check that existing cards and presets with the old setting still load and that the timer transition, History, and accessible status still work. Check tone handling separately when removing a boundary cue because speech and chimes can share a trigger.

### Verify and document

Use controlled timestamps and fake speech in [foreground cue tests](../src/foreground-cues.test.js). Cover the trigger, repeat polling, and the relevant cases for expiry, mute, foreground re-entry, and competing cues. If a preference changes, cover the saved and legacy forms in [Dashboard session tests](../src/dashboard-sessions.test.js).

Run `node --test src/foreground-cues.test.js src/dashboard-sessions.test.js` for focused checks and `npm test` if shared timer or persistence behavior changes. Update the cue inventory and the [changelog entry](changelog/timer-phase-4/README.md) for user-visible changes to this feature.

## Release verification

Use the [test plan](test-plan.md) for physical-device audio, wake, and accessibility checks. Speech is best effort when a device starts playback late or the queue drops an expired cue.
