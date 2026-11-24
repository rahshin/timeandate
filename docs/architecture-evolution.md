# How Time And Date grew from standalone utilities into a timer dashboard

A standalone interval timer can keep its routine and settings in one place. A dashboard of independent timers introduces different questions. What happens when you switch boards mid-run? Which tab gets to stop a timer? After an app closes, can you tell which runs finished and which were interrupted? Those questions drove changes to Time And Date's timing model, local data, and platform boundaries.

## Give the run its own lifecycle

Each Dashboard Countdown or Interval Timer has a session with its own deadline and permitted actions. A stopped or paused card can be edited and returned to Ready. A running interval can advance through activity and rest even if JavaScript wakes up late. The same transition logic produces statistics and reports the timestamp of each natural boundary. A slow paint or a delayed audio callback therefore has no authority over when a repetition ends.

Date Countdown keeps a different promise. Its deadline comes from the event's wall time and named timezone. Pausing holds the readout and resuming catches up to that deadline. A duration timer instead holds its remaining time. Keeping those meanings explicit lets the Dashboard provide consistent controls without making different kinds of countdown behave alike.

## Save a run and its history together

Adding presets, multiple boards, and a global History made separate writes for cards and runs difficult to coordinate. The Dashboard now keeps them in one versioned local snapshot. It rereads that snapshot before changing it and uses Web Locks when available to serialize changes across tabs. Session identity and stale-command checks help prevent two views of the same timer from ending it twice. Existing dashboards migrate into this model. Fresh installations seed editable examples once through the same storage path, so removing an example is durable.

Recovery distinguishes suspension from a cold launch. While a live view is suspended, deadlines remain authoritative and it can catch up on return. After a cold launch, an interrupted run comes back paused at its checkpoint. That gives the user a visible place to resume and avoids labeling time spent with the app closed as activity. Off-board links follow the same ownership rule. They take the user to the original running card and its controls.

## Treat audio as a foreground effect

A spoken rest instruction is useful only while rest is current. The Dashboard derives cues from session transitions and gives each cue a lifetime. The playback controller can drop expired cues, stop speech when board context changes, and prioritize completion when two timers compete. Browser and Capacitor adapters handle speech and screen wake. Keeping device capabilities outside the timing model means the session and its History still advance when speech is unavailable.

## Make build boundaries reflect the product surfaces

Android and iOS package the Dashboard and History. The web build also ships the original standalone tools and the installable Interval Timer PWA. Timers Dev packages the native Dashboard under its own app identity, so development builds can coexist with the main app. The separate entry points and app identities make it possible to share session code while retaining independent local data and keeping the native navigation focused.

The delivery pipeline applies a similar boundary. The web candidate is built once, stamped, tested in Chromium, and deployed to QA. Promotion verifies the published bundle and deploys those same bytes after approval. A rollback retrieves an earlier stable web bundle. Android QA APKs have their own checksums, and signed native packages follow a separate workflow because device distribution and store approval operate on different artifacts.

The recurring design choice was to put authority where it can be checked. The timer engine owns elapsed time, the local repository owns recovery and History, and the release manifest identifies the files that reached QA. The UI, speech adapters, and deployment environments can change without redefining those records.
