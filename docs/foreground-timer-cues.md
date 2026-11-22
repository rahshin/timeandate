# Foreground timer cues

Foreground cues help people follow a timer while looking away from the screen. Dashboard Countdown Timers and Interval Timers use wall-clock deadlines for timing, on-screen status, and History. Speech, tones, and screen wake are optional and run independently of those deadlines.

## Adversarial review

| Reviewer | Finding | Resolution |
| --- | --- | --- |
| Software Architect | The controller inferred events from status and counter deltas, duplicated countdown scheduling rules, and mixed event wording with queue state. A delayed sample could announce the wrong repetition. | Observe exact natural boundaries from the timer engine. Keep cue eligibility, wording, priority, and expiry in one policy module. Give the queue responsibility for playback and arbitration. |
| Principal Frontend Developer | A late rest instruction can tell someone to stop after the next repetition has started. Bare digits are ambiguous after a timer switch. The Dashboard could sample the previous board during a board change, and the final-seconds chime relied on two audio paths. | Bind instructions to a live phase and deadline. Name the timer at the start of a number sequence and when playback switches timers. Resolve the active board before sampling and give the final-seconds chime one owner. |
| Product Manager | The gap is actionable guidance at rest and work boundaries. Putting those cues under an existing option would change the meaning of saved preferences. Routine button confirmations would add chatter. | Add one default-off **Speak rest and repetition starts** option to Interval Timers and presets. Preserve separate preparation, final-seconds, and completion choices. Prioritize completion and give live phase prompts a chance to follow. |

The agreed design adds one policy module and one optional setting. There is no persisted cue queue or delivery history. Leaving the Dashboard clears transient playback state. Timer cards and the Dashboard’s accessible status region remain available if synthesis fails or the timer is muted.

## Cue inventory

| Event | Foreground response | Setting and usefulness |
| --- | --- | --- |
| Countdown Timer naturally reaches its deadline | “Tea complete.” | **Speak completion**. Lets someone finish another task while waiting. |
| Interval preparation starts or resumes | “Yoga, starting in 3,” then “2,” then “1.” A missed number expires. | **Speak 3-second preparation**. Provides time to get into position, including after rest or if preparation is restarted. |
| An interval enters a positive rest | “Yoga, rest.” Applies after natural completion or Skip if the resulting rest is running. | **Speak rest and repetition starts**. Signals when to stop the activity. Zero-length rest has no rest cue. |
| A repetition starts | “Yoga, start repetition 2.” Applies to initial Start, the end of preparation or rest, a direct zero-rest handoff, Skip rest, and a running Restart that enters activity. | **Speak rest and repetition starts**. Signals when to move. Ordinary Resume continues the attempt quietly. A Restart while paused waits for Resume and uses the preparation flow when enabled. |
| An interval reaches the final seconds of activity | Current number, with the timer name at the window opening and when a spoken number switches timers. | **Speak final-seconds countdown**. Helps pace the end of the repetition. For a five-second repetition and ten-second window, speech starts at four. |
| A repetition ends naturally and another remains | “Yoga, repetition 1 complete.” | **Speak completion**. Confirms progress. A still-current rest or next-start instruction can follow if phase cues are enabled. |
| The interval session ends on its final repetition | “Yoga complete.” | **Speak completion**. The session message takes precedence over a separate final-repetition message. |
| The last slot is manually skipped | “Yoga, session finished.” | **Speak completion**. Confirms the terminal state without implying the skipped repetition was completed. |
| A repetition ends naturally with final-seconds cues enabled | A chime instead of spoken zero, including on the final natural repetition. | **Speak final-seconds countdown**. Marks the exact activity boundary when audio is available. Simultaneous boundary chimes within a sample coalesce. |

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

A final-seconds chime is produced from a natural repetition boundary. The Dashboard’s general Timer sound setting still controls its ordinary status tones for other timers.

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

## Implementation and verification plan

1. **Implemented** — Expose exact natural transitions and extract cue policy. Verify short repetitions, simultaneous cues, checkpoint catch-up, and distinct completion and Skip wording.
2. **Implemented** — Add default-off rest and repetition-start speech, with saved configuration and preset support. Verify real phase entry through Start, preparation, rest, Skip rest, Restart, and zero-rest transitions. Preserve mute and foreground invalidation.
3. **Implemented** — Resolve board changes before sampling and use one final-seconds chime path. Cover stale prompts, completion priority, and silent return after a missed boundary.
4. **Remaining release verification** — Listen on physical iOS and Android devices and in desktop/mobile Safari. Check first-gesture speech, short rests, long names, two timers, screen-reader announcements, focus/visibility changes, and screen-wake duration. Speech is best effort when a device starts playback late or the queue drops an expired cue.
